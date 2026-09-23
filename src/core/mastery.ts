// 答題統計、連續答對、熟練判定與技能解鎖。

import { NumberStats, Question, SaveData, SkillId } from './types';

export const STREAK_REQUIRED = 5;
export const NUMBERS: number[] = [2, 3, 4, 5, 6, 7, 8, 9];

export function emptyNumberStats(): NumberStats {
  const combos: Record<number, { correct: number; wrong: number }> = {};
  for (const b of NUMBERS) combos[b] = { correct: 0, wrong: 0 };
  return { combos, streak: 0, bestStreak: 0 };
}

export function emptyStats(): Record<number, NumberStats> {
  const out: Record<number, NumberStats> = {};
  for (const n of NUMBERS) out[n] = emptyNumberStats();
  return out;
}

/**
 * 記錄一次答題。a×b 同時計入 a 與 b 的統計（交換律）。
 * @returns 本次新達成熟練的數字
 */
export function recordAnswer(stats: Record<number, NumberStats>, q: Question, correct: boolean): number[] {
  const newlyMastered: number[] = [];
  const pairs: [number, number][] = q.a === q.b ? [[q.a, q.b]] : [[q.a, q.b], [q.b, q.a]];
  for (const [n, b] of pairs) {
    if (n < 2 || n > 9 || b < 2 || b > 9) continue;
    const s = (stats[n] ??= emptyNumberStats());
    const wasMastered = isMastered(s);
    const combo = (s.combos[b] ??= { correct: 0, wrong: 0 });
    if (correct) {
      combo.correct++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    } else {
      combo.wrong++;
      s.streak = 0;
    }
    if (!wasMastered && isMastered(s)) newlyMastered.push(n);
  }
  return newlyMastered;
}

export function allCombosDone(s: NumberStats): boolean {
  return NUMBERS.every((b) => (s.combos[b]?.correct ?? 0) >= 1);
}

/** 尚未答對過的 b（2..9）。 */
export function missingCombos(s: NumberStats): number[] {
  return NUMBERS.filter((b) => (s.combos[b]?.correct ?? 0) < 1);
}

export function combosDone(s: NumberStats): number {
  return NUMBERS.filter((b) => (s.combos[b]?.correct ?? 0) >= 1).length;
}

export function isMastered(s: NumberStats): boolean {
  return allCombosDone(s) && s.bestStreak >= STREAK_REQUIRED;
}

/** 依統計同步已解鎖技能清單；回傳新解鎖的技能。 */
export function syncUnlocks(save: SaveData): SkillId[] {
  const newly: SkillId[] = [];
  for (const n of NUMBERS) {
    const id = n as SkillId;
    if (!save.unlockedSkills.includes(id) && isMastered(save.stats[n])) {
      save.unlockedSkills.push(id);
      newly.push(id);
    }
  }
  return newly;
}
