import { describe, expect, it } from 'vitest';
import { applySkill, hasValidTarget, isValidTarget, previewCells } from '../src/core/skills';
import { swapComboPlan } from '../src/core/specials';
import { createRng } from '../src/core/rng';
import { getCell } from '../src/core/board';
import { boardFrom, overlay, special } from './helpers';

const rng = createRng(9);

describe('skills', () => {
  it('居合斬：3×3 內小樹歸零，無小樹時停用', () => {
    const b = boardFrom(['abcd', 'aTcT', 'abdc', 'ccdd']);
    expect(hasValidTarget(b, 2)).toBe(true);
    expect(isValidTarget(b, 2, { x: 0, y: 0 })).toBe(true); // 3×3 含 (1,1)
    expect(isValidTarget(b, 2, { x: 3, y: 3 })).toBe(false);
    const eff = applySkill(b, 2, { x: 1, y: 1 }, rng);
    expect(eff.hits.map((h) => h.kind)).toEqual(['tree']);
    expect(getCell(b, 1, 1)!.obstacle).toBeNull();
    expect(getCell(b, 3, 1)!.obstacle?.kind).toBe('tree');
    expect(eff.plan.clear.size).toBe(0);
    const b2 = boardFrom(['abcd', 'abcd', 'abdc', 'ccdd']);
    expect(hasValidTarget(b2, 2)).toBe(false);
  });

  it('碎岩：石頭直接歸零（不管血量）', () => {
    const b = boardFrom(['abcd', 'aRcd', 'abdc', 'ccdd']);
    applySkill(b, 3, { x: 1, y: 1 }, rng);
    expect(getCell(b, 1, 1)!.obstacle).toBeNull();
  });

  it('閃光：照亮全盤黑暗並標記提示', () => {
    const b = boardFrom(['abcd', 'abcd', 'abdc', 'ccdd'], { '0,0': overlay('dark'), '3,3': overlay('dark') });
    const eff = applySkill(b, 4, { x: 0, y: 0 }, rng);
    expect(eff.flash).toBe(true);
    expect(eff.hits).toHaveLength(2);
    expect(b.cells.every((c) => c.obstacle?.kind !== 'dark')).toBe(true);
  });

  it('怪力：只能點大岩石', () => {
    const b = boardFrom(['abcd', 'aBcd', 'abdc', 'ccdd']);
    expect(isValidTarget(b, 5, { x: 0, y: 0 })).toBe(false);
    expect(isValidTarget(b, 5, { x: 1, y: 1 })).toBe(true);
    applySkill(b, 5, { x: 1, y: 1 }, rng);
    expect(getCell(b, 1, 1)!.obstacle).toBeNull();
  });

  it('衝浪：整列水窪移除、整列寶石清除', () => {
    const b = boardFrom(['abcd', 'abcd', 'abdc', 'ccdd'], { '0,1': overlay('water'), '2,1': overlay('water'), '0,2': overlay('water') });
    const eff = applySkill(b, 6, { x: 0, y: 1 }, rng);
    expect(eff.hits).toHaveLength(2);
    expect([...eff.plan.clear].sort()).toEqual(['0,1', '1,1', '2,1', '3,1']);
    expect(getCell(b, 0, 2)!.obstacle?.kind).toBe('water');
  });

  it('火焰放射：整行冰塊融化', () => {
    const b = boardFrom(['abcd', 'abcd', 'abdc', 'ccdd'], { '2,0': overlay('ice'), '2,3': overlay('ice') });
    const eff = applySkill(b, 7, { x: 2, y: 0 }, rng);
    expect(eff.hits).toHaveLength(2);
    expect(eff.plan.clear.size).toBe(4);
  });

  it('暴風雪：全盤同色', () => {
    const b = boardFrom(['abcd', 'abcd', 'abdc', 'ccdd']);
    const eff = applySkill(b, 8, { x: 0, y: 0 }, rng);
    expect(eff.plan.clear.size).toBe(3);
    expect(previewCells(b, 8, { x: 0, y: 0 })).toHaveLength(3);
  });

  it('十萬伏特：3×3 內所有障礙（含大岩石、水窪）歸零', () => {
    const b = boardFrom(['abcd', 'aBcd', 'abdc', 'ccdd'], { '0,0': overlay('water') });
    const eff = applySkill(b, 9, { x: 1, y: 1 }, rng);
    expect(eff.hits.map((h) => h.kind).sort()).toEqual(['boulder', 'water']);
    expect(eff.plan.clear.size).toBe(8); // 9 格扣掉大岩石那格
  });
});

describe('special swap combos', () => {
  it('彩虹 + 一般色 → 全盤該色', () => {
    const b = boardFrom(['abcd', 'abcd', 'abdc', 'ccdd'], { '0,0': (c) => (c.gem = { id: 999, color: -1, special: 'rainbow' }) });
    const plan = swapComboPlan(b, { x: 0, y: 0 }, { x: 1, y: 0 }, rng)!;
    // b 色：(1,0),(1,1),(1,2) + 彩虹本身
    expect(plan.clear.size).toBe(4);
    expect(plan.waterClear.has('1,1')).toBe(true);
  });

  it('直線 + 直線 → 十字', () => {
    const b = boardFrom(['abcd', 'abcd', 'abdc', 'ccdd'], { '1,1': special('lineH'), '2,1': special('lineV') });
    const plan = swapComboPlan(b, { x: 1, y: 1 }, { x: 2, y: 1 }, rng)!;
    expect(plan.clear.size).toBe(7); // 列 4 + 行 4 − 交點
  });

  it('炸彈 + 炸彈 → 5×5', () => {
    const b = boardFrom(['abcdab', 'abcdab', 'abdcab', 'ccddab', 'abcdab', 'abcdab'], { '2,2': special('bomb'), '3,2': special('bomb') });
    const plan = swapComboPlan(b, { x: 2, y: 2 }, { x: 3, y: 2 }, rng)!;
    expect(plan.clear.size).toBe(25);
  });

  it('一般 + 一般 → null', () => {
    const b = boardFrom(['abcd', 'abcd', 'abdc', 'ccdd']);
    expect(swapComboPlan(b, { x: 0, y: 0 }, { x: 1, y: 0 }, rng)).toBeNull();
  });
});
