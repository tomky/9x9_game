// 盤面建立、存取、交換合法性、可行步檢查、洗牌。

import {
  BLOCKER_KINDS,
  Board,
  BOARD_H,
  BOARD_W,
  Cell,
  COLOR_COUNT,
  Gem,
  LOCKING_KINDS,
  Pos,
  Question,
  RAINBOW_COLOR,
} from './types';
import { Rng } from './rng';
import { hasMatches } from './match';

let nextGemId = 1;
export function newGemId(): number {
  return nextGemId++;
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function inBounds(board: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.w && y < board.h;
}

export function getCell(board: Board, x: number, y: number): Cell | null {
  if (!inBounds(board, x, y)) return null;
  return board.cells[y * board.w + x];
}

export function setCell(board: Board, x: number, y: number, cell: Cell): void {
  board.cells[y * board.w + x] = cell;
}

export function emptyBoard(w = BOARD_W, h = BOARD_H): Board {
  const cells: Cell[] = [];
  for (let i = 0; i < w * h; i++) cells.push({ gem: null, obstacle: null });
  return { w, h, cells };
}

export function cloneBoard(board: Board): Board {
  return {
    w: board.w,
    h: board.h,
    cells: board.cells.map((c) => ({
      gem: c.gem ? { ...c.gem, question: c.gem.question ? { ...c.gem.question } : undefined } : null,
      obstacle: c.obstacle ? { ...c.obstacle } : null,
    })),
  };
}

export function makeGem(color: number, question?: Question): Gem {
  return { id: newGemId(), color, special: 'none', question };
}

export function randomColor(rng: Rng): number {
  return rng.int(COLOR_COUNT);
}

/** 該格是否為擋格障礙（無寶石）。 */
export function isBlocked(board: Board, x: number, y: number): boolean {
  const c = getCell(board, x, y);
  return !!c && !!c.obstacle && BLOCKER_KINDS.has(c.obstacle.kind);
}

/** 該格寶石是否可被玩家選取 / 交換。 */
export function isSelectable(board: Board, x: number, y: number): boolean {
  const c = getCell(board, x, y);
  if (!c || !c.gem) return false;
  if (c.obstacle && LOCKING_KINDS.has(c.obstacle.kind)) return false;
  return true;
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function swapGems(board: Board, a: Pos, b: Pos): void {
  const ca = getCell(board, a.x, a.y)!;
  const cb = getCell(board, b.x, b.y)!;
  const tmp = ca.gem;
  ca.gem = cb.gem;
  cb.gem = tmp;
}

/** 兩顆寶石交換是否構成特殊寶石組合（不需成三即生效）。 */
export function isSpecialCombo(board: Board, a: Pos, b: Pos): boolean {
  const ga = getCell(board, a.x, a.y)?.gem;
  const gb = getCell(board, b.x, b.y)?.gem;
  if (!ga || !gb) return false;
  if (ga.color === RAINBOW_COLOR || gb.color === RAINBOW_COLOR) return true;
  return ga.special !== 'none' && gb.special !== 'none';
}

/** 交換 a、b 後是否為合法的一步（成三或特殊組合）。不改變盤面。 */
export function isValidSwap(board: Board, a: Pos, b: Pos): boolean {
  if (!isAdjacent(a, b)) return false;
  if (!isSelectable(board, a.x, a.y) || !isSelectable(board, b.x, b.y)) return false;
  if (isSpecialCombo(board, a, b)) return true;
  swapGems(board, a, b);
  const ok = hasMatches(board);
  swapGems(board, a, b);
  return ok;
}

/** 找出一個可行步驟（提示用）；沒有回傳 null。 */
export function findValidMove(board: Board): [Pos, Pos] | null {
  for (let y = 0; y < board.h; y++) {
    for (let x = 0; x < board.w; x++) {
      const a = { x, y };
      const right = { x: x + 1, y };
      const down = { x, y: y + 1 };
      if (inBounds(board, right.x, right.y) && isValidSwap(board, a, right)) return [a, right];
      if (inBounds(board, down.x, down.y) && isValidSwap(board, a, down)) return [a, down];
    }
  }
  return null;
}

export function hasValidMove(board: Board): boolean {
  return findValidMove(board) !== null;
}

/**
 * 重新洗牌：只打亂「可移動」的寶石位置（障礙位置與鎖住的寶石不動），
 * 直到沒有立即成三且至少有一個可行步驟。
 */
export function shuffleBoard(board: Board, rng: Rng, maxTries = 200): boolean {
  const movable: Pos[] = [];
  for (let y = 0; y < board.h; y++) {
    for (let x = 0; x < board.w; x++) {
      const c = getCell(board, x, y)!;
      if (c.gem && !(c.obstacle && LOCKING_KINDS.has(c.obstacle.kind))) movable.push({ x, y });
    }
  }
  const gems = movable.map((p) => getCell(board, p.x, p.y)!.gem!);
  for (let t = 0; t < maxTries; t++) {
    rng.shuffle(gems);
    movable.forEach((p, i) => (getCell(board, p.x, p.y)!.gem = gems[i]));
    if (!hasMatches(board) && hasValidMove(board)) return true;
  }
  // 最後手段：允許有立即成三（會被 resolve 消掉），只要有可行步
  return hasValidMove(board);
}

/** 填滿所有「無寶石且非擋格」的格子，避免立即成三。 */
export function fillEmpty(
  board: Board,
  rng: Rng,
  makeQuestion?: (rng: Rng) => Question | undefined,
): void {
  for (let y = 0; y < board.h; y++) {
    for (let x = 0; x < board.w; x++) {
      const c = getCell(board, x, y)!;
      if (c.gem || isBlocked(board, x, y)) continue;
      c.gem = makeGem(pickNonMatchingColor(board, x, y, rng), makeQuestion?.(rng));
    }
  }
}

/** 挑一個放在 (x,y) 不會立刻與左 / 上形成三連的顏色。 */
export function pickNonMatchingColor(board: Board, x: number, y: number, rng: Rng): number {
  const colors = [...Array(COLOR_COUNT).keys()];
  rng.shuffle(colors);
  const colorOf = (px: number, py: number) => getCell(board, px, py)?.gem?.color ?? null;
  for (const col of colors) {
    const left2 = colorOf(x - 1, y) === col && colorOf(x - 2, y) === col;
    const up2 = colorOf(x, y - 1) === col && colorOf(x, y - 2) === col;
    const right2 = colorOf(x + 1, y) === col && colorOf(x + 2, y) === col;
    const down2 = colorOf(x, y + 1) === col && colorOf(x, y + 2) === col;
    const midH = colorOf(x - 1, y) === col && colorOf(x + 1, y) === col;
    const midV = colorOf(x, y - 1) === col && colorOf(x, y + 1) === col;
    if (!left2 && !up2 && !right2 && !down2 && !midH && !midV) return col;
  }
  return colors[0];
}

export function countObstacles(board: Board): number {
  return board.cells.filter((c) => c.obstacle).length;
}

export function forEachCell(board: Board, fn: (cell: Cell, x: number, y: number) => void): void {
  for (let y = 0; y < board.h; y++) for (let x = 0; x < board.w; x++) fn(getCell(board, x, y)!, x, y);
}
