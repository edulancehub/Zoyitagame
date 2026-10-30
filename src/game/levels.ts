export const VIEW_W = 960;
export const VIEW_H = 540;
export const GROUND_Y = 470;

export type Theme = 'canopy' | 'ruins' | 'lagoon';
export type PlatformKind = 'wood' | 'stone' | 'leaf';

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  kind: PlatformKind;
  move?: { dx: number; dy: number; period: number };
}

export interface LevelDef {
  title: string;
  hint: string;
  secret: string;
  theme: Theme;
  width: number;
  spawn: number;
  ground: [number, number][];
  platforms: PlatformDef[];
  springs: number[];
  thorns: { x: number; w: number }[];
  hearts: [number, number][];
  flowers: [number, number][];
  goal: number;
}

export const LEVELS: LevelDef[] = [
  {
    title: 'The Whispering Canopy',
    hint: 'Find the 3 hearts to open the shrine',
    secret: 'I',
    theme: 'canopy',
    width: 2600,
    spawn: 80,
    ground: [[0, 640], [750, 1250], [1380, 1900], [2020, 2600]],
    platforms: [
      { x: 300, y: 380, w: 120, kind: 'wood' },
      { x: 480, y: 300, w: 110, kind: 'leaf' },
      { x: 900, y: 370, w: 120, kind: 'wood' },
      { x: 1080, y: 290, w: 110, kind: 'stone' },
      { x: 1250, y: 380, w: 130, kind: 'wood' },
      { x: 1500, y: 380, w: 110, kind: 'leaf' },
      { x: 1660, y: 300, w: 110, kind: 'wood' },
      { x: 1820, y: 220, w: 110, kind: 'stone' },
      { x: 2150, y: 370, w: 120, kind: 'wood' },
    ],
    springs: [],
    thorns: [],
    hearts: [[535, 266], [1135, 256], [1875, 186]],
    flowers: [
      [200, 440], [360, 345], [820, 440], [960, 335], [1315, 345],
      [1450, 440], [1555, 345], [1715, 265], [2100, 440], [2210, 335],
    ],
    goal: 2460,
  },
  {
    title: 'The Moonlit Ruins',
    hint: 'Ride the moving logs, bounce on mushrooms, avoid thorns',
    secret: 'love u',
    theme: 'ruins',
    width: 3000,
    spawn: 80,
    ground: [[0, 560], [700, 1100], [1500, 1900], [2300, 3000]],
    platforms: [
      { x: 250, y: 380, w: 110, kind: 'stone' },
      { x: 420, y: 300, w: 100, kind: 'stone' },
      { x: 590, y: 390, w: 90, kind: 'wood' },
      { x: 820, y: 370, w: 110, kind: 'stone' },
      { x: 980, y: 290, w: 100, kind: 'stone' },
      { x: 1130, y: 400, w: 100, kind: 'wood', move: { dx: 260, dy: 0, period: 260 } },
      { x: 1600, y: 380, w: 100, kind: 'stone' },
      { x: 1960, y: 230, w: 110, kind: 'stone' },
      { x: 2140, y: 330, w: 100, kind: 'wood', move: { dx: 0, dy: 80, period: 200 } },
      { x: 2450, y: 380, w: 110, kind: 'stone' },
      { x: 2620, y: 300, w: 100, kind: 'leaf' },
    ],
    springs: [1840],
    thorns: [{ x: 1700, w: 70 }],
    hearts: [[470, 266], [1030, 256], [2015, 196]],
    flowers: [
      [150, 440], [305, 345], [635, 355], [875, 335], [1550, 440],
      [1735, 390], [2400, 440], [2505, 345], [2670, 265], [2780, 440],
    ],
    goal: 2860,
  },
  {
    title: 'The Starlight Lagoon',
    hint: 'The last secret is hidden here. Take your time',
    secret: 'Zoyita',
    theme: 'lagoon',
    width: 3300,
    spawn: 80,
    ground: [[0, 500], [1000, 1300], [2000, 2300], [2900, 3300]],
    platforms: [
      { x: 300, y: 380, w: 100, kind: 'leaf' },
      { x: 560, y: 400, w: 90, kind: 'wood' },
      { x: 720, y: 320, w: 90, kind: 'leaf' },
      { x: 880, y: 320, w: 90, kind: 'wood', move: { dx: 0, dy: 80, period: 180 } },
      { x: 1360, y: 200, w: 100, kind: 'stone' },
      { x: 1500, y: 260, w: 90, kind: 'wood', move: { dx: 200, dy: 0, period: 220 } },
      { x: 1830, y: 360, w: 100, kind: 'leaf' },
      { x: 2350, y: 390, w: 80, kind: 'wood' },
      { x: 2480, y: 310, w: 80, kind: 'stone' },
      { x: 2610, y: 230, w: 80, kind: 'leaf' },
      { x: 2740, y: 360, w: 90, kind: 'wood', move: { dx: 80, dy: 0, period: 160 } },
    ],
    springs: [1250],
    thorns: [{ x: 1120, w: 60 }, { x: 2110, w: 70 }],
    hearts: [[765, 286], [1410, 166], [2650, 196]],
    flowers: [
      [200, 440], [350, 345], [605, 365], [1050, 440], [1150, 395],
      [1880, 325], [2050, 440], [2390, 355], [2520, 275], [3000, 440],
    ],
    goal: 3160,
  },
];
