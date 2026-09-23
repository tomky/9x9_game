import { describe, expect, it } from 'vitest';
import { Game, GameHooks } from '../src/core/game';
import { defaultSave } from '../src/core/storage';
import { MOVES_PER_CORRECT } from '../src/core/scoring';
import { boardFrom, question } from './helpers';

function makeGame(answer: (q: { answer: number }) => number) {
  const hooks: GameHooks = {
    askQuestion: async (q) => answer(q),
    showAnswerResult: async () => {},
    animateSwap: async () => {},
    animate: async () => {},
    onShuffle: async () => {},
    onUnlock: async () => {},
    onLevelEnd: () => {},
    onChange: () => {},
  };
  const game = new Game(defaultSave(), hooks);
  game.startLevel(1, 1);
  return game;
}

/** 固定盤面：(0,0) 與 (1,0) 交換後第 0 列變 baaa 成三；(0,0) 的題目寶石會移到 (1,0) 參與消除。 */
function fixture() {
  const rows = ['abaa', 'cdcd', 'dcdc', 'cdcd', 'dcdc', 'cdcd', 'dcdc', 'cdcd'].map((r, i) => r + (i % 2 ? 'fefe' : 'efef'));
  return boardFrom(rows, { '0,0': question(2, 3) });
}

describe('Game 答題與步數', () => {
  it('答對：扣 1 步再補回 MOVES_PER_CORRECT 步', async () => {
    const g = makeGame((q) => q.answer);
    g.board = fixture();
    const before = g.movesLeft;
    await g.trySwap({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(g.answered.correct).toBe(1);
    expect(g.movesLeft).toBe(before - 1 + MOVES_PER_CORRECT);
  });

  it('答錯：只扣 1 步，題目格變石頭', async () => {
    const g = makeGame(() => -1);
    g.board = fixture();
    const before = g.movesLeft;
    await g.trySwap({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(g.answered.wrong).toBe(1);
    expect(g.movesLeft).toBe(before - 1);
    expect(g.board.cells[1].obstacle?.kind).toBe('rock');
  });
});
