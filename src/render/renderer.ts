// Canvas 盤面繪製與動畫。renderer 只讀 Game 狀態，不改變它。

import { Board, BLOCKER_KINDS, BOARD_W, Gem, Pos } from '../core/types';
import { getCell, forEachCell } from '../core/board';
import { ResolveEvent } from '../core/resolve';
import { drawBlocker, drawGem, drawOverlay, roundRect } from './sprites';
import { OBSTACLE_POKEMON, pokemonIdFor, SpriteStore } from './pokemon';
import { easeIn, easeInOut, easeOut, Tweens, wait } from './tweens';

interface GemView {
  gem: Gem;
  x: number; // 格座標（可為小數）
  y: number;
  scale: number;
  alpha: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

interface Burst {
  x: number;
  y: number;
  born: number;
  color: string;
}

export interface RenderState {
  board: Board;
  selected: Pos | null;
  /** 技能預覽格 */
  preview: Pos[];
  /** 技能施放中：盤面變暗 */
  dimmed: boolean;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private views = new Map<number, GemView>();
  private tweens = new Tweens();
  private floats: FloatText[] = [];
  private bursts: Burst[] = [];
  private shakes = new Map<string, number>(); // key → 結束時間
  cell = 48;
  private dpr = 1;
  private getState: () => RenderState;

  constructor(
    private canvas: HTMLCanvasElement,
    getState: () => RenderState,
    private sprites: SpriteStore,
    private useSprites: () => boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.getState = getState;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
    // 分頁被遮住時 rAF 不會觸發；用低頻計時器推進補間，避免連鎖卡住
    window.setInterval(() => {
      if (document.hidden) {
        this.tweens.update(performance.now());
        try {
          this.draw(performance.now());
        } catch (err) {
          console.error('[renderer] draw failed', err);
        }
      }
    }, 50);
  }

  resize(): void {
    const wrap = this.canvas.parentElement!;
    const size = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
    const w = this.getState().board?.w ?? BOARD_W;
    this.cell = Math.floor(size / w);
    const px = this.cell * w;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${px}px`;
    this.canvas.style.height = `${px}px`;
    this.canvas.width = px * this.dpr;
    this.canvas.height = px * this.dpr;
  }

  /** 像素座標 → 格座標。 */
  cellAt(clientX: number, clientY: number): Pos | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / this.cell);
    const y = Math.floor((clientY - rect.top) / this.cell);
    const b = this.getState().board;
    if (!b || x < 0 || y < 0 || x >= b.w || y >= b.h) return null;
    return { x, y };
  }

  /** 讓 views 與盤面一致（新增缺少的、移除多餘的）。 */
  sync(): void {
    const board = this.getState().board;
    if (!board) return;
    const alive = new Set<number>();
    forEachCell(board, (c, x, y) => {
      if (!c.gem) return;
      alive.add(c.gem.id);
      const v = this.views.get(c.gem.id);
      if (v) {
        v.gem = c.gem;
        if (!this.tweens.active) {
          v.x = x;
          v.y = y;
        }
      } else this.views.set(c.gem.id, { gem: c.gem, x, y, scale: 1, alpha: 1 });
    });
    for (const id of [...this.views.keys()]) if (!alive.has(id)) this.views.delete(id);
  }

  // ---------- 動畫 ----------

  async animateSwap(a: Pos, b: Pos, revert: boolean): Promise<void> {
    const board = this.getState().board;
    // 呼叫時盤面已交換：a 位置的寶石原本在 b
    const ga = getCell(board, a.x, a.y)?.gem;
    const gb = getCell(board, b.x, b.y)?.gem;
    if (!ga || !gb) return;
    if (!this.views.has(ga.id) || !this.views.has(gb.id)) this.sync();
    const va = this.views.get(ga.id)!;
    const vb = this.views.get(gb.id)!;
    // sync 會把 view 放在交換後的位置；先放回交換前的位置再補間
    va.x = b.x;
    va.y = b.y;
    vb.x = a.x;
    vb.y = a.y;
    await Promise.all([this.tweens.to(va, { x: a.x, y: a.y }, 160, easeInOut), this.tweens.to(vb, { x: b.x, y: b.y }, 160, easeInOut)]);
    if (revert) {
      await Promise.all([this.tweens.to(va, { x: b.x, y: b.y }, 160, easeInOut), this.tweens.to(vb, { x: a.x, y: a.y }, 160, easeInOut)]);
    }
  }

  async animate(events: ResolveEvent[]): Promise<void> {
    for (const ev of events) {
      switch (ev.type) {
        case 'rockify':
          this.shake(ev.pos, 300);
          this.bursts.push({ x: ev.pos.x, y: ev.pos.y, born: performance.now(), color: '#9a9aa8' });
          await wait(250);
          break;
        case 'obstacleHit':
          for (const h of ev.hits) {
            this.shake(h.pos, 220);
            if (h.destroyed) this.bursts.push({ x: h.pos.x, y: h.pos.y, born: performance.now(), color: '#ffd166' });
          }
          await wait(120);
          break;
        case 'clear': {
          const ps: Promise<void>[] = [];
          for (const p of ev.cells) {
            const v = this.viewAt(p);
            if (v) ps.push(this.tweens.to(v, { scale: 0, alpha: 0 }, 180, easeIn));
          }
          if (ev.cells.length) {
            const cx = ev.cells.reduce((s, c) => s + c.x, 0) / ev.cells.length;
            const cy = ev.cells.reduce((s, c) => s + c.y, 0) / ev.cells.length;
            this.floats.push({ x: cx, y: cy, text: `+${ev.score}`, color: '#ffd166', born: performance.now() });
          }
          await Promise.all(ps);
          for (const p of ev.cells) {
            const v = this.viewAt(p);
            if (v) this.views.delete(v.gem.id);
          }
          break;
        }
        case 'spawnSpecial': {
          const gem = getCell(this.getState().board, ev.pos.x, ev.pos.y)!.gem!;
          // 移除舊 view（同格）並放入新的
          for (const [id, v] of this.views) if (Math.round(v.x) === ev.pos.x && Math.round(v.y) === ev.pos.y && id !== gem.id) this.views.delete(id);
          const v: GemView = { gem, x: ev.pos.x, y: ev.pos.y, scale: 0.2, alpha: 1 };
          this.views.set(gem.id, v);
          await this.tweens.to(v, { scale: 1 }, 200, easeOut);
          break;
        }
        case 'fall': {
          const ps: Promise<void>[] = [];
          for (const m of ev.moves) {
            const v = this.views.get(m.gemId);
            if (!v) continue;
            const dist = m.to.y - m.from.y;
            ps.push(this.tweens.to(v, { x: m.to.x, y: m.to.y }, 70 + dist * 60, easeIn));
          }
          await Promise.all(ps);
          break;
        }
        case 'spawn': {
          const ps: Promise<void>[] = [];
          for (const s of ev.gems) {
            if (s.fromTop) {
              const v: GemView = { gem: s.gem, x: s.pos.x, y: s.startY, scale: 1, alpha: 1 };
              this.views.set(s.gem.id, v);
              const dist = s.pos.y - s.startY;
              ps.push(this.tweens.to(v, { y: s.pos.y }, 70 + dist * 60, easeIn));
            } else {
              const v: GemView = { gem: s.gem, x: s.pos.x, y: s.pos.y, scale: 0.3, alpha: 0 };
              this.views.set(s.gem.id, v);
              ps.push(this.tweens.to(v, { scale: 1, alpha: 1 }, 220, easeOut, 100));
            }
          }
          await Promise.all(ps);
          break;
        }
      }
    }
    this.sync();
  }

  async shuffleAnim(): Promise<void> {
    const ps: Promise<void>[] = [];
    for (const v of this.views.values()) ps.push(this.tweens.to(v, { scale: 0 }, 200, easeIn));
    await Promise.all(ps);
    this.views.clear();
    this.sync();
    for (const v of this.views.values()) {
      v.scale = 0;
      ps.push(this.tweens.to(v, { scale: 1 }, 250, easeOut));
    }
    await Promise.all(ps);
  }

  shake(p: Pos, ms: number): void {
    this.shakes.set(`${p.x},${p.y}`, performance.now() + ms);
  }

  private viewAt(p: Pos): GemView | undefined {
    for (const v of this.views.values()) if (Math.round(v.x) === p.x && Math.round(v.y) === p.y) return v;
    return undefined;
  }

  // ---------- 繪製 ----------

  private frame(now: number): void {
    // 先排下一幀：就算這一幀繪圖拋錯，迴圈也不能死（否則補間永遠不完成，遊戲會卡住）
    requestAnimationFrame((t) => this.frame(t));
    this.tweens.update(now);
    try {
      this.draw(now);
    } catch (err) {
      console.error('[renderer] draw failed', err);
    }
  }

  private draw(now: number): void {
    const { ctx, cell } = this;
    const state = this.getState();
    const board = state.board;
    if (!board) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, board.w * cell, board.h * cell);

    const previewSet = new Set(state.preview.map((p) => `${p.x},${p.y}`));

    // 底格
    for (let y = 0; y < board.h; y++)
      for (let x = 0; x < board.w; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#1a1e3c' : '#161a34';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }

    const usePokemon = this.useSprites() && this.sprites.ready;
    const obSprite = (kind: keyof typeof OBSTACLE_POKEMON) => (usePokemon ? this.sprites.get(OBSTACLE_POKEMON[kind].id) : null);

    // 擋格障礙
    forEachCell(board, (c, x, y) => {
      if (c.obstacle && BLOCKER_KINDS.has(c.obstacle.kind)) {
        const [dx, dy] = this.shakeOffset(x, y, now);
        drawBlocker(ctx, c.obstacle, (x + 0.5) * cell + dx, (y + 0.5) * cell + dy, cell, obSprite(c.obstacle.kind));
      }
    });

    // 寶石（黑暗覆蓋的不畫）
    const sorted = [...this.views.values()].sort((a, b) => a.y - b.y);
    for (const v of sorted) {
      const bx = Math.round(v.x);
      const by = Math.round(v.y);
      const ob = getCell(board, bx, by)?.obstacle;
      if (ob?.kind === 'dark' && !this.tweens.active) continue;
      const [dx, dy] = this.shakeOffset(bx, by, now);
      const sprite = usePokemon ? this.sprites.get(pokemonIdFor(v.gem)) : null;
      drawGem(ctx, v.gem, (v.x + 0.5) * cell + dx, (v.y + 0.5) * cell + dy, cell, v.scale, v.alpha, sprite);
    }

    // 覆蓋障礙
    forEachCell(board, (c, x, y) => {
      if (c.obstacle && !BLOCKER_KINDS.has(c.obstacle.kind)) {
        const [dx, dy] = this.shakeOffset(x, y, now);
        drawOverlay(ctx, c.obstacle, (x + 0.5) * cell + dx, (y + 0.5) * cell + dy, cell, obSprite(c.obstacle.kind));
      }
    });

    // 技能模式變暗 + 預覽
    if (state.dimmed) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, board.w * cell, board.h * cell);
      for (const k of previewSet) {
        const [x, y] = k.split(',').map(Number);
        ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
        ctx.fillRect(x * cell, y * cell, cell, cell);
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }

    // 選取框
    if (state.selected) {
      const { x, y } = state.selected;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      roundRect(ctx, x * cell + 3, y * cell + 3, cell - 6, cell - 6, 8);
      ctx.stroke();
    }

    // 爆裂粒子
    this.bursts = this.bursts.filter((b) => now - b.born < 400);
    for (const b of this.bursts) {
      const t = (now - b.born) / 400;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 1 - t;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        const d = t * cell * 0.7;
        ctx.beginPath();
        ctx.arc((b.x + 0.5) * cell + Math.cos(a) * d, (b.y + 0.5) * cell + Math.sin(a) * d, cell * 0.06 * (1 - t) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 浮動分數
    this.floats = this.floats.filter((f) => now - f.born < 800);
    for (const f of this.floats) {
      const t = (now - f.born) / 800;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = f.color;
      ctx.font = `800 ${cell * 0.45}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      const px = (f.x + 0.5) * cell;
      const py = (f.y + 0.5) * cell - t * cell * 0.8;
      ctx.strokeText(f.text, px, py);
      ctx.fillText(f.text, px, py);
      ctx.globalAlpha = 1;
    }
  }

  private shakeOffset(x: number, y: number, now: number): [number, number] {
    const end = this.shakes.get(`${x},${y}`);
    if (!end || now > end) return [0, 0];
    const amp = this.cell * 0.06;
    return [Math.sin(now / 18) * amp, Math.cos(now / 23) * amp * 0.5];
  }
}
