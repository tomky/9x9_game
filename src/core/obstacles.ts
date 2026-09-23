// 六種障礙：定義、放置、扣血。

import {
  BLOCKER_KINDS,
  Board,
  BREAKABLE_KINDS,
  Obstacle,
  ObstacleKind,
  OBSTACLE_HP,
  Pos,
} from './types';
import { getCell, key, isBlocked } from './board';
import { Rng } from './rng';

export const OBSTACLE_ORDER: ObstacleKind[] = ['tree', 'rock', 'dark', 'boulder', 'water', 'ice'];

/** 該障礙首次登場的 level（對應數字 n 的障礙在 level n−1 出現）。 */
export const OBSTACLE_INTRO_LEVEL: Record<ObstacleKind, number> = {
  tree: 1,
  rock: 2,
  dark: 3,
  boulder: 4,
  water: 5,
  ice: 6,
};

export function makeObstacle(kind: ObstacleKind): Obstacle {
  return { kind, hp: OBSTACLE_HP[kind] };
}

/** 各種障礙數量公式。 */
export function obstacleCounts(level: number): Record<ObstacleKind, number> {
  const at = (kind: ObstacleKind, n: number) => (level >= OBSTACLE_INTRO_LEVEL[kind] ? Math.max(0, n) : 0);
  const counts: Record<ObstacleKind, number> = {
    tree: at('tree', Math.min(8, 1 + level)),
    rock: at('rock', Math.min(6, Math.floor(level / 2))),
    dark: at('dark', Math.min(8, level - 2)),
    boulder: at('boulder', Math.min(4, Math.floor((level - 3) / 2) + 1)),
    water: at('water', Math.min(5, level - 4)),
    ice: at('ice', Math.min(6, level - 5)),
  };
  // 總數上限，超過時依順序削減
  const cap = Math.min(24, 4 + 2 * level);
  let total = OBSTACLE_ORDER.reduce((s, k) => s + counts[k], 0);
  let i = 0;
  while (total > cap) {
    const k = OBSTACLE_ORDER[i % OBSTACLE_ORDER.length];
    if (counts[k] > 0) {
      counts[k]--;
      total--;
    }
    i++;
  }
  return counts;
}

/**
 * 在盤面上放置障礙（只放在第 3 列以下，擋格型不上下相鄰）。
 * 覆蓋型障礙需要該格已有寶石；呼叫前請先填滿寶石。
 */
export function placeObstacles(board: Board, counts: Record<ObstacleKind, number>, rng: Rng): void {
  const minRow = 2;
  for (const kind of OBSTACLE_ORDER) {
    let remaining = counts[kind];
    let tries = 0;
    while (remaining > 0 && tries < 500) {
      tries++;
      const x = rng.int(board.w);
      const y = minRow + rng.int(board.h - minRow);
      const cell = getCell(board, x, y)!;
      if (cell.obstacle) continue;
      if (BLOCKER_KINDS.has(kind)) {
        if (isBlocked(board, x, y - 1) || isBlocked(board, x, y + 1)) continue;
        cell.gem = null;
        cell.obstacle = makeObstacle(kind);
      } else {
        if (!cell.gem) continue;
        cell.obstacle = makeObstacle(kind);
      }
      remaining--;
    }
  }
}

export interface ObstacleHit {
  pos: Pos;
  kind: ObstacleKind;
  destroyed: boolean;
}

/**
 * 對指定格子的障礙扣血（只影響可破障礙）。同一格在同一次呼叫中最多扣 1。
 * @returns 實際被扣血的障礙
 */
export function hitObstacles(board: Board, targets: Iterable<Pos>, force = false): ObstacleHit[] {
  const hits: ObstacleHit[] = [];
  const seen = new Set<string>();
  for (const p of targets) {
    const k = key(p.x, p.y);
    if (seen.has(k)) continue;
    seen.add(k);
    const cell = getCell(board, p.x, p.y);
    if (!cell?.obstacle) continue;
    if (!force && !BREAKABLE_KINDS.has(cell.obstacle.kind)) continue;
    cell.obstacle.hp -= force ? cell.obstacle.hp : 1;
    const destroyed = cell.obstacle.hp <= 0;
    hits.push({ pos: p, kind: cell.obstacle.kind, destroyed });
    if (destroyed) cell.obstacle = null;
  }
  return hits;
}

/** 四鄰格。 */
export function neighbors(board: Board, p: Pos): Pos[] {
  const out: Pos[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (x >= 0 && y >= 0 && x < board.w && y < board.h) out.push({ x, y });
  }
  return out;
}

export function countObstaclesByKind(board: Board): Record<ObstacleKind, number> {
  const counts: Record<ObstacleKind, number> = { tree: 0, rock: 0, dark: 0, boulder: 0, water: 0, ice: 0 };
  for (const c of board.cells) if (c.obstacle) counts[c.obstacle.kind]++;
  return counts;
}
