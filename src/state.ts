export interface Stats {
  plowed: number; planted: number; watered: number; harvested: number;
  sold: number; maxCombo: number; flour: number; oil: number; corn: number;
  kills: number; runOver: number;
}
export interface TileSave { s: number[]; c: number[]; g: number[]; w: number[]; f: number[]; l: number[]; k?: number[] }
export interface Order { item: string; qty: number; bonus: number; time: number }
export interface Settings { sound: boolean; quality: 'auto' | 'low' | 'high'; diff?: 'easy' | 'normal' | 'hard' }

export interface State {
  v: number;
  money: number; xp: number; level: number; totalEarned: number;
  legacy: number; prestiges: number;
  inv: Record<string, number>;
  up: Record<string, number>;
  parcels: number[];
  goal: number;
  stats: Stats;
  tool: number; crop: number; can: number; implement: number;
  dayTime: number; clock: number;
  px: number; pz: number; yaw: number;
  tx: number; tz: number; tyaw: number; inTractor: boolean;
  order: Order | null;
  tiles: TileSave | null;
  saved: number;
  settings: Settings;
  skills: Record<string, number>;
  tpCam: boolean;
  phase: 'day' | 'night';
  phaseT: number;
  nights: number;
  baseHp: number;
  walls: { type: number; x: number; z: number; rot: number; hp: number }[];
  res: Record<string, number>;
  entries: number[];
  buffs: Record<string, number>;
  weapon: string;
  storySeen: boolean;
  rescueAt: number;
  rescued: boolean;
}

export const DAY_LEN = 240;
export const dayLen = (nights: number) => (nights === 0 ? 240 : 180);
/** multiplicador de dificuldade: [quantidade, vida, dano] */
export const diffK = () => ({ easy: [0.65, 0.7, 0.7], normal: [1, 1, 1], hard: [1.35, 1.4, 1.3] }[game.s.settings.diff ?? 'normal']);

export function newState(legacy = 0, prestiges = 0, settings?: Settings): State {
  return {
    v: 1, money: 80 + legacy * 100, xp: 0, level: 1, totalEarned: 0, legacy, prestiges,
    inv: {}, up: {}, parcels: [0], goal: prestiges > 0 ? 5 : 0,
    stats: { plowed: 0, planted: 0, watered: 0, harvested: 0, sold: 0, maxCombo: 0, flour: 0, oil: 0, corn: 0, kills: 0, runOver: 0 },
    tool: 0, crop: 0, can: 12, implement: 0,
    dayTime: 0.06, clock: 0,
    px: 0, pz: 10, yaw: 0,
    tx: 10, tz: -2, tyaw: 0, inTractor: false,
    order: null, tiles: null, saved: Date.now(),
    settings: settings ?? { sound: true, quality: 'auto' },
    skills: {}, tpCam: true,
    phase: 'day', phaseT: DAY_LEN, nights: 0, baseHp: 150, walls: [], res: { wood: 12, metal: 3, mseed: 0, food: 2 }, entries: [], buffs: {}, weapon: 'pa', storySeen: false, rescueAt: 0, rescued: false,
  };
}

type Fn = (...a: any[]) => void;
const handlers: Record<string, Fn[]> = {};
export const bus = {
  on(e: string, f: Fn) { (handlers[e] ||= []).push(f); },
  emit(e: string, ...a: any[]) { for (const f of handlers[e] || []) f(...a); },
};

export const game = { s: newState() };
export const lv = (id: string) => game.s.up[id] || 0;
export const sk = (id: string) => game.s.skills[id] || 0;
/** bônus genéricos da árvore de habilidades (em %) */
export const statCache: Record<string, number> = {};
export const stat = (k: string) => statCache[k] || 0;
export const pct = (k: string) => 1 + stat(k) / 100;

export const xpNeed = (l: number) => Math.floor(40 * Math.pow(1.45, l - 1));
export const growthMult = () => (1 + 0.12 * lv('growth')) * (1 + 0.05 * game.s.legacy) * pct('growth') * (game.s.buffs?.fert ? 1.4 : 1);
export const yieldMult = () => (1 + 0.15 * lv('yield')) * pct('yield');
export const sellMult = () => (1 + 0.06 * lv('price')) * (1 + 0.1 * game.s.legacy) * pct('sell') * (sk('c6') ? 1.15 : 1);
export const siloCap = () => Math.round(80 * (1 + lv('silo')) );
export const siloUsed = () => { let n = 0; for (const k in game.s.inv) n += game.s.inv[k]; return n; };
export const canCap = () => 12 + 12 * lv('can') + stat('can');
export const walkSpeed = () => 4.6 * (1 + 0.1 * lv('boots')) * pct('walk');
export const tractorSpeed = () => 7 * (1 + 0.15 * lv('engine')) * pct('tractor');
export const implWidth = () => 1 + 2 * lv('width') + 2 * sk('m6');
export const legacyGain = (s: State) => Math.max(1, Math.floor(s.nights / 2));
export const baseMax = () => Math.round(150 * (1 + 0.5 * lv('fort')) * pct('base'));
export const playerMax = () => 100 + 40 * lv('medkit') + stat('uhp') + (game.s.buffs?.soup ? 40 : 0);

export function era(s: State): number {
  if (s.nights >= 15 || s.prestiges > 0) return 4;
  if ((s.up.robots || 0) > 0) return 3;
  if ((s.up.fort || 0) >= 2 || s.nights >= 6) return 2;
  if ((s.up.tractor || 0) > 0) return 1;
  return 0;
}

export function vitality(s: State): number {
  const v = ((s.level - 1) / 11) * 0.45 + Math.min(1, s.nights / 15) * 0.35 + ((s.parcels.length - 1) / 8) * 0.2 + s.prestiges * 0.1;
  return Math.max(0, Math.min(1, v));
}

export function addXp(n: number) {
  const s = game.s;
  s.xp += n;
  while (s.xp >= xpNeed(s.level)) {
    s.xp -= xpNeed(s.level);
    s.level++;
    bus.emit('level', s.level);
  }
  bus.emit('hud');
}

export function earn(n: number) {
  game.s.money += n;
  game.s.totalEarned += n;
  bus.emit('hud');
}

export function spend(n: number): boolean {
  if (game.s.money < n) return false;
  game.s.money -= n;
  bus.emit('hud');
  return true;
}

export function fmt(n: number): string {
  const neg = n < 0; n = Math.abs(n);
  let out: string;
  if (n < 10000) out = Math.floor(n).toLocaleString('pt-BR');
  else {
    const u = ['', 'k', 'M', 'B', 'T', 'Q'];
    let i = 0, v = n;
    while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
    out = v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace('.', ',') + u[i];
  }
  return (neg ? '-$' : '$') + out;
}

const KEY = 'terraviva-ultima-v1';

export function save(tiles: TileSave) {
  const s = game.s;
  s.tiles = tiles;
  s.saved = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage indisponível */ }
}

export function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const base = newState();
    return { ...base, ...d, stats: { ...base.stats, ...d.stats }, settings: { ...base.settings, ...d.settings }, skills: { ...(d.skills || {}) }, res: { ...base.res, ...(d.res || {}) } };
  } catch { return null; }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch { /* */ }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
