// 標題、關卡前導、過關 / 失敗、技能解鎖、進度、設定畫面（全部是 DOM overlay）。

import { LevelConfig, SaveData, SkillId } from '../core/types';
import { LevelSummary } from '../core/game';
import { SKILLS } from '../core/skills';
import { combosDone, isMastered, NUMBERS, STREAK_REQUIRED } from '../core/mastery';
import { OBSTACLE_ORDER, OBSTACLE_INTRO_LEVEL } from '../core/obstacles';
import { OBSTACLE_EMOJI, SKILL_EMOJI } from '../render/sprites';
import { iconImg, OBSTACLE_POKEMON, SKILL_POKEMON, spriteUrl } from '../render/pokemon';
import { T } from '../i18n/zh-TW';

export class Screens {
  private root: HTMLElement;

  constructor() {
    this.root = document.getElementById('screen-root')!;
  }

  private show(html: string): HTMLElement {
    this.root.innerHTML = `<div class="card">${html}</div>`;
    this.root.classList.add('show');
    return this.root.firstElementChild as HTMLElement;
  }

  hide(): void {
    this.root.classList.remove('show');
    this.root.innerHTML = '';
  }

  title(save: SaveData, on: { start(): void; cont(): void; progress(): void; settings(): void }): void {
    const card = this.show(`
      <h1>💎 ${T.title}</h1>
      <p>${T.subtitle}</p>
      <div style="margin:18px 0">
        ${save.level > 1 ? `<button class="btn" data-a="cont">${T.continue(save.level)}</button><br/>` : ''}
        <button class="btn ${save.level > 1 ? 'secondary' : ''}" data-a="start">${T.start}</button>
      </div>
      <button class="btn secondary small" data-a="progress">📊 ${T.progress}</button>
      <button class="btn secondary small" data-a="settings">⚙️ ${T.settings}</button>
      ${save.highScore ? `<p style="margin-top:14px">🏆 ${save.highScore}</p>` : ''}
    `);
    card.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (a === 'start') on.start();
      else if (a === 'cont') on.cont();
      else if (a === 'progress') on.progress();
      else if (a === 'settings') on.settings();
    });
  }

  levelIntro(config: LevelConfig, onGo: () => void): void {
    const newest = config.numbers[config.numbers.length - 1];
    const isNew = config.level <= 8;
    const obstacles = OBSTACLE_ORDER.filter((k) => config.obstacles[k] > 0)
      .map((k) => `<span>${iconImg(OBSTACLE_POKEMON[k].id, OBSTACLE_EMOJI[k], 'pk-inline')} ${T.obstacleNames[k]} × ${config.obstacles[k]}${OBSTACLE_INTRO_LEVEL[k] === config.level ? ' <b>NEW</b>' : ''}</span>`)
      .join('');
    const card = this.show(`
      <h1>${T.levelIntro(config.level)}</h1>
      <p>${T.numbersInPlay}</p>
      <div class="numbers-chips">${config.numbers.map((n) => `<div class="chip ${isNew && n === newest ? 'new' : ''}">${n}</div>`).join('')}</div>
      <div class="stat-row"><span>${T.target}</span><b>${config.targetScore}</b></div>
      <div class="stat-row"><span>${T.moves}</span><b>${config.moves}</b></div>
      <div class="stat-row"><span>${T.obstacles}</span><b>${Object.values(config.obstacles).reduce((s, n) => s + n, 0)}</b></div>
      <div class="obstacle-list">${obstacles}</div>
      <button class="btn" data-a="go">${T.go}</button>
    `);
    card.querySelector('[data-a="go"]')!.addEventListener('click', onGo);
  }

  levelEnd(s: LevelSummary, answered: { correct: number; wrong: number }, on: { next(): void; retry(): void; title(): void }): void {
    const card = this.show(`
      <h1>${s.won ? '🎉 ' + T.win : '😢 ' + T.lose}</h1>
      <h2>${T.levelIntro(s.level)}</h2>
      <div class="stat-row"><span>${T.levelScore}</span><b>${s.score}</b></div>
      <div class="stat-row"><span>${T.target}</span><b>${s.target}</b></div>
      ${s.won && s.bonus ? `<div class="stat-row"><span>${T.moveBonus(s.movesLeft, s.bonus)}</span><b>✨</b></div>` : ''}
      <p>${T.answered(answered.correct, answered.wrong)}</p>
      <div style="margin-top:14px">
        ${s.won ? `<button class="btn" data-a="next">${T.nextLevel}</button>` : `<button class="btn" data-a="retry">${T.retry}</button>`}
        <button class="btn secondary" data-a="title">${T.toTitle}</button>
      </div>
    `);
    card.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (a === 'next') on.next();
      else if (a === 'retry') on.retry();
      else if (a === 'title') on.title();
    });
  }

  unlock(ids: SkillId[]): Promise<void> {
    return new Promise((resolve) => {
      const items = ids
        .map(
          (id) => `<div class="unlock-icon"><span class="pk pk-big"><img src="${spriteUrl(SKILL_POKEMON[id].id)}" alt="" onerror="this.parentElement.classList.add('fallback')"><span class="pk-emoji">${SKILL_EMOJI[id]}</span></span></div>
            <h2>${SKILLS[id].name}</h2>
            <p>${T.unlockDesc(id, SKILLS[id].name)}</p>
            <p>${T.skillPartner(SKILL_POKEMON[id].name)}</p>
            <p>${SKILLS[id].description}</p>`,
        )
        .join('<hr style="border:none;border-top:1px solid #444;margin:12px 0"/>');
      const card = this.show(`<h1>${T.unlock}</h1>${items}<button class="btn" data-a="ok">${T.ok}</button>`);
      card.querySelector('[data-a="ok"]')!.addEventListener('click', () => {
        this.hide();
        resolve();
      });
    });
  }

  progress(save: SaveData, onBack: () => void): void {
    const rows = NUMBERS.map((n) => {
      const s = save.stats[n];
      const mastered = isMastered(s);
      const cells = NUMBERS.map((b) => {
        const c = s.combos[b];
        const cls = c.correct >= 6 ? 'c6' : c.correct >= 3 ? 'c3' : c.correct >= 1 ? 'c1' : '';
        const w = c.wrong > c.correct ? 'w' : '';
        return `<td class="${cls} ${w}" title="${n}×${b}：答對 ${c.correct}・答錯 ${c.wrong}">${c.correct || ''}</td>`;
      }).join('');
      return `<tr><th class="${mastered ? 'mastered' : ''}">${mastered ? iconImg(SKILL_POKEMON[n as SkillId].id, SKILL_EMOJI[n], 'pk-inline') : n}</th>${cells}
        <td style="width:auto;padding:0 8px;white-space:nowrap">${combosDone(s)}/8 · ${T.streak} ${Math.min(s.bestStreak, STREAK_REQUIRED)}/${STREAK_REQUIRED}${mastered ? ' ✅' : ''}</td></tr>`;
    }).join('');
    const card = this.show(`
      <h2>${T.progressTitle}</h2>
      <div class="grid-wrap">
      <table class="pgrid">
        <tr><th>×</th>${NUMBERS.map((b) => `<th>${b}</th>`).join('')}<th></th></tr>
        ${rows}
      </table>
      </div>
      <p style="font-size:12px">${T.progressHint}</p>
      <button class="btn secondary" data-a="back">${T.back}</button>
    `);
    card.querySelector('[data-a="back"]')!.addEventListener('click', onBack);
  }

  settings(save: SaveData, on: { change(): void; reset(): void; back(): void }): void {
    const card = this.show(`
      <h2>⚙️ ${T.settings}</h2>
      <div class="setting-row">
        <label>${T.answerModeLabel}</label>
        <select id="set-mode">
          <option value="auto">${T.answerModeAuto}</option>
          <option value="choice">${T.answerModeChoice}</option>
          <option value="keypad">${T.answerModeKeypad}</option>
        </select>
      </div>
      <div class="setting-row">
        <label>${T.gemStyleLabel}</label>
        <select id="set-style">
          <option value="pokemon">${T.gemStylePokemon}</option>
          <option value="gem">${T.gemStyleGem}</option>
        </select>
      </div>
      <div class="setting-row">
        <label>${T.soundLabel}</label>
        <select id="set-sound"><option value="1">${T.on}</option><option value="0">${T.off}</option></select>
      </div>
      <button class="btn secondary" data-a="back">${T.back}</button>
      <br/><button class="btn secondary small" data-a="reset" style="color:var(--danger)">${T.reset}</button>
      <p style="font-size:11px;margin-top:14px">${T.spriteCredit}</p>
    `);
    const mode = card.querySelector<HTMLSelectElement>('#set-mode')!;
    const sound = card.querySelector<HTMLSelectElement>('#set-sound')!;
    const style = card.querySelector<HTMLSelectElement>('#set-style')!;
    mode.value = save.settings.answerMode;
    sound.value = save.settings.sound ? '1' : '0';
    style.value = save.settings.gemStyle;
    style.addEventListener('change', () => {
      save.settings.gemStyle = style.value as SaveData['settings']['gemStyle'];
      on.change();
    });
    mode.addEventListener('change', () => {
      save.settings.answerMode = mode.value as SaveData['settings']['answerMode'];
      on.change();
    });
    sound.addEventListener('change', () => {
      save.settings.sound = sound.value === '1';
      on.change();
    });
    card.querySelector('[data-a="back"]')!.addEventListener('click', on.back);
    card.querySelector('[data-a="reset"]')!.addEventListener('click', () => {
      if (confirm(T.resetConfirm)) on.reset();
    });
  }
}
