// 一個 resolve step 的純邏輯：
//   planStep（找成三 + 引爆特殊 + 列出要出題的格）
//   → game 層逐一出題 →
//   applyStep（答錯變石頭、消除、障礙扣血、計分、生成特殊、重力、補充）

import { Board, Gem, MatchGroup, Pos, Question, Special, RAINBOW_COLOR, LOCKING_KINDS } from './types';
import { getCell, key, isBlocked, makeGem, newGemId, randomColor } from './board';
import { findMatches } from './match';
import { ClearPlan, expandSpecials, newPlan, parseKey } from './specials';
import { hitObstacles, makeObstacle, neighbors, ObstacleHit } from './obstacles';
import { comboMultiplier, EFFECT_GEM_SCORE, matchGroupScore, OBSTACLE_SCORE } from './scoring';
import { Rng } from './rng';

export interface StepPlan {
  plan: ClearPlan;
  groups: MatchGroup[];
  /** 需要出題的格子（左上→右下）。 */
  questions: Pos[];
}

export interface FallMove {
  from: Pos;
  to: Pos;
  gemId: number;
}

export interface SpawnInfo {
  pos: Pos;
  gem: Gem;
  /** true：從盤面上方落下；false：原地生成（被障礙擋住的段落）。 */
  fromTop: boolean;
  /** 從頂端落下時的起始列（負數）。 */
  startY: number;
}

export type ResolveEvent =
  | { type: 'rockify'; pos: Pos }
  | { type: 'clear'; cells: Pos[]; score: number }
  | { type: 'obstacleHit'; hits: ObstacleHit[] }
  | { type: 'spawnSpecial'; pos: Pos; special: Special }
  | { type: 'fall'; moves: FallMove[] }
  | { type: 'spawn'; gems: SpawnInfo[] };

export interface RefillContext {
  questionProb: number;
  makeQuestion: (rng: Rng) => Question;
}

/**
 * 規劃本 step。回傳 null 表示沒有東西可消除（連鎖結束）。
 * @param initial 由技能 / 特殊組合預先決定的消除計畫
 */
export function planStep(board: Board, preferred: Pos[] = [], initial?: ClearPlan): StepPlan | null {
  const groups = findMatches(board, preferred);
  const plan = initial ?? newPlan();
  for (const g of groups) for (const c of g.cells) plan.clear.add(key(c.x, c.y));
  if (plan.clear.size === 0) return null;
  expandSpecials(board, plan);

  // 生成特殊寶石的那顆是「變形」不是消除，題目保留、不出題
  const spawnKeys = new Set(groups.filter((g) => g.spawnAt).map((g) => key(g.spawnAt!.x, g.spawnAt!.y)));
  const questions: Pos[] = [];
  for (const k of plan.clear) {
    if (spawnKeys.has(k)) continue;
    const p = parseKey(k);
    if (getCell(board, p.x, p.y)?.gem?.question) questions.push(p);
  }
  questions.sort((a, b) => a.y - b.y || a.x - b.x);
  return { plan, groups, questions };
}

export interface StepResult {
  events: ResolveEvent[];
  score: number;
}

/**
 * 套用本 step 的消除結果。
 * @param wrong 答錯的題目格（會變成石頭而不消除）
 */
export function applyStep(
  board: Board,
  step: StepPlan,
  wrong: Set<string>,
  combo: number,
  rng: Rng,
  refill: RefillContext,
): StepResult {
  const events: ResolveEvent[] = [];
  const { plan, groups } = step;
  const mult = comboMultiplier(combo);
  let raw = 0;

  // 1. 答錯 → 變石頭。本 step 不再被扣血。（重力會在被擋住的段落原地補寶石，所以不會封死整行）
  const protectedKeys = new Set<string>();
  for (const k of wrong) {
    if (!plan.clear.has(k)) continue;
    plan.clear.delete(k);
    plan.area.delete(k);
    protectedKeys.add(k);
    const p = parseKey(k);
    const cell = getCell(board, p.x, p.y)!;
    cell.gem = null;
    cell.obstacle = makeObstacle('rock');
    events.push({ type: 'rockify', pos: p });
  }

  // 2. 計分：成三群組 + 特殊效果掃到的其他寶石
  const groupCells = new Set<string>();
  for (const g of groups) {
    const alive = g.cells.filter((c) => plan.clear.has(key(c.x, c.y)));
    for (const c of alive) groupCells.add(key(c.x, c.y));
    if (alive.length >= 3) raw += matchGroupScore(alive.length);
    else raw += alive.length * EFFECT_GEM_SCORE;
  }
  for (const k of plan.clear) if (!groupCells.has(k)) raw += EFFECT_GEM_SCORE;

  // 3. 障礙扣血：被消除格四鄰 1 次、特殊效果範圍 1 次；覆蓋在被消除寶石上的冰 / 黑暗直接移除
  const clearPositions = [...plan.clear].map(parseKey);
  const spawnKeys = new Set(groups.filter((g) => g.spawnAt).map((g) => key(g.spawnAt!.x, g.spawnAt!.y)));
  const hits: ObstacleHit[] = [];
  const onCleared: Pos[] = [];
  for (const p of clearPositions) {
    const cell = getCell(board, p.x, p.y)!;
    if (cell.obstacle && (cell.obstacle.kind === 'ice' || cell.obstacle.kind === 'dark')) onCleared.push(p);
    if (cell.obstacle?.kind === 'water' && plan.waterClear.has(key(p.x, p.y))) onCleared.push(p);
  }
  hits.push(...hitObstacles(board, onCleared, true));
  const adjacent: Pos[] = [];
  for (const p of clearPositions) adjacent.push(...neighbors(board, p).filter((n) => !protectedKeys.has(key(n.x, n.y))));
  hits.push(...hitObstacles(board, adjacent));
  const areaPositions = [...plan.area].map(parseKey).filter((p) => !plan.clear.has(key(p.x, p.y)) && !protectedKeys.has(key(p.x, p.y)));
  hits.push(...hitObstacles(board, areaPositions));
  for (const h of hits) if (h.destroyed) raw += OBSTACLE_SCORE[h.kind];
  if (hits.length) events.push({ type: 'obstacleHit', hits });

  // 4. 消除寶石（生成特殊寶石的格子改為變形）
  const cleared: Pos[] = [];
  for (const p of clearPositions) {
    const k = key(p.x, p.y);
    if (spawnKeys.has(k)) continue;
    getCell(board, p.x, p.y)!.gem = null;
    cleared.push(p);
  }
  const score = Math.round(raw * mult);
  events.push({ type: 'clear', cells: cleared, score });

  // 5. 生成特殊寶石
  for (const g of groups) {
    if (!g.spawnAt || g.spawn === 'none') continue;
    const cell = getCell(board, g.spawnAt.x, g.spawnAt.y)!;
    const question = cell.gem?.question;
    const color = g.spawn === 'rainbow' ? RAINBOW_COLOR : g.color;
    cell.gem = { id: newGemId(), color, special: g.spawn, question: g.spawn === 'rainbow' ? undefined : question };
    events.push({ type: 'spawnSpecial', pos: g.spawnAt, special: g.spawn });
  }

  // 6. 重力與補充
  const { falls, spawns } = applyGravity(board, rng, refill);
  if (falls.length) events.push({ type: 'fall', moves: falls });
  if (spawns.length) events.push({ type: 'spawn', gems: spawns });

  return { events, score };
}

/**
 * 每行以擋格障礙切段；段內寶石往下壓實。最上段從頂端補入，其餘段原地生成。
 */
export function applyGravity(board: Board, rng: Rng, refill: RefillContext): { falls: FallMove[]; spawns: SpawnInfo[] } {
  const falls: FallMove[] = [];
  const spawns: SpawnInfo[] = [];
  for (let x = 0; x < board.w; x++) {
    let y = 0;
    while (y < board.h) {
      if (isBlocked(board, x, y)) {
        y++;
        continue;
      }
      const top = y;
      while (y < board.h && !isBlocked(board, x, y)) y++;
      const bottom = y - 1; // 段落 [top, bottom]
      const isTopSegment = top === 0;

      // 壓實
      let write = bottom;
      for (let read = bottom; read >= top; read--) {
        const gem = getCell(board, x, read)!.gem;
        if (!gem) continue;
        if (read !== write) {
          getCell(board, x, write)!.gem = gem;
          getCell(board, x, read)!.gem = null;
          falls.push({ from: { x, y: read }, to: { x, y: write }, gemId: gem.id });
        }
        write--;
      }
      // 補充 [top, write]
      let startY = -1;
      for (let fy = write; fy >= top; fy--) {
        const question = rng.next() < refill.questionProb ? refill.makeQuestion(rng) : undefined;
        // 補充用隨機色（允許自然連鎖）
        const gem = makeGem(randomColor(rng), question);
        getCell(board, x, fy)!.gem = gem;
        spawns.push({ pos: { x, y: fy }, gem, fromTop: isTopSegment, startY: isTopSegment ? startY : fy });
        startY--;
      }
    }
  }
  return { falls, spawns };
}

/** 盤面上是否有被鎖住（冰 / 水）的格子含寶石 — 提供 HUD / 測試使用。 */
export function lockedCells(board: Board): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < board.h; y++)
    for (let x = 0; x < board.w; x++) {
      const c = getCell(board, x, y)!;
      if (c.obstacle && LOCKING_KINDS.has(c.obstacle.kind)) out.push({ x, y });
    }
  return out;
}
