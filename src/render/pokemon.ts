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

/** 障礙對應的遊戲道具圖示（PokeAPI items）。 */
export const OBSTACLE_ITEMS: Record<ObstacleKind, { item: string; name: string }> = {
  tree: { item: 'leaf-stone', name: '葉之石' },
  rock: { item: 'hard-stone', name: '硬石頭' },
  boulder: { item: 'smooth-rock', name: '光滑岩石' },
  dark: { item: 'dusk-stone', name: '暗之石' },
  water: { item: 'mystic-water', name: '神秘水滴' },
  ice: { item: 'never-melt-ice', name: '不融冰' },
};

/** 技能對應的招式機 / 道具圖示（技能列、解鎖畫面）。 */
export const SKILL_ITEMS: Record<SkillId, { item: string; name: string }> = {
  2: { item: 'hm-normal', name: '秘傳機' },
  3: { item: 'hm-fighting', name: '秘傳機' },
  4: { item: 'light-ball', name: '電氣球' },
  5: { item: 'macho-brace', name: '強制鍛鍊器' },
  6: { item: 'hm-water', name: '秘傳機' },
  7: { item: 'tm-fire', name: '招式機' },
  8: { item: 'tm-ice', name: '招式機' },
  9: { item: 'tm-electric', name: '招式機' },
};

export const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white';

export function spriteUrl(id: number): string {
  return `${SPRITE_BASE}/${id}.png`;
}

/** 道具圖示（30×30 像素）。 */
export const ITEM_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';
export function itemUrl(item: string): string {
  return `${ITEM_BASE}/${item}.png`;
}

/** 產生帶 emoji 備援的道具 <img>：圖載入失敗時顯示 emoji。 */
export function itemImg(item: string, emoji: string, cls = 'pk-icon'): string {
  return `<span class="pk ${cls}"><img src="${itemUrl(item)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('fallback')"><span class="pk-emoji">${emoji}</span></span>`;
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

/** 盤面會用到的所有寶可夢 sprite（寶石家族 + 夢幻）。 */
export function allPokemonIds(): number[] {
  const ids = Object.values(POKEMON_FAMILIES).flatMap((f) => f.ids);
  ids.push(RAINBOW_POKEMON.id);
  return ids;
}

/** 盤面會用到的所有道具圖示（障礙）。 */
export function allObstacleItems(): string[] {
  return Object.values(OBSTACLE_ITEMS).map((o) => o.item);
}

/** 裁掉透明留白後的圖案。 */
export type Sprite = HTMLCanvasElement | HTMLImageElement;

/** 平行載入所有 sprite（寶可夢 + 道具）並裁掉四周透明留白；單張失敗只記錄，不影響其他。 */
export class SpriteStore {
  private images = new Map<string, Sprite>();
  private loading: Promise<void> | null = null;

  /** 至少有一張寶可夢 sprite 載入成功。 */
  get ready(): boolean {
    return allPokemonIds().some((id) => this.images.has(`p:${id}`));
  }

  get(id: number): Sprite | null {
    return this.images.get(`p:${id}`) ?? null;
  }

  getItem(item: string): Sprite | null {
    return this.images.get(`i:${item}`) ?? null;
  }

  load(): Promise<void> {
    this.loading ??= Promise.all([
      ...allPokemonIds().map((id) => this.loadOne(`p:${id}`, spriteUrl(id))),
      ...allObstacleItems().map((item) => this.loadOne(`i:${item}`, itemUrl(item))),
    ]).then(() => undefined);
    return this.loading;
  }

  private loadOne(key: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.images.set(key, cropTransparent(img));
        resolve();
      };
      img.onerror = () => {
        console.warn(`[pokemon] ${key} 載入失敗，改用備援圖形`);
        resolve();
      };
      img.src = url;
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
