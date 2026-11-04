import * as THREE from 'three';
import { CROPS } from './data';
import { game, bus, growthMult, yieldMult, siloCap, siloUsed, lv, sk, addXp, vitality, type TileSave } from './state';
import { windMat, vcMat } from './gfx';
import { buildCropGeometries, grassTuft, soilGeometry, frameGeometry } from './crops';

export const TILE = 2, PN = 10, PCOUNT = 9, N = PN * PN * PCOUNT;
export interface Parcel { id: number; x0: number; z0: number; fert: number }
const ORDER = [[1, 0], [0, 0], [2, 0], [1, 1], [0, 1], [2, 1], [1, 2], [0, 2], [2, 2]];
const FERT = [1, 1, 1, 1.1, 1.1, 1.1, 1.25, 1.25, 1.25];
export const PARCELS: Parcel[] = ORDER.map(([c, r], id) => ({ id, x0: (c - 1) * 24 - 10, z0: -28 - r * 24, fert: FERT[id] }));
export const FIELD = { x1: -34, x2: 34, z1: -76, z2: -8 };

export const T = {
  s: new Uint8Array(N),          // 0 mato, 1 arado, 2 plantado, 3 restolho
  c: new Int8Array(N).fill(-1),  // cultura
  g: new Float32Array(N),        // crescimento 0..1
  w: new Float32Array(N),        // água 0..1
  f: new Float32Array(N),        // fertilidade
  l: new Int8Array(N).fill(-1),  // última cultura
};
export const owned = new Uint8Array(PCOUNT);
let dirty = true;
export let rain = 0;
export function setRain(r: number) { rain = r; }
export const markDirty = () => { dirty = true; };

export const tileX = (t: number) => PARCELS[(t / 100) | 0].x0 + ((t % 10) + 0.5) * TILE;
export const tileZ = (t: number) => PARCELS[(t / 100) | 0].z0 + ((((t % 100) / 10) | 0) + 0.5) * TILE;
export const isOwned = (t: number) => owned[(t / 100) | 0] === 1;

export function tileAt(x: number, z: number): number {
  if (x < FIELD.x1 || x > FIELD.x2 || z < FIELD.z1 || z > FIELD.z2) return -1;
  for (const p of PARCELS) {
    const i = Math.floor((x - p.x0) / TILE), j = Math.floor((z - p.z0) / TILE);
    if (i >= 0 && i < PN && j >= 0 && j < PN) return p.id * 100 + j * PN + i;
  }
  return -1;
}

export function syncOwned() {
  owned.fill(0);
  for (const id of game.s.parcels) owned[id] = 1;
  dirty = true;
}

export function resetTiles() {
  T.s.fill(0); T.c.fill(-1); T.g.fill(0); T.w.fill(0); T.l.fill(-1);
  for (let t = 0; t < N; t++) T.f[t] = PARCELS[(t / 100) | 0].fert;
  dirty = true;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
export function serialize(): TileSave {
  return { s: Array.from(T.s), c: Array.from(T.c), g: Array.from(T.g, r3), w: Array.from(T.w, r3), f: Array.from(T.f, r3), l: Array.from(T.l) };
}
export function deserialize(d: TileSave | null) {
  resetTiles();
  if (!d || !d.s || d.s.length !== N) return;
  T.s.set(d.s); T.c.set(d.c); T.g.set(d.g); T.w.set(d.w); T.f.set(d.f); T.l.set(d.l);
  dirty = true;
}

/** Canteiros afetados pela ferramenta conforme o nível de área. */
export function area(t: number, a: number): number[] {
  if (t < 0) return [];
  if (a <= 0) return [t];
  const p = (t / 100) | 0, i = t % 10, j = ((t % 100) / 10) | 0;
  const out: number[] = [];
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (a === 1 && di !== 0 && dj !== 0) continue;
    const ii = i + di, jj = j + dj;
    if (ii < 0 || ii >= PN || jj < 0 || jj >= PN) continue;
    out.push(p * 100 + jj * PN + ii);
  }
  return out;
}

export function plow(t: number): boolean {
  if (t < 0 || !isOwned(t)) return false;
  const s = T.s[t];
  if (s !== 0 && s !== 3) return false;
  T.s[t] = 1; T.g[t] = 0;
  game.s.stats.plowed++;
  dirty = true;
  return true;
}

export function plant(t: number, c: number): 'ok' | 'money' | null {
  if (t < 0 || !isOwned(t) || T.s[t] !== 1) return null;
  const C = CROPS[c];
  if (game.s.money < C.seed) return 'money';
  game.s.money -= C.seed;
  T.s[t] = 2; T.c[t] = c; T.g[t] = 0;
  game.s.stats.planted++;
  if (C.id === 'corn') game.s.stats.corn++;
  dirty = true;
  bus.emit('hud');
  return 'ok';
}

export function water(t: number): boolean {
  if (t < 0 || !isOwned(t)) return false;
  const s = T.s[t];
  if ((s !== 1 && s !== 2) || T.w[t] > 0.85) return false;
  T.w[t] = 1;
  game.s.stats.watered++;
  dirty = true;
  return true;
}

export const isRipe = (t: number) => t >= 0 && T.s[t] === 2 && T.g[t] >= 1;

export type HarvestRes = { c: number; units: number; rot: boolean; gold: boolean } | 'full' | null;
export function harvest(t: number, xpMult = 1): HarvestRes {
  if (!isRipe(t)) return null;
  const free = siloCap() - siloUsed();
  if (free <= 0) return 'full';
  const c = T.c[t];
  const C = CROPS[c];
  const raw = yieldMult() * T.f[t];
  let units = Math.floor(raw) + (Math.random() < raw - Math.floor(raw) ? 1 : 0);
  const gold = sk('a6') > 0 && Math.random() < 0.06;
  if (gold) units *= 5;
  units = Math.max(1, Math.min(units, free));
  const inv = game.s.inv;
  inv[C.id] = (inv[C.id] || 0) + units;
  const last = T.l[t];
  const rot = last >= 0 && last !== c;
  const m4 = sk('a4') > 0;
  if (last === c) T.f[t] = Math.max(0.6, T.f[t] - (m4 ? 0.04 : 0.08));
  else if (rot) T.f[t] = Math.min(m4 ? 1.8 : 1.6, T.f[t] + (m4 ? 0.2 : 0.1));
  T.l[t] = c; T.s[t] = 3; T.g[t] = 0; T.c[t] = -1; T.w[t] *= 0.6;
  game.s.stats.harvested++;
  addXp(Math.max(1, Math.round(C.xp * xpMult)));
  dirty = true;
  return { c, units, rot, gold };
}

/** Simulação do campo (crescimento e água). */
export function step(dt: number) {
  const gm = growthMult();
  const drain = 0.011 / (1 + 0.15 * lv('retain')) / (1 + 0.12 * sk('a2'));
  const spr = lv('sprinkler') * 0.012;
  const delta = (spr + rain - drain) * dt;
  for (let t = 0; t < N; t++) {
    if (!owned[(t / 100) | 0]) continue;
    const s = T.s[t];
    if (s === 1 || s === 2) {
      const w = T.w[t] + delta;
      T.w[t] = w < 0 ? 0 : w > 1 ? 1 : w;
      if (s === 2 && T.g[t] < 1) {
        const C = CROPS[T.c[t]];
        T.g[t] += (dt / C.time) * gm * (0.3 + 0.7 * Math.min(1, T.w[t] * 2.5));
        if (T.g[t] >= 1) T.g[t] = 1;
      }
    }
  }
}

let scan = 0;
export function findRipe(): number {
  for (let k = 0; k < N; k++) {
    scan = (scan + 1) % N;
    if (owned[(scan / 100) | 0] && isRipe(scan)) return scan;
  }
  return -1;
}

export function randomRipe(): number {
  for (let k = 0; k < 12; k++) {
    const t = (Math.random() * N) | 0;
    if (owned[(t / 100) | 0] && isRipe(t)) return t;
  }
  return -1;
}

export function countState(): { ripe: number; growing: number; dry: number } {
  let ripe = 0, growing = 0, dry = 0;
  for (let t = 0; t < N; t++) {
    if (!owned[(t / 100) | 0] || T.s[t] !== 2) continue;
    if (T.g[t] >= 1) ripe++; else { growing++; if (T.w[t] < 0.1) dry++; }
  }
  return { ripe, growing, dry };
}

// ---------------------------------------------------------------- Visual
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const pv = new THREE.Vector3();
const sv = new THREE.Vector3();
const col = new THREE.Color();
const C_DRY = new THREE.Color(0xa06d42), C_WET = new THREE.Color(0x4e301b), C_STUB = new THREE.Color(0xc9a35a);
const C_YOUNG = new THREE.Color(0.45, 0.85, 0.35), C_WHITE = new THREE.Color(1, 1, 1);
const G_DRY = new THREE.Color(0xc4ad62), G_LUSH = new THREE.Color(0x76c255), G_FDRY = new THREE.Color(0xb59a55), G_FLUSH = new THREE.Color(0x66ab48);

export class FarmView {
  soil: THREE.InstancedMesh;
  grass: THREE.InstancedMesh;
  crops: THREE.InstancedMesh[];
  frames: THREE.InstancedMesh;
  private timer = 0;

  constructor(scene: THREE.Scene, high: boolean) {
    this.soil = new THREE.InstancedMesh(soilGeometry(), vcMat, N);
    this.soil.receiveShadow = true;
    this.grass = new THREE.InstancedMesh(grassTuft(), windMat(0.12, { side: THREE.DoubleSide, flatShading: false }), N);
    this.grass.receiveShadow = true;
    const cropMat = windMat(0.05, { side: THREE.DoubleSide });
    this.crops = buildCropGeometries().map((g) => {
      const m = new THREE.InstancedMesh(g, cropMat, N);
      m.castShadow = high; m.receiveShadow = true;
      return m;
    });
    const fm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    this.frames = new THREE.InstancedMesh(frameGeometry(), fm, 9);
    this.frames.count = 0;
    this.frames.renderOrder = 5;
    for (const m of [this.soil, this.grass, ...this.crops, this.frames]) {
      m.setColorAt(0, col.set(0xffffff));
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    }
  }

  setHighlight(tiles: number[], color: number) {
    const f = this.frames;
    f.count = tiles.length;
    col.set(color);
    tiles.forEach((t, i) => {
      m4.makeTranslation(tileX(t), 0.22, tileZ(t));
      f.setMatrixAt(i, m4);
      f.setColorAt(i, col);
    });
    f.instanceMatrix.needsUpdate = true;
    if (f.instanceColor) f.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    this.timer -= dt;
    if (!dirty && this.timer > 0) return;
    this.timer = 0.15;
    dirty = false;
    const vit = vitality(game.s);
    const gOwn = new THREE.Color().copy(G_DRY).lerp(G_LUSH, vit);
    const gFree = new THREE.Color().copy(G_FDRY).lerp(G_FLUSH, vit * 0.8);
    let ns = 0, ng = 0;
    const nc = new Array(this.crops.length).fill(0);
    for (let t = 0; t < N; t++) {
      const own = owned[(t / 100) | 0] === 1;
      const x = tileX(t), z = tileZ(t);
      const s = T.s[t];
      if (s === 0) {
        q.setFromAxisAngle(up, (t * 2.399) % 6.283);
        const k = own ? 1 : 1.45;
        m4.compose(pv.set(x, 0, z), q, sv.set(1, k, 1));
        this.grass.setMatrixAt(ng, m4);
        this.grass.setColorAt(ng, own ? gOwn : gFree);
        ng++;
        continue;
      }
      m4.makeTranslation(x, 0, z);
      this.soil.setMatrixAt(ns, m4);
      if (s === 3) col.copy(C_STUB).lerp(C_WET, T.w[t] * 0.5);
      else col.copy(C_DRY).lerp(C_WET, T.w[t]);
      this.soil.setColorAt(ns, col);
      ns++;
      if (s === 2) {
        const c = T.c[t];
        const g = T.g[t];
        const ripe = g >= 1;
        const sy = 0.12 + 0.88 * g;
        const sxz = 0.35 + 0.65 * Math.min(1, g * 1.4);
        q.setFromAxisAngle(up, ((t * 7) % 4) * (Math.PI / 2));
        m4.compose(pv.set(x, 0.1, z), q, sv.set(sxz, ripe ? 1.04 : sy, sxz));
        const mesh = this.crops[c];
        mesh.setMatrixAt(nc[c], m4);
        const k = Math.max(0, Math.min(1, (g - 0.45) / 0.55));
        col.copy(C_YOUNG).lerp(C_WHITE, k);
        if (ripe) col.multiplyScalar(1.12);
        else if (T.w[t] < 0.08) col.multiply(new THREE.Color(0.9, 0.82, 0.6));
        mesh.setColorAt(nc[c], col);
        nc[c]++;
      }
    }
    this.soil.count = ns;
    this.grass.count = ng;
    this.crops.forEach((m, i) => { m.count = nc[i]; });
    for (const m of [this.soil, this.grass, ...this.crops]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
