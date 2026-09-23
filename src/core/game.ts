// 遊戲狀態機。與畫面的互動全部透過 GameHooks（純邏輯、可測試）。

import {
  AnswerMode,
  Board,
  LevelConfig,
  Pos,
  Question,
  SaveData,
  SkillId,
} from './types';
import {
  countObstacles,
  emptyBoard,
  fillEmpty,
  forEachCell,
  getCell,
  hasValidMove,
  isAdjacent,
  isSelectable,
  isSpecialCombo,
  shuffleBoard,
  swapGems,
} from './board';
import { findMatches } from './match';
import { ClearPlan, swapComboPlan } from './specials';
import { placeObstacles } from './obstacles';
import { makeQuestion } from './questions';
import { levelConfig, questionWeights } from './level';
import { applyGravity, applyStep, planStep, ResolveEvent } from './resolve';
import { applySkill, hasValidTarget, isValidTarget, SKILLS } from './skills';
import { recordAnswer, syncUnlocks } from './mastery';
import { MOVE_LEFT_BONUS, MOVES_PER_CORRECT, OBSTACLE_SCORE } from './scoring';
import { writeSave } from './storage';
import { createRng, randomSeed, Rng } from './rng';

export type GameState = 'idle' | 'busy' | 'question' | 'skill' | 'won' | 'lost';

export interface AnswerContext {
  mode: AnswerMode;
  /** 閃光生效：四選一刪 2 個錯誤選項 / 鍵盤顯示提示 */
  flash: boolean;
}

export interface LevelSummary {
  level: number;
  score: number;
  target: number;
  movesLeft: number;
  bonus: number;
  won: boolean;
}

export interface GameHooks {
  askQuestion(q: Question, ctx: AnswerContext): Promise<number>;
  /** 顯示答題結果（答錯時顯示正解）。 */
  showAnswerResult(q: Question, correct: boolean): Promise<void>;
  animateSwap(a: Pos, b: Pos, revert: boolean): Promise<void>;
  animate(events: ResolveEvent[]): Promise<void>;
  onShuffle(): Promise<void>;
  onUnlock(skills: SkillId[]): Promise<void>;
  onLevelEnd(summary: LevelSummary): void;
  /** 任何狀態變動（HUD 更新用）。 */
  onChange(): void;
}

export class Game {
  save: SaveData;
  config!: LevelConfig;
  board!: Board;
  rng!: Rng;
  score = 0;
  movesLeft = 0;
  combo = 0;
  state: GameState = 'idle';
  selected: Pos | null = null;
  activeSkill: SkillId | null = null;
  flashArmed = false;
  pp: Partial<Record<SkillId, number>> = {};
  /** 本關答題統計（結算用）。 */
  answered = { correct: 0, wrong: 0 };

  constructor(save: SaveData, private hooks: GameHooks) {
    this.save = save;
  }

  // ---------- 關卡 ----------

  startLevel(level: number, seed = randomSeed()): void {
    this.config = levelConfig(level);
    this.rng = createRng(seed);
    this.board = this.createBoard();
    this.score = 0;
    this.movesLeft = this.config.moves;
    this.combo = 0;
    this.state = 'idle';
    this.selected = null;
    this.activeSkill = null;
    this.flashArmed = false;
    this.answered = { correct: 0, wrong: 0 };
    this.pp = {};
    for (const id of this.save.unlockedSkills) this.pp[id] = SKILLS[id].startPP;
    this.save.pp = { ...this.pp };
    this.persist();
    this.hooks.onChange();
  }

  private createBoard(): Board {
    const board = emptyBoard();
    fillEmpty(board, this.rng);
    placeObstacles(board, this.config.obstacles, this.rng);
    // 預放題目寶石
    const candidates: Pos[] = [];
    forEachCell(board, (c, x, y) => {
      if (c.gem && !c.obstacle) candidates.push({ x, y });
    });
    this.rng.shuffle(candidates);
    for (const p of candidates.slice(0, this.config.initialQuestions)) {
      getCell(board, p.x, p.y)!.gem!.question = this.newQuestion();
    }
    if (!hasValidMove(board)) shuffleBoard(board, this.rng);
    return board;
  }

  private newQuestion(): Question {
    return makeQuestion(this.config.numbers, this.rng, questionWeights(this.config, this.save.stats), (a, b) => {
      const c = this.save.stats[a]?.combos[b]?.correct ?? 0;
      return 1 / (1 + c); // 沒答對過的組合權重最高
    });
  }

  get answerMode(): AnswerMode {
    const s = this.save.settings.answerMode;
    return s === 'auto' ? this.config.answerMode : s;
  }

  get obstaclesLeft(): number {
    return countObstacles(this.board);
  }

  get goalReached(): boolean {
    return this.score >= this.config.targetScore && this.obstaclesLeft === 0;
  }

  // ---------- 玩家操作 ----------

  /** 點選一格（配合 selected 決定是否交換）。 */
  async tapCell(p: Pos): Promise<void> {
    if (this.state === 'skill') {
      await this.useSkill(this.activeSkill!, p);
      return;
    }
    if (this.state !== 'idle') return;
    if (!isSelectable(this.board, p.x, p.y)) {
      this.selected = null;
      this.hooks.onChange();
      return;
    }
    if (this.selected && isAdjacent(this.selected, p)) {
      const a = this.selected;
      this.selected = null;
      await this.trySwap(a, p);
      return;
    }
    this.selected = this.selected && this.selected.x === p.x && this.selected.y === p.y ? null : p;
    this.hooks.onChange();
  }

  async trySwap(a: Pos, b: Pos): Promise<void> {
    if (this.state !== 'idle') return;
    if (!isAdjacent(a, b) || !isSelectable(this.board, a.x, a.y) || !isSelectable(this.board, b.x, b.y)) return;
    this.state = 'busy';
    this.selected = null;
    this.hooks.onChange();

    await this.guarded(async () => {
      const combo = isSpecialCombo(this.board, a, b);
      swapGems(this.board, a, b);
      let initial: ClearPlan | undefined;
      if (combo) {
        initial = swapComboPlan(this.board, a, b, this.rng) ?? undefined;
      }
      const matches = initial ? [] : findMatches(this.board, [a, b]);
      if (!initial && matches.length === 0) {
        await this.hooks.animateSwap(a, b, true);
        swapGems(this.board, a, b);
        this.state = 'idle';
        this.hooks.onChange();
        return;
      }
      await this.hooks.animateSwap(a, b, false);
      this.movesLeft--;
      await this.runResolve([a, b], initial);
    });
  }

  /** 避免畫面層拋錯讓狀態卡在 busy。 */
  private async guarded(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(err);
      if (this.state === 'busy' || this.state === 'question') {
        this.state = 'idle';
        this.hooks.onChange();
      }
    }
  }

  selectSkill(id: SkillId): void {
    if (this.state !== 'idle' && this.state !== 'skill') return;
    if (this.activeSkill === id) {
      this.cancelSkill();
      return;
    }
    if (!this.canUseSkill(id)) return;
    this.selected = null;
    this.activeSkill = id;
    this.state = 'skill';
    this.hooks.onChange();
    if (SKILLS[id].target === 'none') void this.useSkill(id, { x: 0, y: 0 });
  }

  cancelSkill(): void {
    if (this.state !== 'skill') return;
    this.activeSkill = null;
    this.state = 'idle';
    this.hooks.onChange();
  }

  canUseSkill(id: SkillId): boolean {
    return (
      this.save.unlockedSkills.includes(id) &&
      (this.pp[id] ?? 0) > 0 &&
      hasValidTarget(this.board, id) &&
      (this.state === 'idle' || this.state === 'skill')
    );
  }

  async useSkill(id: SkillId, pos: Pos): Promise<boolean> {
    if (this.state !== 'skill' || this.activeSkill !== id) return false;
    if (!this.canUseSkill(id) || !isValidTarget(this.board, id, pos)) return false;
    this.activeSkill = null;
    this.state = 'busy';
    this.pp[id] = (this.pp[id] ?? 1) - 1;
    this.save.pp = { ...this.pp };
    this.persist();
    this.hooks.onChange();

    const effect = applySkill(this.board, id, pos, this.rng);
    if (effect.flash) this.flashArmed = true;
    let gained = 0;
    for (const h of effect.hits) if (h.destroyed) gained += OBSTACLE_SCORE[h.kind];
    this.score += gained;
    if (effect.hits.length) await this.hooks.animate([{ type: 'obstacleHit', hits: effect.hits }]);

    await this.guarded(async () => {
      if (effect.plan.clear.size === 0) {
        // 只移除障礙：讓寶石落下補位
        const { falls, spawns } = applyGravity(this.board, this.rng, this.refillContext());
        const events: ResolveEvent[] = [];
        if (falls.length) events.push({ type: 'fall', moves: falls });
        if (spawns.length) events.push({ type: 'spawn', gems: spawns });
        if (events.length) await this.hooks.animate(events);
        await this.runResolve([], undefined);
      } else {
        await this.runResolve([], effect.plan);
      }
    });
    return true;
  }

  // ---------- Resolve 迴圈 ----------

  private refillContext() {
    return { questionProb: this.config.questionProb, makeQuestion: () => this.newQuestion() };
  }

  private async runResolve(preferred: Pos[], initial: ClearPlan | undefined): Promise<void> {
    this.state = 'busy';
    this.combo = 0;
    let step = planStep(this.board, preferred, initial);
    while (step) {
      this.combo++;
      this.hooks.onChange();
      const wrong = new Set<string>();
      for (const p of step.questions) {
        const gem = getCell(this.board, p.x, p.y)?.gem;
        if (!gem?.question) continue;
        const correct = await this.ask(gem.question);
        if (!correct) wrong.add(`${p.x},${p.y}`);
      }
      const result = applyStep(this.board, step, wrong, this.combo, this.rng, this.refillContext());
      this.score += result.score;
      this.hooks.onChange();
      await this.hooks.animate(result.events);
      step = planStep(this.board);
    }
    this.combo = 0;
    await this.afterResolve();
  }

  private async ask(q: Question): Promise<boolean> {
    this.state = 'question';
    this.hooks.onChange();
    const answer = await this.hooks.askQuestion(q, { mode: this.answerMode, flash: this.flashArmed });
    this.flashArmed = false;
    const correct = answer === q.answer;
    if (correct) {
      this.answered.correct++;
      this.movesLeft += MOVES_PER_CORRECT;
      for (const id of this.save.unlockedSkills) {
        this.pp[id] = Math.min(SKILLS[id].maxPP, (this.pp[id] ?? 0) + 1);
      }
      this.save.pp = { ...this.pp };
    } else {
      this.answered.wrong++;
    }
    recordAnswer(this.save.stats, q, correct);
    this.persist();
    this.hooks.onChange();
    await this.hooks.showAnswerResult(q, correct);
    this.state = 'busy';
    return correct;
  }

  private async afterResolve(): Promise<void> {
    const newly = syncUnlocks(this.save);
    if (newly.length) {
      for (const id of newly) this.pp[id] = SKILLS[id].startPP;
      this.save.pp = { ...this.pp };
      this.persist();
      this.hooks.onChange();
      await this.hooks.onUnlock(newly);
    }
    if (this.goalReached) {
      this.endLevel(true);
      return;
    }
    if (this.movesLeft <= 0) {
      this.endLevel(false);
      return;
    }
    if (!hasValidMove(this.board)) {
      shuffleBoard(this.board, this.rng);
      await this.hooks.onShuffle();
      // 洗牌後若剛好成三，繼續消
      if (findMatches(this.board).length > 0) {
        await this.runResolve([], undefined);
        return;
      }
    }
    this.state = 'idle';
    this.hooks.onChange();
  }

  private endLevel(won: boolean): void {
    const bonus = won ? this.movesLeft * MOVE_LEFT_BONUS : 0;
    this.score += bonus;
    this.state = won ? 'won' : 'lost';
    if (won) this.save.level = Math.max(this.save.level, this.config.level + 1);
    this.save.highScore = Math.max(this.save.highScore, this.score);
    this.persist();
    this.hooks.onChange();
    this.hooks.onLevelEnd({
      level: this.config.level,
      score: this.score,
      target: this.config.targetScore,
      movesLeft: this.movesLeft,
      bonus,
      won,
    });
  }

  persist(): void {
    writeSave(this.save);
  }
}
