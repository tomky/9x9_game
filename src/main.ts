// 進入點：組裝 Game（純邏輯）、Renderer（Canvas）、DOM UI。

import { Game, GameHooks } from './core/game';
import { Pos, SkillId } from './core/types';
import { clearSave, defaultSave, loadSave, writeSave } from './core/storage';
import { createRng, randomSeed } from './core/rng';
import { findValidMove } from './core/board';
import { isValidTarget, previewCells, SKILLS } from './core/skills';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { QuestionModal } from './ui/questionModal';
import { Screens } from './ui/screens';
import { Sound } from './ui/sound';
import { bindInput } from './ui/input';
import { T } from './i18n/zh-TW';

const canvas = document.getElementById('board') as HTMLCanvasElement;
const sound = new Sound();
const screens = new Screens();
const modal = new QuestionModal(createRng(randomSeed()), sound);

let save = loadSave();
sound.enabled = save.settings.sound;
let hover: Pos | null = null;

const hooks: GameHooks = {
  askQuestion: (q, ctx) => modal.ask(q, ctx.mode, ctx.flash),
  showAnswerResult: (q, correct) => modal.showResult(q, correct),
  animateSwap: (a, b, revert) => {
    sound.swap();
    return renderer.animateSwap(a, b, revert);
  },
  animate: async (events) => {
    if (events.some((e) => e.type === 'clear')) sound.clear(game.combo);
    await renderer.animate(events);
  },
  onShuffle: async () => {
    hud.showHint(T.shuffle, 1500);
    await renderer.shuffleAnim();
  },
  onUnlock: async (ids) => {
    sound.unlock();
    await screens.unlock(ids);
  },
  onLevelEnd: (summary) => {
    summary.won ? sound.win() : sound.lose();
    setTimeout(() => {
      screens.levelEnd(summary, game.answered, {
        next: () => startLevel(summary.level + 1),
        retry: () => startLevel(summary.level),
        title: () => showTitle(),
      });
    }, 500);
  },
  onChange: () => hud.render(),
};

const game = new Game(save, hooks);
const renderer = new Renderer(canvas, () => ({
  board: game.board,
  selected: game.selected,
  preview: game.state === 'skill' && game.activeSkill && hover && isValidTarget(game.board, game.activeSkill, hover) ? previewCells(game.board, game.activeSkill, hover) : [],
  dimmed: game.state === 'skill',
}));
const hud = new Hud(game, (id) => {
  if (!game.save.unlockedSkills.includes(id as SkillId)) return;
  if (game.state === 'skill' && game.activeSkill === id) {
    game.cancelSkill();
    hud.hideHint();
    return;
  }
  if (game.canUseSkill(id as SkillId)) {
    sound.tap();
    game.selectSkill(id as SkillId);
    if (SKILLS[id as SkillId].target === 'none') sound.skill();
  }
});

bindInput(canvas, renderer, {
  tap: (p) => {
    if (game.state === 'skill') {
      const id = game.activeSkill!;
      if (!isValidTarget(game.board, id, p)) {
        renderer.shake(p, 200);
        return;
      }
      sound.skill();
      hud.hideHint();
      void game.tapCell(p);
      return;
    }
    if (game.state === 'idle') {
      sound.tap();
      void game.tapCell(p);
    }
  },
  drag: (from, to) => {
    if (game.state !== 'idle') return;
    game.selected = null;
    void game.trySwap(from, to);
  },
  hover: (p) => {
    hover = p;
  },
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && game.state === 'skill') {
    game.cancelSkill();
    hud.hideHint();
  }
});

// ---------- 畫面流程 ----------

function startLevel(level: number): void {
  game.startLevel(level);
  renderer.resize();
  renderer.sync();
  hud.render();
  screens.levelIntro(game.config, () => {
    screens.hide();
    // 建立一個空盤面 game 之前 renderer 需要 board；startLevel 已經建立
  });
}

function showTitle(): void {
  if (!game.board) game.startLevel(save.level); // 讓 renderer 有盤面可畫
  screens.title(save, {
    start: () => {
      save.level = 1;
      writeSave(save);
      startLevel(1);
    },
    cont: () => startLevel(save.level),
    progress: () => screens.progress(save, showTitle),
    settings: () =>
      screens.settings(save, {
        change: () => {
          sound.enabled = save.settings.sound;
          writeSave(save);
        },
        reset: () => {
          clearSave();
          save = defaultSave();
          game.save = save;
          showTitle();
        },
        back: showTitle,
      }),
  });
}

showTitle();

// 開發模式：在 console 可用 window.game 檢查狀態
if (import.meta.env.DEV) {
  Object.assign(window, { game, dbg: { findValidMove } });
}
