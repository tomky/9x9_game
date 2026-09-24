// 用 Canvas 程式繪製寶石與障礙（不需外部圖檔）。

import { Gem, Obstacle, RAINBOW_COLOR } from '../core/types';
import type { Sprite } from './pokemon';

// 六色：紅 / 橘 / 黃 / 綠 / 藍 / 紫（高飽和，彼此拉開）
export const GEM_COLORS = ['#ff4b4b', '#ff9a1f', '#ffe600', '#3ad46b', '#3b8bff', '#b46cff'];
const GEM_DARK = ['#b81f1f', '#c26400', '#c4ad00', '#1d8f45', '#1d5fc4', '#7a3fc4'];

export const OBSTACLE_EMOJI: Record<Obstacle['kind'], string> = {
  tree: '🌳',
  rock: '🪨',
  dark: '❓',
  boulder: '🗿',
  water: '💧',
  ice: '🧊',
};

export const SKILL_EMOJI: Record<number, string> = {
  2: '🗡️',
  3: '👊',
  4: '💡',
  5: '💪',
  6: '🌊',
  7: '🔥',
  8: '❄️',
  9: '⚡',
};

function shapePath(ctx: CanvasRenderingContext2D, color: number, r: number): void {
  ctx.beginPath();
  switch (color) {
    case 0: // 圓
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 1: // 菱形
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      break;
    case 2: {
      // 圓角方形
      const s = r * 0.88;
      const rad = r * 0.3;
      ctx.moveTo(-s + rad, -s);
      ctx.arcTo(s, -s, s, s, rad);
      ctx.arcTo(s, s, -s, s, rad);
      ctx.arcTo(-s, s, -s, -s, rad);
      ctx.arcTo(-s, -s, s, -s, rad);
      ctx.closePath();
      break;
    }
    case 3: // 三角
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.95, r * 0.7);
      ctx.lineTo(-r * 0.95, r * 0.7);
      ctx.closePath();
      break;
    case 4: // 六角
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    default: // 星形
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.5;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
  }
}

/**
 * 在 (cx, cy) 畫一顆寶石，size 為格子邊長。
 * @param sprite 寶可夢圖案（已裁掉留白）；為 null 時畫幾何寶石。
 */
export function drawGem(
  ctx: CanvasRenderingContext2D,
  gem: Gem,
  cx: number,
  cy: number,
  size: number,
  scale = 1,
  alpha = 1,
  sprite: Sprite | null = null,
): void {
  if (scale <= 0.01 || alpha <= 0) return; // 消除動畫尾端：不畫，避免半徑為負等錯誤
  const r = size * 0.38 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);

  if (sprite) {
    drawPokemon(ctx, gem, sprite, size, scale);
  } else if (gem.color === RAINBOW_COLOR) {
    const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
    if (g) {
      GEM_COLORS.forEach((c, i) => g.addColorStop(i / GEM_COLORS.length, c));
      g.addColorStop(1, GEM_COLORS[0]);
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = size * 0.05;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 炸彈光暈
    if (gem.special === 'bomb') {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = size * 0.35;
    }
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, GEM_COLORS[gem.color]);
    grad.addColorStop(1, GEM_DARK[gem.color]);
    ctx.fillStyle = grad;
    shapePath(ctx, gem.color, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = size * 0.03;
    ctx.stroke();

    if (gem.special === 'lineH' || gem.special === 'lineV') {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = size * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (gem.special === 'lineH') {
        ctx.moveTo(-r * 0.75, 0);
        ctx.lineTo(r * 0.75, 0);
      } else {
        ctx.moveTo(0, -r * 0.75);
        ctx.lineTo(0, r * 0.75);
      }
      ctx.stroke();
    } else if (gem.special === 'bomb') {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = size * 0.07;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 題目徽章
  if (gem.question) {
    const text = `${gem.question.a}×${gem.question.b}`;
    const fh = size * 0.26;
    ctx.font = `800 ${fh}px system-ui, sans-serif`;
    const w = ctx.measureText(text).width + fh * 0.6;
    const h = fh * 1.25;
    const y = size * 0.18;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    roundRect(ctx, -w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#1b1f3a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, y + fh * 0.05);
  }
  ctx.restore();
}

/** 底色形狀：每種顏色不同，作為顏色之外的第二個辨識線索。 */
function backdropPath(ctx: CanvasRenderingContext2D, color: number, r: number): void {
  ctx.beginPath();
  const poly = (n: number, rot: number) => {
    for (let i = 0; i < n; i++) {
      const a = rot + (Math.PI * 2 * i) / n;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  switch (color) {
    case 0: // 紅：圓
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 1: {
      // 橘：圓角方
      const s = r * 0.92;
      const rad = r * 0.28;
      ctx.moveTo(-s + rad, -s);
      ctx.arcTo(s, -s, s, s, rad);
      ctx.arcTo(s, s, -s, s, rad);
      ctx.arcTo(-s, s, -s, -s, rad);
      ctx.arcTo(-s, -s, s, -s, rad);
      ctx.closePath();
      break;
    }
    case 2: // 黃：菱形
      poly(4, -Math.PI / 2);
      break;
    case 3: // 綠：六角
      poly(6, 0);
      break;
    case 4: // 藍：八角
      poly(8, Math.PI / 8);
      break;
    default: // 紫：五角
      poly(5, -Math.PI / 2);
  }
}

/** 寶可夢圖案：不透明底色形狀 + 像素 sprite + 特殊寶石徽章（呼叫端已 translate 到格子中心）。 */
function drawPokemon(ctx: CanvasRenderingContext2D, gem: Gem, sprite: Sprite, size: number, scale: number): void {
  const isRainbow = gem.color === RAINBOW_COLOR;
  const r = size * 0.47 * scale;

  // 底色
  if (isRainbow) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else {
    ctx.fillStyle = GEM_COLORS[gem.color];
    backdropPath(ctx, gem.color, r);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = size * 0.035;
  ctx.stroke();

  // 炸彈光暈
  if (gem.special === 'bomb') {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = size * 0.35;
  }
  // 角色等比例填滿格子 88%
  const sw = sprite.width;
  const sh = sprite.height;
  const fit = (size * 0.88 * scale) / Math.max(sw, sh);
  const dw = sw * fit;
  const dh = sh * fit;
  // 以裝置像素判斷：放大或等大 → 關平滑保持像素邊緣；縮小才平滑
  const dpr = ctx.getTransform().a || 1;
  ctx.imageSmoothingEnabled = dw * dpr < sw;
  ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
  ctx.imageSmoothingEnabled = true;
  ctx.shadowBlur = 0;

  // 直線寶石：方向箭頭徽章（右上角）
  if (gem.special === 'lineH' || gem.special === 'lineV') {
    const bx = size * 0.3;
    const by = -size * 0.3;
    const br = size * 0.15;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b1f3a';
    ctx.lineWidth = size * 0.045;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const a = br * 0.6;
    const h = br * 0.3;
    if (gem.special === 'lineH') {
      ctx.moveTo(bx - a, by);
      ctx.lineTo(bx + a, by);
      ctx.moveTo(bx + a - h, by - h);
      ctx.lineTo(bx + a, by);
      ctx.lineTo(bx + a - h, by + h);
      ctx.moveTo(bx - a + h, by - h);
      ctx.lineTo(bx - a, by);
      ctx.lineTo(bx - a + h, by + h);
    } else {
      ctx.moveTo(bx, by - a);
      ctx.lineTo(bx, by + a);
      ctx.moveTo(bx - h, by + a - h);
      ctx.lineTo(bx, by + a);
      ctx.lineTo(bx + h, by + a - h);
      ctx.moveTo(bx - h, by - a + h);
      ctx.lineTo(bx, by - a);
      ctx.lineTo(bx + h, by - a + h);
    }
    ctx.stroke();
  } else if (gem.special === 'bomb') {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.06;
    backdropPath(ctx, gem.color, r);
    ctx.stroke();
  } else if (isRainbow) {
    const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
    if (g) {
      GEM_COLORS.forEach((c, i) => g.addColorStop(i / GEM_COLORS.length, c));
      g.addColorStop(1, GEM_COLORS[0]);
    }
    ctx.strokeStyle = g ?? '#ffd166';
    ctx.lineWidth = size * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0, r - size * 0.03 * scale), 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 把 sprite 等比例畫在 (0,0) 中心，最長邊 = box。 */
function drawSpriteFit(ctx: CanvasRenderingContext2D, sprite: Sprite, box: number, ox = 0, oy = 0): void {
  const sw = sprite.width;
  const sh = sprite.height;
  if (!sw || !sh) return;
  const fit = box / Math.max(sw, sh);
  const dw = sw * fit;
  const dh = sh * fit;
  const dpr = ctx.getTransform().a || 1;
  ctx.imageSmoothingEnabled = dw * dpr < sw;
  ctx.drawImage(sprite, ox - dw / 2, oy - dh / 2, dw, dh);
  ctx.imageSmoothingEnabled = true;
}

/** 擋格型障礙（整格）：底板 + 寶可夢（沒有 sprite 時用 emoji）。 */
export function drawBlocker(ctx: CanvasRenderingContext2D, ob: Obstacle, cx: number, cy: number, size: number, sprite: Sprite | null = null): void {
  ctx.save();
  ctx.translate(cx, cy);
  const bg = ob.kind === 'tree' ? '#274c2b' : ob.kind === 'rock' ? '#4a4a55' : '#2f2a3a';
  ctx.fillStyle = bg;
  roundRect(ctx, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92, size * 0.18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = size * 0.035;
  ctx.stroke();
  if (sprite) {
    drawSpriteFit(ctx, sprite, size * 0.84);
  } else {
    ctx.font = `${size * 0.6}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(OBSTACLE_EMOJI[ob.kind], 0, size * 0.04);
  }
  if (ob.kind === 'rock' && ob.hp <= 1) {
    // 裂痕
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = size * 0.045;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, -size * 0.38);
    ctx.lineTo(-size * 0.05, -size * 0.05);
    ctx.lineTo(-size * 0.2, size * 0.2);
    ctx.lineTo(size * 0.1, size * 0.42);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 覆蓋型障礙（畫在寶石上方）。
 * 黑暗：整格蓋住（看不到寶石）＋超音蝠；水窪 / 冰塊：淡色底 + 右下角小徽章，寶石仍看得見。
 */
export function drawOverlay(ctx: CanvasRenderingContext2D, ob: Obstacle, cx: number, cy: number, size: number, sprite: Sprite | null = null): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (ob.kind === 'dark') {
    ctx.fillStyle = '#0a0b16';
    roundRect(ctx, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92, size * 0.18);
    ctx.fill();
    if (sprite) {
      ctx.globalAlpha = 0.85;
      drawSpriteFit(ctx, sprite, size * 0.7);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#6c6f9a';
      ctx.font = `800 ${size * 0.5}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, size * 0.03);
    }
  } else {
    const water = ob.kind === 'water';
    // 淡色外框 + 輕微色調，讓底下寶石維持清楚
    ctx.fillStyle = water ? 'rgba(40, 120, 255, 0.22)' : 'rgba(190, 235, 255, 0.28)';
    roundRect(ctx, -size * 0.47, -size * 0.47, size * 0.94, size * 0.94, size * 0.18);
    ctx.fill();
    ctx.strokeStyle = water ? 'rgba(90, 170, 255, 0.95)' : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.06;
    ctx.stroke();
    if (water) {
      ctx.strokeStyle = 'rgba(200,230,255,0.85)';
      ctx.lineWidth = size * 0.04;
      ctx.beginPath();
      const y = size * 0.36;
      ctx.moveTo(-size * 0.4, y);
      ctx.quadraticCurveTo(-size * 0.25, y - size * 0.08, -size * 0.1, y);
      ctx.quadraticCurveTo(size * 0.05, y + size * 0.08, size * 0.2, y);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = size * 0.04;
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.2);
      ctx.lineTo(-size * 0.25, -size * 0.35);
      ctx.moveTo(-size * 0.4, -size * 0.35);
      ctx.lineTo(-size * 0.25, -size * 0.2);
      ctx.stroke();
    }
    // 右下角徽章
    const bx = size * 0.3;
    const by = size * 0.3;
    const br = size * 0.2;
    ctx.fillStyle = water ? '#2f7fe6' : '#dff3ff';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = size * 0.03;
    ctx.stroke();
    if (sprite) drawSpriteFit(ctx, sprite, br * 1.9, bx, by);
    else {
      ctx.font = `${br * 1.4}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(OBSTACLE_EMOJI[ob.kind], bx, by + br * 0.1);
    }
  }
  ctx.restore();
}
