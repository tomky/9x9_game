import { describe, expect, it } from 'vitest';
import { findValidMove, hasValidMove, isValidSwap, shuffleBoard, fillEmpty, emptyBoard } from '../src/core/board';
import { hasMatches } from '../src/core/match';
import { createRng } from '../src/core/rng';
import { boardFrom, overlay, rowsOf } from './helpers';

describe('swap legality', () => {
  it('交換後成三才合法', () => {
    const b = boardFrom(['abaa', 'cdcd', 'dcdc', 'cdcd']);
    expect(isValidSwap(b, { x: 1, y: 0 }, { x: 1, y: 1 })).toBe(false);
    // 把 (1,0)=b 與 (0,0)=a 交換 → 'baaa'
    expect(isValidSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });

  it('非相鄰不可交換', () => {
    const b = boardFrom(['abaa', 'cdcd', 'dcdc', 'cdcd']);
    expect(isValidSwap(b, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });

  it('冰塊 / 水窪鎖住的寶石不可交換', () => {
    const b = boardFrom(['abaa', 'cdcd', 'dcdc', 'cdcd'], { '0,0': overlay('ice') });
    expect(isValidSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
    const b2 = boardFrom(['abaa', 'cdcd', 'dcdc', 'cdcd'], { '1,0': overlay('water') });
    expect(isValidSwap(b2, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });

  it('黑暗不影響交換', () => {
    const b = boardFrom(['abaa', 'cdcd', 'dcdc', 'cdcd'], { '0,0': overlay('dark') });
    expect(isValidSwap(b, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });
});

describe('valid moves and shuffle', () => {
  it('偵測無可行步', () => {
    const b = boardFrom(['abab', 'cdcd', 'abab', 'cdcd']);
    expect(hasValidMove(b)).toBe(false);
    expect(findValidMove(b)).toBeNull();
  });

  it('洗牌後保留障礙位置且有可行步', () => {
    const b = boardFrom(['abab', 'cdTd', 'abab', 'cRcd']);
    const rng = createRng(42);
    expect(shuffleBoard(b, rng)).toBe(true);
    const rows = rowsOf(b);
    expect(rows[1][2]).toBe('T');
    expect(rows[3][1]).toBe('R');
    expect(hasValidMove(b)).toBe(true);
    expect(hasMatches(b)).toBe(false);
  });

  it('fillEmpty 不會產生立即成三', () => {
    const rng = createRng(7);
    for (let i = 0; i < 20; i++) {
      const b = emptyBoard();
      fillEmpty(b, rng);
      expect(hasMatches(b)).toBe(false);
    }
  });
});
