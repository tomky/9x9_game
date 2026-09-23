// 八個寶可夢主題技能：定義、目標驗證、效果。

import { Board, ObstacleKind, Pos, RAINBOW_COLOR, SkillId } from './types';
import { getCell, forEachCell } from './board';
import { ClearPlan, addArea, colorCells, expandSpecials, newPlan, squareCells } from './specials';
import { hitObstacles, ObstacleHit } from './obstacles';
import { Rng } from './rng';

export type TargetType = 'none' | 'cell3x3' | 'row' | 'col' | 'gem' | 'boulder';

export interface SkillDef {
  id: SkillId;
  name: string;
  en: string;
  obstacle: ObstacleKind | null;
  target: TargetType;
  maxPP: number;
  startPP: number;
  description: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  2: { id: 2, name: '居合斬', en: 'Cut', obstacle: 'tree', target: 'cell3x3', maxPP: 3, startPP: 2, description: '砍掉 3×3 範圍內所有小樹' },
  3: { id: 3, name: '碎岩', en: 'Rock Smash', obstacle: 'rock', target: 'cell3x3', maxPP: 3, startPP: 2, description: '打碎 3×3 範圍內所有石頭' },
  4: { id: 4, name: '閃光', en: 'Flash', obstacle: 'dark', target: 'none', maxPP: 3, startPP: 2, description: '照亮全盤黑暗，下一題給提示' },
  5: { id: 5, name: '怪力', en: 'Strength', obstacle: 'boulder', target: 'boulder', maxPP: 2, startPP: 1, description: '搬走一顆大岩石' },
  6: { id: 6, name: '衝浪', en: 'Surf', obstacle: 'water', target: 'row', maxPP: 2, startPP: 1, description: '沖走整列水窪並清除整列寶石' },
  7: { id: 7, name: '火焰放射', en: 'Flamethrower', obstacle: 'ice', target: 'col', maxPP: 2, startPP: 1, description: '融化整行冰塊並清除整行寶石' },
  8: { id: 8, name: '暴風雪', en: 'Blizzard', obstacle: null, target: 'gem', maxPP: 2, startPP: 1, description: '清除全盤同色寶石' },
  9: { id: 9, name: '十萬伏特', en: 'Thunderbolt', obstacle: null, target: 'cell3x3', maxPP: 1, startPP: 1, description: '轟掉 3×3 內所有寶石與障礙' },
};

export const SKILL_IDS: SkillId[] = [2, 3, 4, 5, 6, 7, 8, 9];

function hasObstacle(board: Board, kind: ObstacleKind): boolean {
  return board.cells.some((c) => c.obstacle?.kind === kind);
}

/** 盤面上是否存在此技能的合法目標。 */
export function hasValidTarget(board: Board, id: SkillId): boolean {
  switch (id) {
    case 2:
      return hasObstacle(board, 'tree');
    case 3:
      return hasObstacle(board, 'rock');
    case 4:
      return true; // 閃光永遠可用（提示效果）
    case 5:
      return hasObstacle(board, 'boulder');
    case 6:
      return hasObstacle(board, 'water');
    case 7:
      return hasObstacle(board, 'ice');
    case 8:
      return board.cells.some((c) => c.gem && c.gem.color !== RAINBOW_COLOR);
    case 9:
      return true;
  }
}

/** 點選的格子是否為合法目標。 */
export function isValidTarget(board: Board, id: SkillId, pos: Pos): boolean {
  const cell = getCell(board, pos.x, pos.y);
  if (!cell) return false;
  const def = SKILLS[id];
  switch (def.target) {
    case 'none':
      return true;
    case 'boulder':
      return cell.obstacle?.kind === 'boulder';
    case 'gem':
      return !!cell.gem && cell.gem.color !== RAINBOW_COLOR;
    case 'cell3x3':
      if (id === 2) return squareCells(board, pos.x, pos.y, 1).some((p) => getCell(board, p.x, p.y)!.obstacle?.kind === 'tree');
      if (id === 3) return squareCells(board, pos.x, pos.y, 1).some((p) => getCell(board, p.x, p.y)!.obstacle?.kind === 'rock');
      return true;
    case 'row':
      return true;
    case 'col':
      return true;
  }
}

/** 技能目標預覽會覆蓋的格子（供 renderer 高亮）。 */
export function previewCells(board: Board, id: SkillId, pos: Pos): Pos[] {
  const def = SKILLS[id];
  switch (def.target) {
    case 'cell3x3':
      return squareCells(board, pos.x, pos.y, 1);
    case 'row': {
      const out: Pos[] = [];
      for (let x = 0; x < board.w; x++) out.push({ x, y: pos.y });
      return out;
    }
    case 'col': {
      const out: Pos[] = [];
      for (let y = 0; y < board.h; y++) out.push({ x: pos.x, y });
      return out;
    }
    case 'gem': {
      const g = getCell(board, pos.x, pos.y)?.gem;
      return g && g.color !== RAINBOW_COLOR ? colorCells(board, g.color) : [];
    }
    case 'boulder':
      return [pos];
    case 'none':
      return [];
  }
}

export interface SkillEffect {
  plan: ClearPlan;
  /** 技能直接移除的障礙（計分用）。 */
  hits: ObstacleHit[];
  /** 閃光：下一題提示。 */
  flash: boolean;
}

function removeObstaclesOfKind(board: Board, cells: Pos[], kind: ObstacleKind): ObstacleHit[] {
  const targets = cells.filter((p) => getCell(board, p.x, p.y)?.obstacle?.kind === kind);
  return hitObstacles(board, targets, true);
}

/** 套用技能到盤面（障礙直接移除），回傳要交給 resolve 的消除計畫。 */
export function applySkill(board: Board, id: SkillId, pos: Pos, _rng: Rng): SkillEffect {
  const plan = newPlan();
  let hits: ObstacleHit[] = [];
  let flash = false;
  switch (id) {
    case 2:
      hits = removeObstaclesOfKind(board, squareCells(board, pos.x, pos.y, 1), 'tree');
      break;
    case 3:
      hits = removeObstaclesOfKind(board, squareCells(board, pos.x, pos.y, 1), 'rock');
      break;
    case 4: {
      const all: Pos[] = [];
      forEachCell(board, (_c, x, y) => all.push({ x, y }));
      hits = removeObstaclesOfKind(board, all, 'dark');
      flash = true;
      break;
    }
    case 5:
      hits = removeObstaclesOfKind(board, [pos], 'boulder');
      break;
    case 6: {
      const row: Pos[] = [];
      for (let x = 0; x < board.w; x++) row.push({ x, y: pos.y });
      hits = removeObstaclesOfKind(board, row, 'water');
      addArea(board, plan, row);
      expandSpecials(board, plan);
      break;
    }
    case 7: {
      const col: Pos[] = [];
      for (let y = 0; y < board.h; y++) col.push({ x: pos.x, y });
      hits = removeObstaclesOfKind(board, col, 'ice');
      addArea(board, plan, col);
      expandSpecials(board, plan);
      break;
    }
    case 8: {
      const g = getCell(board, pos.x, pos.y)?.gem;
      if (g) {
        addArea(board, plan, colorCells(board, g.color), true);
        expandSpecials(board, plan);
      }
      break;
    }
    case 9: {
      const area = squareCells(board, pos.x, pos.y, 1);
      hits = hitObstacles(board, area, true);
      addArea(board, plan, area);
      expandSpecials(board, plan);
      break;
    }
  }
  return { plan, hits, flash };
}
