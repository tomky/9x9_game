// level → 關卡參數公式。所有數值集中在這裡調整。

import { AnswerMode, LevelConfig, NumberStats } from './types';
import { obstacleCounts } from './obstacles';

export const KEYPAD_FROM_LEVEL = 9;

export function numbersForLevel(level: number): number[] {
  const max = Math.min(9, level + 1);
  const out: number[] = [];
  for (let n = 2; n <= max; n++) out.push(n);
  return out;
}

export function targetScore(level: number): number {
  return 2000 + 800 * level;
}

export function movesForLevel(level: number): number {
  return Math.max(15, 30 - Math.floor(level / 3));
}

export function questionProb(level: number): number {
  return Math.min(0.25, 0.08 + 0.015 * level);
}

export function initialQuestions(level: number): number {
  return 3 + Math.floor(level / 2);
}

export function answerModeForLevel(level: number): AnswerMode {
  return level >= KEYPAD_FROM_LEVEL ? 'keypad' : 'choice';
}

export function levelConfig(level: number): LevelConfig {
  return {
    level,
    numbers: numbersForLevel(level),
    targetScore: targetScore(level),
    moves: movesForLevel(level),
    obstacles: obstacleCounts(level),
    questionProb: questionProb(level),
    initialQuestions: initialQuestions(level),
    answerMode: answerModeForLevel(level),
  };
}

/**
 * 出題權重：
 * - level ≤ 8：最新加入的數字 50%，其餘均分。
 * - level ≥ 9：答錯率最高的兩個數字各 25%，其餘均分。
 */
export function questionWeights(config: LevelConfig, stats?: Record<number, NumberStats>): number[] {
  const nums = config.numbers;
  if (nums.length === 1) return [1];
  if (config.level <= 8) {
    const rest = 0.5 / (nums.length - 1);
    return nums.map((n, i) => (i === nums.length - 1 ? 0.5 : rest));
  }
  const errRate = (n: number) => {
    const s = stats?.[n];
    if (!s) return 0;
    let c = 0;
    let w = 0;
    for (const combo of Object.values(s.combos)) {
      c += combo.correct;
      w += combo.wrong;
    }
    return c + w === 0 ? 0 : w / (c + w);
  };
  const ranked = [...nums].sort((a, b) => errRate(b) - errRate(a));
  const hard = new Set(ranked.slice(0, 2));
  const rest = 0.5 / (nums.length - 2);
  return nums.map((n) => (hard.has(n) ? 0.25 : rest));
}
