import { describe, expect, it } from 'vitest';
import { applyGravity, applyStep, planStep } from '../src/core/resolve';
import { createRng } from '../src/core/rng';
import { boardFrom, overlay, question, rowsOf, special } from './helpers';
import { getCell } from '../src/core/board';

const refill = { questionProb: 0, makeQuestion: () => ({ a: 2, b: 2, answer: 4 }) };

describe('planStep / applyStep', () => {
  it('列出要出題的格子（左上→右下），特殊寶石生成格不出題', () => {
    const b = boardFrom(['aaaa', 'bcdc', 'bdcd', 'cbcb'], { '0,0': question(2, 3), '3,0': question(2, 4) });
    const step = planStep(b, [{ x: 0, y: 0 }])!;
    expect(step.groups[0].spawnAt).toEqual({ x: 0, y: 0 });
    expect(step.questions).toEqual([{ x: 3, y: 0 }]);
  });

  it('答錯的格子變石頭（最上列也是），其他仍消除', () => {
    const b = boardFrom(['bcdc', 'aaab', 'bdcd', 'cbcb'], { '1,1': question(3, 4) });
    const step = planStep(b)!;
    expect(step.questions).toEqual([{ x: 1, y: 1 }]);
    const res = applyStep(b, step, new Set(['1,1']), 1, createRng(1), refill);
    expect(res.events.some((e) => e.type === 'rockify')).toBe(true);
    expect(getCell(b, 1, 1)!.obstacle?.kind).toBe('rock');
    expect(getCell(b, 1, 1)!.gem).toBeNull();
    // 石頭上方 (1,0) 仍有寶石（重新落下 / 補充），(0,1) 與 (2,1) 被消除後補上
    expect(getCell(b, 0, 1)!.gem).not.toBeNull();
    expect(getCell(b, 2, 1)!.gem).not.toBeNull();

    const top = boardFrom(['aaab', 'bcdc', 'bdcd', 'cbcb'], { '1,0': question(2, 2) });
    const step2 = planStep(top)!;
    applyStep(top, step2, new Set(['1,0']), 1, createRng(1), refill);
    expect(getCell(top, 1, 0)!.obstacle?.kind).toBe('rock');
    expect(top.cells.every((c) => c.gem || c.obstacle)).toBe(true);
  });

  it('相鄰消除對障礙扣血，石頭需兩次', () => {
    const b = boardFrom(['aaab', 'Rcdc', 'bdcd', 'cbcb']);
    const step = planStep(b)!;
    const res = applyStep(b, step, new Set(), 1, createRng(1), refill);
    const hit = res.events.find((e) => e.type === 'obstacleHit');
    expect(hit && hit.type === 'obstacleHit' && hit.hits[0].kind).toBe('rock');
    expect(getCell(b, 0, 1)!.obstacle?.hp).toBe(1);
  });

  it('大岩石不受一般消除影響', () => {
    const b = boardFrom(['aaab', 'Bcdc', 'bdcd', 'cbcb']);
    const step = planStep(b)!;
    applyStep(b, step, new Set(), 1, createRng(1), refill);
    expect(getCell(b, 0, 1)!.obstacle?.kind).toBe('boulder');
  });

  it('冰塊上的寶石成三時融化；黑暗被相鄰消除照亮；水窪留在原地', () => {
    const b = boardFrom(['aaab', 'bcdc', 'bdcd', 'cbcb'], {
      '0,0': overlay('ice'),
      '1,1': overlay('dark'),
      '2,0': overlay('water'),
    });
    const step = planStep(b)!;
    applyStep(b, step, new Set(), 1, createRng(1), refill);
    expect(getCell(b, 0, 0)!.obstacle).toBeNull();
    expect(getCell(b, 1, 1)!.obstacle).toBeNull();
    expect(getCell(b, 2, 0)!.obstacle?.kind).toBe('water');
    expect(getCell(b, 2, 0)!.gem).not.toBeNull();
  });

  it('直線寶石引爆整列並對範圍內障礙扣血', () => {
    const b = boardFrom(['abcd', 'aTcd', 'abdc', 'ccdd'], { '0,0': special('lineH') });
    const step = planStep(b)!;
    // 縱三連 a 在 x=0，(0,0) 是橫線 → 掃第 0 列
    expect([...step.plan.clear].sort()).toEqual(['0,0', '0,1', '0,2', '1,0', '2,0', '3,0'].sort());
    const res = applyStep(b, step, new Set(), 1, createRng(1), refill);
    expect(res.events.find((e) => e.type === 'obstacleHit')).toBeTruthy();
    expect(getCell(b, 1, 1)!.obstacle).toBeNull(); // 小樹被相鄰消除打掉
  });

  it('combo 倍率影響分數', () => {
    const mk = () => boardFrom(['aaab', 'bcdc', 'bdcd', 'cbcb']);
    const s1 = applyStep(mk(), planStep(mk())!, new Set(), 1, createRng(1), refill).score;
    const s2 = applyStep(mk(), planStep(mk())!, new Set(), 3, createRng(1), refill).score;
    expect(s2).toBe(s1 * 2);
  });
});

describe('gravity', () => {
  it('擋格障礙分段：上段從頂補入，下段原地生成', () => {
    const b = boardFrom(['a', '.', 'T', '.', 'b']);
    const { falls, spawns } = applyGravity(b, createRng(3), refill);
    expect(falls).toEqual([{ from: { x: 0, y: 0 }, to: { x: 0, y: 1 }, gemId: expect.any(Number) }]);
    expect(spawns).toHaveLength(2);
    const top = spawns.find((s) => s.pos.y === 0)!;
    const low = spawns.find((s) => s.pos.y === 3)!;
    expect(top.fromTop).toBe(true);
    expect(low.fromTop).toBe(false);
    expect(rowsOf(b)[2]).toBe('T');
    expect(b.cells.every((c) => c.gem || c.obstacle)).toBe(true);
  });
});
