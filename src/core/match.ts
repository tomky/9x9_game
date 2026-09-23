// 成三偵測與形狀判定。

import { Board, Color, MatchGroup, Pos, RAINBOW_COLOR, Special } from './types';
import { getCell, key } from './board';

interface Run {
  cells: Pos[];
  color: Color;
  dir: 'h' | 'v';
}

function colorAt(board: Board, x: number, y: number): Color | null {
  const cell = getCell(board, x, y);
  if (!cell || !cell.gem) return null;
  if (cell.obstacle && cell.obstacle.kind !== 'dark' && cell.obstacle.kind !== 'water' && cell.obstacle.kind !== 'ice') {
    return null;
  }
  if (cell.gem.color === RAINBOW_COLOR) return null;
  return cell.gem.color;
}

function scanRuns(board: Board): Run[] {
  const runs: Run[] = [];
  // 橫向
  for (let y = 0; y < board.h; y++) {
    let x = 0;
    while (x < board.w) {
      const c = colorAt(board, x, y);
      let end = x + 1;
      if (c !== null) {
        while (end < board.w && colorAt(board, end, y) === c) end++;
        if (end - x >= 3) {
          const cells: Pos[] = [];
          for (let i = x; i < end; i++) cells.push({ x: i, y });
          runs.push({ cells, color: c, dir: 'h' });
        }
      }
      x = end;
    }
  }
  // 縱向
  for (let x = 0; x < board.w; x++) {
    let y = 0;
    while (y < board.h) {
      const c = colorAt(board, x, y);
      let end = y + 1;
      if (c !== null) {
        while (end < board.h && colorAt(board, x, end) === c) end++;
        if (end - y >= 3) {
          const cells: Pos[] = [];
          for (let i = y; i < end; i++) cells.push({ x, y: i });
          runs.push({ cells, color: c, dir: 'v' });
        }
      }
      y = end;
    }
  }
  return runs;
}

/**
 * 找出盤面上所有成三群組。重疊的橫縱段落合併為一個 group（L / T 形）。
 * @param preferred 玩家交換的兩格：特殊寶石優先生成在這裡。
 */
export function findMatches(board: Board, preferred: Pos[] = []): MatchGroup[] {
  const runs = scanRuns(board);
  if (runs.length === 0) return [];

  // 併查集合併有共用格子的 runs
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const cellOwner = new Map<string, number>();
  runs.forEach((run, i) => {
    for (const c of run.cells) {
      const k = key(c.x, c.y);
      const other = cellOwner.get(k);
      if (other !== undefined) parent[find(i)] = find(other);
      else cellOwner.set(k, i);
    }
  });

  const groups = new Map<number, Run[]>();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(run);
  });

  const result: MatchGroup[] = [];
  for (const groupRuns of groups.values()) {
    const seen = new Set<string>();
    const cells: Pos[] = [];
    for (const run of groupRuns) {
      for (const c of run.cells) {
        const k = key(c.x, c.y);
        if (!seen.has(k)) {
          seen.add(k);
          cells.push(c);
        }
      }
    }
    const color = groupRuns[0].color;
    const longest = Math.max(...groupRuns.map((r) => r.cells.length));
    const hasH = groupRuns.some((r) => r.dir === 'h');
    const hasV = groupRuns.some((r) => r.dir === 'v');

    let spawn: Special = 'none';
    if (longest >= 5) spawn = 'rainbow';
    else if (hasH && hasV) spawn = 'bomb';
    else if (longest === 4) spawn = hasH ? 'lineV' : 'lineH';

    let spawnAt: Pos | null = null;
    if (spawn !== 'none') {
      spawnAt =
        preferred.find((p) => seen.has(key(p.x, p.y))) ??
        // 連鎖時：最下方、再最左
        cells.reduce((best, c) => (c.y > best.y || (c.y === best.y && c.x < best.x) ? c : best), cells[0]);
      if (hasH && hasV && !preferred.some((p) => seen.has(key(p.x, p.y)))) {
        // L/T 形的交點最直觀
        const cross = cells.find(
          (c) =>
            groupRuns.filter((r) => r.cells.some((rc) => rc.x === c.x && rc.y === c.y)).length >= 2,
        );
        if (cross) spawnAt = cross;
      }
    }
    result.push({ cells, color, spawn, spawnAt });
  }
  return result;
}

export function hasMatches(board: Board): boolean {
  return scanRuns(board).length > 0;
}
