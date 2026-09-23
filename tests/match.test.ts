import { describe, expect, it } from 'vitest';
import { findMatches } from '../src/core/match';
import { boardFrom, overlay } from './helpers';

describe('findMatches', () => {
  it('偵測橫向與縱向三連', () => {
    const b = boardFrom(['aaab', 'bcdc', 'bdcd', 'bcdc']);
    const m = findMatches(b);
    expect(m).toHaveLength(2);
    const sizes = m.map((g) => g.cells.length).sort();
    expect(sizes).toEqual([3, 3]);
    expect(m.every((g) => g.spawn === 'none')).toBe(true);
  });

  it('四連生成直線寶石，位置優先在玩家交換的格', () => {
    const b = boardFrom(['aaaa', 'bcdc', 'bdcd', 'cbcb']);
    const m = findMatches(b, [{ x: 2, y: 0 }]);
    expect(m).toHaveLength(1);
    expect(m[0].spawn).toBe('lineV'); // 橫 4 連 → 縱線
    expect(m[0].spawnAt).toEqual({ x: 2, y: 0 });
  });

  it('縱 4 連生成橫線寶石', () => {
    const b = boardFrom(['abcd', 'acdc', 'adcd', 'acbc']);
    const m = findMatches(b);
    expect(m[0].spawn).toBe('lineH');
  });

  it('五連生成彩虹', () => {
    const b = boardFrom(['aaaaa', 'bcdcb', 'bdcdb', 'cbcbc']);
    const m = findMatches(b);
    expect(m[0].spawn).toBe('rainbow');
  });

  it('L / T 形合併成一個群組並生成炸彈（交點）', () => {
    const b = boardFrom(['aaab', 'acdc', 'adcd', 'bcbc']);
    const m = findMatches(b);
    expect(m).toHaveLength(1);
    expect(m[0].cells).toHaveLength(5);
    expect(m[0].spawn).toBe('bomb');
    expect(m[0].spawnAt).toEqual({ x: 0, y: 0 });
  });

  it('被擋格障礙隔開不算連線；覆蓋型（黑暗 / 冰）仍可連線', () => {
    const b1 = boardFrom(['aTab', 'bcdc', 'bdcd', 'cbcb']);
    expect(findMatches(b1)).toHaveLength(0);
    const b2 = boardFrom(['aaab', 'bcdc', 'bdcd', 'cbcb'], { '1,0': overlay('dark') });
    expect(findMatches(b2)).toHaveLength(1);
  });
});
