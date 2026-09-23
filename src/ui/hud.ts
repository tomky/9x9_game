// 分數 / 步數 / 障礙 HUD 與技能列。

import { Game } from '../core/game';
import { SKILL_IDS, SKILLS } from '../core/skills';
import { combosDone, missingCombos, STREAK_REQUIRED } from '../core/mastery';
import { SKILL_EMOJI } from '../render/sprites';
import { T } from '../i18n/zh-TW';

export class Hud {
  private hud: HTMLElement;
  private bar: HTMLElement;
  private hint: HTMLElement;
  private hintTimer: number | undefined;

  constructor(private game: Game, onSkill: (id: number) => void) {
    this.hud = document.getElementById('hud')!;
    this.bar = document.getElementById('skillbar')!;
    this.hint = document.getElementById('board-hint')!;
    this.bar.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.skill');
      if (el?.dataset.id) onSkill(Number(el.dataset.id));
    });
  }

  render(): void {
    const g = this.game;
    if (!g.config) return;
    const pct = Math.min(100, Math.round((g.score / g.config.targetScore) * 100));
    this.hud.innerHTML = `
      <div class="hud-level">
        <span><b>${T.levelIntro(g.config.level)}</b>　${T.numbersInPlay}：${g.config.numbers.join('、')}</span>
        <span class="hud-combo">${g.combo > 1 ? T.combo(g.combo) : ''}</span>
      </div>
      <div class="hud-item">
        <div class="hud-label">${T.score}</div>
        <div class="hud-value">${g.score}<small> / ${g.config.targetScore}</small></div>
        <div class="hud-bar"><div style="width:${pct}%"></div></div>
      </div>
      <div class="hud-item">
        <div class="hud-label">${T.movesLeft}</div>
        <div class="hud-value" style="color:${g.movesLeft <= 5 ? 'var(--danger)' : 'inherit'}">${g.movesLeft}</div>
      </div>
      <div class="hud-item">
        <div class="hud-label">${T.obstaclesLeft}</div>
        <div class="hud-value" style="color:${g.obstaclesLeft === 0 ? 'var(--accent-2)' : 'inherit'}">${g.obstaclesLeft}</div>
      </div>`;

    this.bar.innerHTML = SKILL_IDS.map((id) => {
      const def = SKILLS[id];
      const unlocked = g.save.unlockedSkills.includes(id);
      const stats = g.save.stats[id];
      const pp = g.pp[id] ?? 0;
      const usable = unlocked && g.canUseSkill(id);
      const cls = ['skill', unlocked ? '' : 'locked', unlocked && !usable ? 'disabled' : '', g.activeSkill === id ? 'active' : ''].join(' ');
      const ppDots = unlocked ? '●'.repeat(pp) + '○'.repeat(def.maxPP - pp) : '';
      const missing = missingCombos(stats);
      const streakOk = stats.bestStreak >= STREAK_REQUIRED;
      let progressText = `${combosDone(stats)}/8 · ${Math.min(stats.bestStreak, STREAK_REQUIRED)}/${STREAK_REQUIRED}`;
      if (missing.length > 0 && missing.length <= 2) progressText = T.skillMissing(id, missing);
      else if (missing.length === 0 && !streakOk) progressText = T.skillStreakLeft(STREAK_REQUIRED - stats.bestStreak);
      const progress = unlocked ? `<div class="skill-pp">${ppDots}</div>` : `<div class="skill-progress">${progressText}</div>`;
      const title = unlocked
        ? `${def.name}：${def.description}`
        : T.skillLockedDetail(id, def.name, missing, stats.bestStreak, STREAK_REQUIRED);
      return `<div class="${cls}" data-id="${id}" title="${title}">
        <div class="skill-num">${id}</div>
        <div class="skill-icon">${unlocked ? SKILL_EMOJI[id] : '🔒'}</div>
        <div class="skill-name">${def.name}</div>
        ${progress}
      </div>`;
    }).join('');

    if (g.state === 'skill' && g.activeSkill) {
      const def = SKILLS[g.activeSkill];
      this.showHint(`${SKILL_EMOJI[g.activeSkill]} ${def.name}：${T.skillTargetHint[def.target]}（再點一次${T.cancel}）`, 0);
    } else if (this.hintTimer === 0) {
      this.hideHint();
    }
  }

  /** 顯示盤面上方提示；ms = 0 表示持續顯示直到 hideHint。 */
  showHint(text: string, ms = 1500): void {
    this.hint.textContent = text;
    this.hint.classList.add('show');
    if (this.hintTimer) window.clearTimeout(this.hintTimer);
    this.hintTimer = 0;
    if (ms > 0) this.hintTimer = window.setTimeout(() => this.hideHint(), ms);
  }

  hideHint(): void {
    this.hint.classList.remove('show');
    this.hintTimer = undefined;
  }
}
