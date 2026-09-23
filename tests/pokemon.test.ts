import { describe, expect, it } from 'vitest';
import { allPokemonIds, pokemonIdFor, pokemonNameFor, POKEMON_FAMILIES, RAINBOW_POKEMON, spriteUrl } from '../src/render/pokemon';
import { Gem } from '../src/core/types';

const gem = (color: number, special: Gem['special'] = 'none'): Gem => ({ id: 1, color, special });

describe('寶可夢對應表', () => {
  it('6 家族 × 3 階 + 夢幻 = 19 個不重複的圖鑑編號', () => {
    expect(Object.keys(POKEMON_FAMILIES)).toHaveLength(6);
    const ids = allPokemonIds();
    expect(ids).toHaveLength(19);
    expect(new Set(ids).size).toBe(19);
  });

  it('一般→1 階、直線→2 階、炸彈→3 階、彩虹→夢幻', () => {
    expect(pokemonIdFor(gem(0))).toBe(4);
    expect(pokemonIdFor(gem(0, 'lineH'))).toBe(5);
    expect(pokemonIdFor(gem(0, 'lineV'))).toBe(5);
    expect(pokemonIdFor(gem(0, 'bomb'))).toBe(6);
    expect(pokemonIdFor(gem(-1, 'rainbow'))).toBe(RAINBOW_POKEMON.id);
    expect(pokemonNameFor(gem(2, 'lineH'))).toBe('皮卡丘');
    expect(pokemonNameFor(gem(1))).toBe('波波');
  });

  it('sprite 網址', () => {
    expect(spriteUrl(25)).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/25.png',
    );
  });
});
