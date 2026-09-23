// localStorage 存檔（含 schema 版本）。純函式部分可在測試中注入假的 storage。

import { SaveData } from './types';
import { emptyStats, emptyNumberStats, NUMBERS } from './mastery';

export const SAVE_KEY = 'nine-nine-gem-save-v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    level: 1,
    highScore: 0,
    stats: emptyStats(),
    unlockedSkills: [],
    pp: {},
    settings: { answerMode: 'auto', sound: true },
  };
}

/** 把任意（可能是舊版或損壞）的資料補齊成合法 SaveData。 */
export function normalizeSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const save: SaveData = {
    version: 1,
    level: typeof r.level === 'number' && r.level >= 1 ? Math.floor(r.level) : 1,
    highScore: typeof r.highScore === 'number' ? r.highScore : 0,
    stats: base.stats,
    unlockedSkills: Array.isArray(r.unlockedSkills) ? r.unlockedSkills.filter((n) => NUMBERS.includes(n)) : [],
    pp: r.pp && typeof r.pp === 'object' ? { ...r.pp } : {},
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
  if (r.stats && typeof r.stats === 'object') {
    for (const n of NUMBERS) {
      const s = (r.stats as Record<number, unknown>)[n];
      if (!s || typeof s !== 'object') continue;
      const ns = emptyNumberStats();
      const src = s as Partial<typeof ns>;
      ns.streak = typeof src.streak === 'number' ? src.streak : 0;
      ns.bestStreak = typeof src.bestStreak === 'number' ? src.bestStreak : 0;
      if (src.combos && typeof src.combos === 'object') {
        for (const b of NUMBERS) {
          const c = (src.combos as Record<number, { correct?: number; wrong?: number }>)[b];
          if (c) ns.combos[b] = { correct: c.correct ?? 0, wrong: c.wrong ?? 0 };
        }
      }
      save.stats[n] = ns;
    }
  }
  return save;
}

export function loadSave(store: KeyValueStore | null = getStore()): SaveData {
  if (!store) return defaultSave();
  try {
    const text = store.getItem(SAVE_KEY);
    if (!text) return defaultSave();
    return normalizeSave(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: SaveData, store: KeyValueStore | null = getStore()): void {
  if (!store) return;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* 私密模式等情況忽略 */
  }
}

export function clearSave(store: KeyValueStore | null = getStore()): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

function getStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
