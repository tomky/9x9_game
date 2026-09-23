// 用 Canvas 程式繪製寶石與障礙（不需外部圖檔）。

import { Gem, Obstacle, RAINBOW_COLOR } from '../core/types';

export const GEM_COLORS = ['#ff5c7a', '#ff9f43', '#ffe66d', '#3ddc84', '#4cc9f0', '#c77dff'];
const GEM_DARK = ['#b4243f', '#c2601b', '#c4a520', '#1d8f52', '#1d7fa8', '#7a3fc4'];

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
 * @param sprite 寶可夢圖案；為 null 時畫幾何寶石。
 */
export function drawGem(
  ctx: CanvasRenderingContext2D,
  gem: Gem,
  cx: number,
  cy: number,
  size: number,
  scale = 1,
  alpha = 1,
  sprite: HTMLImageElement | null = null,
): void {
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

/** 寶可夢圖案：顏色底圓 + 像素 sprite + 特殊寶石徽章（呼叫端已 translate 到格子中心）。 */
function drawPokemon(ctx: CanvasRenderingContext2D, gem: Gem, sprite: HTMLImageElement, size: number, scale: number): void {
  const isRainbow = gem.color === RAINBOW_COLOR;
  const r = size * 0.44 * scale;

  // 底圓：保留顏色線索，讓小朋友知道要連哪三個
  ctx.save();
  if (isRainbow) {
    const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
    if (g) {
      GEM_COLORS.forEach((c, i) => g.addColorStop(i / GEM_COLORS.length, c));
      g.addColorStop(1, GEM_COLORS[0]);
    }
    ctx.fillStyle = g ?? '#ffffff';
    ctx.globalAlpha *= 0.55;
  } else {
    ctx.fillStyle = GEM_COLORS[gem.color];
    ctx.globalAlpha *= 0.5;
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 炸彈光暈
  if (gem.special === 'bomb') {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = size * 0.35;
  }
  // BW sprite 四周有留白，放大一點填滿格子
  const s = size * 1.25 * scale;
  // 放大時保留像素感；縮小時用平滑避免鋸齒
  ctx.imageSmoothingEnabled = s < sprite.naturalWidth;
  ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
  ctx.shadowBlur = 0;

  // 直線寶石：方向箭頭徽章（右下角）
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
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (isRainbow) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.05;
    ctx.setLineDash([size * 0.08, size * 0.06]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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

/** 擋格型障礙（整格）。 */
export function drawBlocker(ctx: CanvasRenderingContext2D, ob: Obstacle, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  const bg = ob.kind === 'tree' ? '#274c2b' : ob.kind === 'rock' ? '#4a4a55' : '#2f2a3a';
  ctx.fillStyle = bg;
  roundRect(ctx, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92, size * 0.18);
  ctx.fill();
  ctx.font = `${size * 0.6}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(OBSTACLE_EMOJI[ob.kind], 0, size * 0.04);
  if (ob.kind === 'rock' && ob.hp <= 1) {
    // 裂痕
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, -size * 0.35);
    ctx.lineTo(-size * 0.05, -size * 0.05);
    ctx.lineTo(-size * 0.2, size * 0.2);
    ctx.lineTo(size * 0.1, size * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** 覆蓋型障礙（畫在寶石上方）。黑暗會完全遮住寶石。 */
export function drawOverlay(ctx: CanvasRenderingContext2D, ob: Obstacle, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (ob.kind === 'dark') {
    ctx.fillStyle = '#0a0b16';
    roundRect(ctx, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92, size * 0.18);
    ctx.fill();
    ctx.fillStyle = '#6c6f9a';
    ctx.font = `800 ${size * 0.5}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, size * 0.03);
  } else if (ob.kind === 'water') {
    ctx.fillStyle = 'rgba(40, 120, 255, 0.45)';
    roundRect(ctx, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92, size * 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,255,0.9)';
    ctx.lineWidth = size * 0.05;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      const y = i * size * 0.22;
      ctx.moveTo(-size * 0.34, y);
      ctx.quadraticCurveTo(-size * 0.17, y - size * 0.1, 0, y);
      ctx.quadraticCurveTo(size * 0.17, y + size * 0.1, size * 0.34, y);
      ctx.stroke();
    }
  } else if (ob.kind === 'ice') {
    ctx.fillStyle = 'rgba(190, 235, 255, 0.55)';
    roundRect(ctx, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92, size * 0.18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.05;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, -size * 0.1);
    ctx.lineTo(-size * 0.05, size * 0.15);
    ctx.moveTo(size * 0.05, -size * 0.3);
    ctx.lineTo(size * 0.3, 0);
    ctx.stroke();
  }
  ctx.restore();
}
