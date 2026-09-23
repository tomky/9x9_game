// 核心資料型別：純資料，無 DOM 依賴。

export const BOARD_W = 8;
export const BOARD_H = 8;
export const COLOR_COUNT = 6;

/** 寶石顏色 0..5；彩虹寶石為 -1（無色）。 */
export type Color = number;
export const RAINBOW_COLOR = -1;

export type Special = 'none' | 'lineH' | 'lineV' | 'bomb' | 'rainbow';

export interface Question {
  a: number; // 本關開放的乘數（2..9）
  b: number; // 2..9
  answer: number;
}

export interface Gem {
  id: number;
  color: Color;
  special: Special;
  question?: Question;
}

export type ObstacleKind = 'tree' | 'rock' | 'dark' | 'boulder' | 'water' | 'ice';

export interface Obstacle {
  kind: ObstacleKind;
  hp: number;
}

/** 擋格型障礙：佔據格子、無寶石、擋住重力。 */
export const BLOCKER_KINDS: ReadonlySet<ObstacleKind> = new Set(['tree', 'rock', 'boulder']);
/** 覆蓋型障礙：蓋在寶石上。 */
export const OVERLAY_KINDS: ReadonlySet<ObstacleKind> = new Set(['dark', 'water', 'ice']);
/** 一般消除（相鄰 / 直線 / 炸彈）可傷害的障礙。 */
export const BREAKABLE_KINDS: ReadonlySet<ObstacleKind> = new Set(['tree', 'rock', 'dark', 'ice']);
/** 鎖住寶石不可被玩家交換的覆蓋障礙。 */
export const LOCKING_KINDS: ReadonlySet<ObstacleKind> = new Set(['water', 'ice']);

export const OBSTACLE_HP: Record<ObstacleKind, number> = {
  tree: 1,
  rock: 2,
  dark: 1,
  boulder: 1,
  water: 1,
  ice: 1,
};

export interface Cell {
  gem: Gem | null;
  obstacle: Obstacle | null;
}

export interface Board {
  w: number;
  h: number;
  cells: Cell[]; // index = y * w + x
}

export interface Pos {
  x: number;
  y: number;
}

export type AnswerMode = 'choice' | 'keypad';

export interface LevelConfig {
  level: number;
  numbers: number[];
  targetScore: number;
  moves: number;
  obstacles: Record<ObstacleKind, number>;
  questionProb: number;
  initialQuestions: number;
  answerMode: AnswerMode;
}

export interface MatchGroup {
  cells: Pos[];
  color: Color;
  /** 生成的特殊寶石種類（none 表示一般三連）。 */
  spawn: Special;
  /** 特殊寶石生成位置。 */
  spawnAt: Pos | null;
}

export type SkillId = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface ComboStat {
  correct: number;
  wrong: number;
}

export interface NumberStats {
  combos: Record<number, ComboStat>; // key = b (2..9)
  streak: number;
  bestStreak: number;
}

export type GemStyle = 'pokemon' | 'gem';

export interface Settings {
  answerMode: 'auto' | AnswerMode;
  sound: boolean;
  gemStyle: GemStyle;
}

export interface SaveData {
  version: 1;
  level: number;
  highScore: number;
  stats: Record<number, NumberStats>; // key = n (2..9)
  unlockedSkills: SkillId[];
  pp: Partial<Record<SkillId, number>>;
  settings: Settings;
}
