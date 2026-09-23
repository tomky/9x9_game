// 寶石 → 寶可夢圖案對應表與 sprite 載入。
// 圖檔在執行時從 PokeAPI/sprites 載入（不放進 repo）；載入失敗時 renderer 會退回幾何寶石。

import { Gem, RAINBOW_COLOR } from '../core/types';

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

export const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white';

export function spriteUrl(id: number): string {
  return `${SPRITE_BASE}/${id}.png`;
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

export function allPokemonIds(): number[] {
  const ids = Object.values(POKEMON_FAMILIES).flatMap((f) => f.ids);
  ids.push(RAINBOW_POKEMON.id);
  return ids;
}

/** 平行載入所有 sprite；單張失敗只記錄，不影響其他。 */
export class SpriteStore {
  private images = new Map<number, HTMLImageElement>();
  private loading: Promise<void> | null = null;

  get ready(): boolean {
    return this.images.size > 0;
  }

  get(id: number): HTMLImageElement | null {
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
        this.images.set(id, img);
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
