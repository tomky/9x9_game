import { Board, Cell, Gem, ObstacleKind } from '../src/core/types';
import { makeGem } from '../src/core/board';
import { makeObstacle } from '../src/core/obstacles';

/**
 * 用字串畫盤面：
 *   'a'..'f' = 顏色 0..5 寶石
 *   'T' 小樹 'R' 石頭 'B' 大岩石（擋格）
 *   大寫 'A'..'F' 後面接修飾符不易表達，改用 spec 物件指定覆蓋障礙 / 特殊 / 題目。
 *   '.' = 空格
 */
export function boardFrom(rows: string[], mods: Partial<Record<string, (cell: Cell) => void>> = {}): Board {
  const h = rows.length;
  const w = rows[0].length;
  const cells: Cell[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const cell: Cell = { gem: null, obstacle: null };
      if (ch >= 'a' && ch <= 'f') cell.gem = makeGem(ch.charCodeAt(0) - 97);
      else if (ch === 'T') cell.obstacle = makeObstacle('tree');
      else if (ch === 'R') cell.obstacle = makeObstacle('rock');
      else if (ch === 'B') cell.obstacle = makeObstacle('boulder');
      const mod = mods[`${x},${y}`];
      if (mod) mod(cell);
      cells.push(cell);
    }
  }
  return { w, h, cells };
}

export function rowsOf(board: Board): string[] {
  const out: string[] = [];
  for (let y = 0; y < board.h; y++) {
    let s = '';
    for (let x = 0; x < board.w; x++) {
      const c = board.cells[y * board.w + x];
      if (c.obstacle?.kind === 'tree') s += 'T';
      else if (c.obstacle?.kind === 'rock') s += 'R';
      else if (c.obstacle?.kind === 'boulder') s += 'B';
      else if (c.gem) s += c.gem.color < 0 ? '*' : String.fromCharCode(97 + c.gem.color);
      else s += '.';
    }
    out.push(s);
  }
  return out;
}

export function overlay(kind: ObstacleKind) {
  return (cell: Cell) => {
    cell.obstacle = makeObstacle(kind);
  };
}

export function special(sp: Gem['special']) {
  return (cell: Cell) => {
    if (cell.gem) cell.gem.special = sp;
  };
}

export function question(a: number, b: number) {
  return (cell: Cell) => {
    if (cell.gem) cell.gem.question = { a, b, answer: a * b };
  };
}
