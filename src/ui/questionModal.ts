// 答題視窗：四選一 / 數字鍵盤。

import { AnswerMode, Question } from '../core/types';
import { formatQuestion, makeChoices, makeHint } from '../core/questions';
import { Rng } from '../core/rng';
import { T } from '../i18n/zh-TW';
import { wait } from '../render/tweens';

export class QuestionModal {
  private root: HTMLElement;
  private card!: HTMLElement;

  constructor(private rng: Rng, private sfx: { correct(): void; wrong(): void; tap(): void }) {
    this.root = document.getElementById('modal-root')!;
  }

  /** 出題並等待作答，回傳玩家答案。 */
  ask(q: Question, mode: AnswerMode, flash: boolean): Promise<number> {
    this.root.innerHTML = '';
    this.card = document.createElement('div');
    this.card.className = 'card';
    this.root.appendChild(this.card);
    this.root.classList.add('show');
    return mode === 'choice' ? this.askChoice(q, flash) : this.askKeypad(q, flash);
  }

  private header(q: Question, flash: boolean, hintText?: string): string {
    return `<p>${T.question}</p>
      <div class="q-text">${formatQuestion(q)} = ?</div>
      ${flash && hintText ? `<div class="q-hint">💡 ${T.hint}：${hintText}</div>` : ''}`;
  }

  private askChoice(q: Question, flash: boolean): Promise<number> {
    const choices = makeChoices(q, this.rng);
    let eliminated: number[] = [];
    if (flash) eliminated = choices.filter((c) => c !== q.answer).slice(0, 2);
    this.card.innerHTML = `${this.header(q, flash)}
      <div class="q-choices">
        ${choices.map((c) => `<button class="q-choice ${eliminated.includes(c) ? 'eliminated' : ''}" data-v="${c}">${c}</button>`).join('')}
      </div>
      <div class="q-result"></div>`;
    return new Promise((resolve) => {
      this.card.querySelectorAll<HTMLButtonElement>('.q-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          const v = Number(btn.dataset.v);
          this.sfx.tap();
          this.card.querySelectorAll<HTMLButtonElement>('.q-choice').forEach((b) => (b.disabled = true));
          btn.classList.add(v === q.answer ? 'right' : 'wrong');
          if (v !== q.answer) this.card.querySelector<HTMLElement>(`.q-choice[data-v="${q.answer}"]`)?.classList.add('right');
          resolve(v);
        });
      });
    });
  }

  private askKeypad(q: Question, flash: boolean): Promise<number> {
    this.card.innerHTML = `${this.header(q, flash, makeHint(q))}
      <div class="q-input">&nbsp;</div>
      <div class="q-keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="q-key" data-k="${n}">${n}</button>`).join('')}
        <button class="q-key del" data-k="del">⌫</button>
        <button class="q-key" data-k="0">0</button>
        <button class="q-key confirm" data-k="ok">${T.keypadConfirm}</button>
      </div>
      <div class="q-result"></div>`;
    const input = this.card.querySelector<HTMLElement>('.q-input')!;
    let value = '';
    const render = () => (input.textContent = value || ' ');
    return new Promise((resolve) => {
      const submit = () => {
        if (!value) return;
        this.card.querySelectorAll<HTMLButtonElement>('.q-key').forEach((b) => (b.disabled = true));
        window.removeEventListener('keydown', onKey);
        resolve(Number(value));
      };
      const press = (k: string) => {
        this.sfx.tap();
        if (k === 'del') value = value.slice(0, -1);
        else if (k === 'ok') return submit();
        else if (value.length < 3) value += k;
        render();
      };
      this.card.querySelectorAll<HTMLButtonElement>('.q-key').forEach((btn) => btn.addEventListener('click', () => press(btn.dataset.k!)));
      const onKey = (e: KeyboardEvent) => {
        if (e.key >= '0' && e.key <= '9') press(e.key);
        else if (e.key === 'Backspace') press('del');
        else if (e.key === 'Enter') press('ok');
      };
      window.addEventListener('keydown', onKey);
    });
  }

  /** 顯示結果後關閉。 */
  async showResult(q: Question, correct: boolean): Promise<void> {
    const el = this.card.querySelector<HTMLElement>('.q-result');
    if (el) {
      el.textContent = correct ? T.correct : T.wrong(q.a, q.b, q.answer);
      el.className = `q-result ${correct ? 'ok' : 'bad'}`;
    }
    correct ? this.sfx.correct() : this.sfx.wrong();
    await wait(correct ? 650 : 1600);
    this.root.classList.remove('show');
    this.root.innerHTML = '';
  }
}
