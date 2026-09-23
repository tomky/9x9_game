import { describe, expect, it } from 'vitest';
import { makeChoices, makeQuestion, makeHint, makeTargetedQuestion } from '../src/core/questions';
import { levelConfig, numbersForLevel, questionWeights } from '../src/core/level';
import { obstacleCounts, OBSTACLE_INTRO_LEVEL } from '../src/core/obstacles';
import { emptyStats, isMastered, recordAnswer, syncUnlocks, STREAK_REQUIRED } from '../src/core/mastery';
import { defaultSave, normalizeSave, loadSave, writeSave, KeyValueStore } from '../src/core/storage';
import { createRng } from '../src/core/rng';

describe('questions', () => {
  it('只出本關開放的數字', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion([2, 3], rng);
      expect([q.a, q.b].some((n) => n === 2 || n === 3)).toBe(true);
      expect(q.answer).toBe(q.a * q.b);
    }
  });

  it('bWeight 可以偏向指定組合', () => {
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const q = makeQuestion([7], rng, undefined, (_a, b) => (b === 6 ? 1 : 0));
      expect([q.a, q.b].sort()).toEqual([6, 7]);
    }
  });

  it('針對性出題：優先出缺得最少的數字還沒答對的組合', () => {
    const stats = emptyStats();
    // 2 只差 2×7；3 差很多
    for (const b of [2, 3, 4, 5, 6, 8, 9]) recordAnswer(stats, { a: 2, b, answer: 2 * b }, true);
    const rng = createRng(11);
    for (let i = 0; i < 30; i++) {
      const q = makeTargetedQuestion([2, 3, 4], stats, rng)!;
      expect([q.a, q.b].sort()).toEqual([2, 7]);
    }
  });

  it('針對性出題：組合齊了但連續答對不足時仍出該數字；全部熟練回傳 null', () => {
    const stats = emptyStats();
    for (const b of [2, 3, 4, 5, 6, 7, 8, 9]) {
      recordAnswer(stats, { a: 2, b, answer: 2 * b }, true);
      recordAnswer(stats, { a: 2, b, answer: 2 * b }, false); // streak 歸零
    }
    const rng = createRng(2);
    const q = makeTargetedQuestion([2], stats, rng)!;
    expect([q.a, q.b]).toContain(2);
    stats[2].bestStreak = 5;
    expect(makeTargetedQuestion([2], stats, rng)).toBeNull();
  });

  it('四選一：4 個不重複、含正解、皆為正數', () => {
    const rng = createRng(5);
    for (let a = 2; a <= 9; a++)
      for (let b = 2; b <= 9; b++) {
        const q = { a, b, answer: a * b };
        const choices = makeChoices(q, rng);
        expect(choices).toHaveLength(4);
        expect(new Set(choices).size).toBe(4);
        expect(choices).toContain(a * b);
        expect(choices.every((c) => c > 0)).toBe(true);
      }
  });

  it('提示用相鄰乘法拆解', () => {
    expect(makeHint({ a: 7, b: 8, answer: 56 })).toContain('7×7');
  });
});

describe('level formulas', () => {
  it('開放數字逐關增加到 9', () => {
    expect(numbersForLevel(1)).toEqual([2]);
    expect(numbersForLevel(3)).toEqual([2, 3, 4]);
    expect(numbersForLevel(8)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(numbersForLevel(50)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('答題模式與參數邊界', () => {
    expect(levelConfig(1).answerMode).toBe('choice');
    expect(levelConfig(8).answerMode).toBe('choice');
    expect(levelConfig(9).answerMode).toBe('keypad');
    expect(levelConfig(50).moves).toBeGreaterThanOrEqual(15);
    expect(levelConfig(50).questionProb).toBeLessThanOrEqual(0.25);
  });

  it('障礙依 intro level 出現，總數不超過上限', () => {
    for (let L = 1; L <= 30; L++) {
      const c = obstacleCounts(L);
      for (const kind of Object.keys(c) as (keyof typeof c)[]) {
        if (L < OBSTACLE_INTRO_LEVEL[kind]) expect(c[kind]).toBe(0);
      }
      const total = Object.values(c).reduce((s, n) => s + n, 0);
      expect(total).toBeLessThanOrEqual(Math.min(24, 4 + 2 * L));
    }
    expect(obstacleCounts(1)).toMatchObject({ tree: 2, rock: 0 });
    expect(obstacleCounts(4).boulder).toBeGreaterThan(0);
  });

  it('出題權重偏重最新數字', () => {
    const w = questionWeights(levelConfig(3));
    expect(w[2]).toBe(0.5);
    expect(w[0] + w[1] + w[2]).toBeCloseTo(1);
  });
});

describe('mastery', () => {
  it('需要所有組合答對且連續 5 題', () => {
    const stats = emptyStats();
    for (let b = 2; b <= 9; b++) recordAnswer(stats, { a: 2, b, answer: 2 * b }, true);
    // 8 題連續答對 → bestStreak 8，所有組合皆答對
    expect(isMastered(stats[2])).toBe(true);

    const s2 = emptyStats();
    for (let b = 2; b <= 9; b++) {
      recordAnswer(s2, { a: 3, b, answer: 3 * b }, true);
      recordAnswer(s2, { a: 3, b, answer: 3 * b }, false); // 每題後答錯一次 → streak 歸零
    }
    expect(isMastered(s2[3])).toBe(false);
    expect(s2[3].bestStreak).toBe(1);
  });

  it('a×b 同時計入 a 與 b', () => {
    const stats = emptyStats();
    recordAnswer(stats, { a: 7, b: 8, answer: 56 }, true);
    expect(stats[7].combos[8].correct).toBe(1);
    expect(stats[8].combos[7].correct).toBe(1);
  });

  it('syncUnlocks 只回傳新解鎖', () => {
    const save = defaultSave();
    for (let i = 0; i < STREAK_REQUIRED; i++)
      for (let b = 2; b <= 9; b++) recordAnswer(save.stats, { a: 9, b, answer: 9 * b }, true);
    expect(syncUnlocks(save)).toEqual([9]);
    expect(syncUnlocks(save)).toEqual([]);
    expect(save.unlockedSkills).toEqual([9]);
  });
});

describe('storage', () => {
  const mem = (): KeyValueStore => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  };

  it('round-trip', () => {
    const store = mem();
    const save = defaultSave();
    save.level = 5;
    save.unlockedSkills = [2];
    writeSave(save, store);
    expect(loadSave(store)).toEqual(save);
  });

  it('損壞資料回到預設', () => {
    const store = mem();
    store.setItem('nine-nine-gem-save-v1', '{bad json');
    expect(loadSave(store).level).toBe(1);
    expect(normalizeSave({ level: -3, unlockedSkills: [2, 42] }).unlockedSkills).toEqual([2]);
  });
});
