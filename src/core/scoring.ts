// 計分表。所有分數皆再乘 combo 倍率。

import { ObstacleKind, Question } from './types';

export const GEM_SCORE = 10;
export const RUN_BONUS: Record<number, number> = { 3: 30, 4: 60, 5: 120 };
export const EFFECT_GEM_SCORE = 15;
export const OBSTACLE_SCORE: Record<ObstacleKind, number> = {
  tree: 50,
  rock: 80,
  dark: 30,
  water: 60,
  ice: 40,
  boulder: 150,
};
export const MOVE_LEFT_BONUS = 100;

export function comboMultiplier(combo: number): number {
  return 1 + 0.5 * Math.max(0, combo - 1);
}

/** 三連群組分數（未乘倍率）。 */
export function matchGroupScore(size: number): number {
  const bonus = RUN_BONUS[Math.min(5, size)] ?? RUN_BONUS[5];
  return size * GEM_SCORE + bonus;
}

/** 答對題目的額外分：大題多一點。 */
export function questionBonus(q: Question): number {
  return Math.round(200 + (20 * q.a * q.b) / 9);
}
