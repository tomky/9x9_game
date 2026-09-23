// 特殊寶石（直線 / 炸彈 / 彩虹）的引爆範圍與互換組合。

import { Board, Pos, RAINBOW_COLOR } from './types';
import { getCell, inBounds, key, forEachCell } from './board';
import { Rng } from './rng';

export interface ClearPlan {
  /** 要消除的寶石格。 */
  clear: Set<string>;
  /** 特殊效果掃過的範圍（範圍內障礙扣 1 血）。 */
  area: Set<string>;
  /** 因彩虹 / 暴風雪等「同色清除」而要一併移除水窪的格子。 */
  waterClear: Set<string>;
}

export function newPlan(): ClearPlan {
  return { clear: new Set(), area: new Set(), waterClear: new Set() };
}

export function parseKey(k: string): Pos {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

function rowCells(board: Board, y: number): Pos[] {
  const out: Pos[] = [];
  for (let x = 0; x < board.w; x++) out.push({ x, y });
  return out;
}
function colCells(board: Board, x: number): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < board.h; y++) out.push({ x, y });
  return out;
}
export function squareCells(board: Board, cx: number, cy: number, radius: number): Pos[] {
  const out: Pos[] = [];
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++) if (inBounds(board, x, y)) out.push({ x, y });
  return out;
}
export function colorCells(board: Board, color: number): Pos[] {
  const out: Pos[] = [];
  forEachCell(board, (c, x, y) => {
    if (c.gem && c.gem.color === color) out.push({ x, y });
  });
  return out;
}

function mostCommonColor(board: Board): number {
  const counts = new Map<number, number>();
  forEachCell(board, (c) => {
    if (c.gem && c.gem.color !== RAINBOW_COLOR) counts.set(c.gem.color, (counts.get(c.gem.color) ?? 0) + 1);
  });
  let best = 0;
  let bestN = -1;
  for (const [c, n] of counts) if (n > bestN) ((best = c), (bestN = n));
  return best;
}

/** 把一段範圍加入計畫：範圍格記入 area，有寶石的格記入 clear。 */
export function addArea(board: Board, plan: ClearPlan, cells: Pos[], isColorClear = false): void {
  for (const p of cells) {
    const k = key(p.x, p.y);
    plan.area.add(k);
    const cell = getCell(board, p.x, p.y);
    if (cell?.gem) {
      plan.clear.add(k);
      if (isColorClear) plan.waterClear.add(k);
    }
  }
}

/**
 * 從初始消除格開始，遞迴引爆範圍內的特殊寶石，直到沒有新格子。
 */
export function expandSpecials(board: Board, plan: ClearPlan): ClearPlan {
  const processed = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of [...plan.clear]) {
      if (processed.has(k)) continue;
      processed.add(k);
      const p = parseKey(k);
      const gem = getCell(board, p.x, p.y)?.gem;
      if (!gem || gem.special === 'none') continue;
      const before = plan.clear.size;
      switch (gem.special) {
        case 'lineH':
          addArea(board, plan, rowCells(board, p.y));
          break;
        case 'lineV':
          addArea(board, plan, colCells(board, p.x));
          break;
        case 'bomb':
          addArea(board, plan, squareCells(board, p.x, p.y, 1));
          break;
        case 'rainbow':
          addArea(board, plan, colorCells(board, mostCommonColor(board)), true);
          break;
      }
      if (plan.clear.size !== before) changed = true;
    }
  }
  return plan;
}

/**
 * 玩家交換造成的特殊組合。回傳 null 表示不是特殊組合（走一般成三流程）。
 * a、b 為交換後的位置（a = 玩家先選的那顆現在所在位置）。
 */
export function swapComboPlan(board: Board, a: Pos, b: Pos, rng: Rng): ClearPlan | null {
  const ga = getCell(board, a.x, a.y)?.gem;
  const gb = getCell(board, b.x, b.y)?.gem;
  if (!ga || !gb) return null;
  const plan = newPlan();
  const ka = key(a.x, a.y);
  const kb = key(b.x, b.y);

  const rainbowA = ga.color === RAINBOW_COLOR;
  const rainbowB = gb.color === RAINBOW_COLOR;
  if (rainbowA || rainbowB) {
    plan.clear.add(ka);
    plan.clear.add(kb);
    plan.area.add(ka);
    plan.area.add(kb);
    if (rainbowA && rainbowB) {
      addArea(board, plan, squareCells(board, 0, 0, Math.max(board.w, board.h)), true);
      return plan;
    }
    const rainbow = rainbowA ? ga : gb;
    const other = rainbowA ? gb : ga;
    rainbow.special = 'none'; // 彩虹本身已用掉，不再依「最多色」引爆
    const targets = colorCells(board, other.color);
    if (other.special === 'lineH' || other.special === 'lineV') {
      // 該色全變直線寶石後逐一引爆
      for (const p of targets) {
        const g = getCell(board, p.x, p.y)!.gem!;
        g.special = rng.next() < 0.5 ? 'lineH' : 'lineV';
      }
    } else if (other.special === 'bomb') {
      for (const p of targets) getCell(board, p.x, p.y)!.gem!.special = 'bomb';
    }
    addArea(board, plan, targets, true);
    return expandSpecials(board, plan);
  }

  if (ga.special === 'none' || gb.special === 'none') return null;

  // 兩顆特殊寶石互換：以 b（玩家拖到的位置）為中心
  const sa = ga.special;
  const sb = gb.special;
  const isLine = (s: string) => s === 'lineH' || s === 'lineV';
  plan.clear.add(ka);
  plan.clear.add(kb);
  // 這兩顆本身已用掉，不再各自引爆
  ga.special = 'none';
  gb.special = 'none';
  if (isLine(sa) && isLine(sb)) {
    addArea(board, plan, rowCells(board, b.y));
    addArea(board, plan, colCells(board, b.x));
  } else if ((isLine(sa) && sb === 'bomb') || (sa === 'bomb' && isLine(sb))) {
    for (let d = -1; d <= 1; d++) {
      if (inBounds(board, 0, b.y + d)) addArea(board, plan, rowCells(board, b.y + d));
      if (inBounds(board, b.x + d, 0)) addArea(board, plan, colCells(board, b.x + d));
    }
  } else {
    // bomb + bomb → 5×5
    addArea(board, plan, squareCells(board, b.x, b.y, 2));
  }
  return expandSpecials(board, plan);
}
