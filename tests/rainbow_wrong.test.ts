import { describe, expect, it } from 'vitest';
import { Game, GameHooks } from '../src/core/game';
import { defaultSave } from '../src/core/storage';
import { boardFrom, question } from './helpers';

function makeGame(answer: () => number) {
  const calls: string[] = [];
  const hooks: GameHooks = {
    askQuestion: async () => answer(),
    showAnswerResult: async () => {},
    animateSwap: async () => {},
    animate: async (events) => {
      calls.push(...events.map((e) => e.type));
    },
    onShuffle: async () => {
      calls.push('shuffle');
    },
    onUnlock: async () => {},
    onLevelEnd: () => {
      calls.push('end');
    },
    onChange: () => {},
  };
  const game = new Game(defaultSave(), hooks);
  game.startLevel(1, 1);
  return { game, calls };
}

describe('夢幻（彩虹）+ 答錯', () => {
  it('彩虹清除同色時答錯不會卡住，答錯格變石頭', async () => {
    const { game, calls } = makeGame(() => -1);
    const rows = ['abcdabcd', 'cdabcdab', 'abcdabcd', 'cdabcdab', 'abcdabcd', 'cdabcdab', 'abcdabcd', 'cdabcdab'];
    game.board = boardFrom(rows, {
      '0,0': (c) => (c.gem = { id: 9999, color: -1, special: 'rainbow' }),
      '1,2': question(2, 3),
      '5,4': question(2, 5),
    });
    // (0,0) 夢幻 與 (1,0) 'b' 交換 → 清除全盤 b（含兩顆題目寶石）
    await Promise.race([
      game.trySwap({ x: 0, y: 0 }, { x: 1, y: 0 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: 卡住了')), 3000)),
    ]);
    expect(['idle', 'won', 'lost']).toContain(game.state);
    expect(game.answered.wrong).toBe(2);
    expect(game.board.cells.filter((c) => c.obstacle?.kind === 'rock').length).toBe(2);
    expect(calls).toContain('rockify');
  }, 5000);
});
