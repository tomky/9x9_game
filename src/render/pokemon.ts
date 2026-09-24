// 寶石 → 寶可夢圖案對應表與 sprite 載入。
// 圖檔在執行時從 PokeAPI/sprites 載入（不放進 repo）；載入失敗時 renderer 會退回幾何寶石。

import { Gem, ObstacleKind, RAINBOW_COLOR, SkillId } from '../core/types';

export interface PokemonFamily {
  /** [1 階（一般）, 2 階（直線寶石）, 3 階（炸彈寶石）] 的全國圖鑑編號 */
  ids: [number, number, number];
  names: [string, string, string];
}

/** key = 寶石顏色 index 0..5 */
export const POKEMON_FAMILIES: Record<number, PokemonFamily> = {
  0: { ids: [4, 5, 6], names: ['小火龍', '火恐龍', '噴火龍'] },
  1: { ids: [16, 17, 18], names: ['波波', '比比鳥', '大比鳥'] },
  2: { ids: [172, 25, 26], names: ['皮丘', '皮卡丘', '雷丘'] },
  3: { ids: [1, 2, 3], names: ['妙蛙種子', '妙蛙草', '妙蛙花'] },
  4: { ids: [7, 8, 9], names: ['傑尼龜', '卡咪龜', '水箭龜'] },
  5: { ids: [92, 93, 94], names: ['鬼斯', '鬼斯通', '耿鬼'] },
};

export const RAINBOW_POKEMON = { id: 151, name: '夢幻' };

/** 障礙對應的寶可夢（畫在盤面上）。 */
export const OBSTACLE_POKEMON: Record<ObstacleKind, { id: number; name: string }> = {
  tree: { id: 185, name: '樹才怪' },
  rock: { id: 74, name: '小拳石' },
  boulder: { id: 76, name: '隆隆岩' },
  dark: { id: 41, name: '超音蝠' },
  water: { id: 60, name: '蚊香蝌蚪' },
  ice: { id: 582, name: '迷你冰' },
};

/** 技能對應的寶可夢（技能列 / 解鎖畫面圖示）。 */
export const SKILL_POKEMON: Record<SkillId, { id: number; name: string }> = {
  2: { id: 123, name: '飛天螳螂' },
  3: { id: 66, name: '腕力' },
  4: { id: 171, name: '燈籠魚' },
  5: { id: 68, name: '怪力' },
  6: { id: 131, name: '拉普拉斯' },
  7: { id: 38, name: '九尾' },
  8: { id: 144, name: '急凍鳥' },
  9: { id: 243, name: '雷公' },
};

export const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white';

export function spriteUrl(id: number): string {
  return `${SPRITE_BASE}/${id}.png`;
}

/** 選單用小圖示（DOM 技能列 / 關卡前導用）。 */
export const ICON_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-vii/icons';
export function iconUrl(id: number): string {
  return `${ICON_BASE}/${id}.png`;
}

/** 產生帶 emoji 備援的 <img>：圖載入失敗時顯示 emoji。 */
export function iconImg(id: number, emoji: string, cls = 'pk-icon'): string {
  return `<span class="pk ${cls}"><img src="${iconUrl(id)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('fallback')"><span class="pk-emoji">${emoji}</span></span>`;
}

export function stageOf(gem: Gem): 0 | 1 | 2 {
  switch (gem.special) {
    case 'lineH':
    case 'lineV':
      return 1;
    case 'bomb':
      return 2;
    default:
      return 0;
  }
}

export function pokemonIdFor(gem: Gem): number {
  if (gem.color === RAINBOW_COLOR) return RAINBOW_POKEMON.id;
  return POKEMON_FAMILIES[gem.color].ids[stageOf(gem)];
}

export function pokemonNameFor(gem: Gem): string {
  if (gem.color === RAINBOW_COLOR) return RAINBOW_POKEMON.name;
  return POKEMON_FAMILIES[gem.color].names[stageOf(gem)];
}

/** 盤面會用到的所有 sprite（寶石家族 + 夢幻 + 障礙）。 */
export function allPokemonIds(): number[] {
  const ids = Object.values(POKEMON_FAMILIES).flatMap((f) => f.ids);
  ids.push(RAINBOW_POKEMON.id);
  for (const o of Object.values(OBSTACLE_POKEMON)) ids.push(o.id);
  return ids;
}

/** 裁掉透明留白後的圖案。 */
export type Sprite = HTMLCanvasElement | HTMLImageElement;

/** 平行載入所有 sprite 並裁掉四周透明留白；單張失敗只記錄，不影響其他。 */
export class SpriteStore {
  private images = new Map<number, Sprite>();
  private loading: Promise<void> | null = null;

  get ready(): boolean {
    return this.images.size > 0;
  }

  get(id: number): Sprite | null {
    return this.images.get(id) ?? null;
  }

  load(): Promise<void> {
    this.loading ??= Promise.all(allPokemonIds().map((id) => this.loadOne(id))).then(() => undefined);
    return this.loading;
  }

  private loadOne(id: number): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.images.set(id, cropTransparent(img));
        resolve();
      };
      img.onerror = () => {
        console.warn(`[pokemon] sprite ${id} 載入失敗，改用幾何寶石`);
        resolve();
      };
      img.src = spriteUrl(id);
    });
  }
}

/**
 * 把圖片四周的透明留白裁掉（Gen V sprite 角色只佔中間約一半）。
 * 跨域取像素失敗時退回原圖。
 */
export function cropTransparent(img: HTMLImageElement, margin = 1): Sprite {
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const sctx = src.getContext('2d')!;
    sctx.drawImage(img, 0, 0);
    const data = sctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return img;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(w - 1, maxX + margin);
    maxY = Math.min(h - 1, maxY + margin);
    const out = document.createElement('canvas');
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext('2d')!.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  } catch {
    return img;
  }
}
