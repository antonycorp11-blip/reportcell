import * as THREE from 'three';
import { part, merge, cone, cyl, ico, box, shade, rng } from './gfx';
import { T, N, owned, tileX, tileZ, markDirty } from './farm';
import type { FX } from './fx';

type G = THREE.BufferGeometry;
const W = 0xffffff, K = 0x141414;

/** Olhos com sobrancelhas bravas, voltados para -z. */
function eyes(P: G[], y: number, z: number, sep = 0.12, r = 0.075) {
  for (const sx of [-1, 1]) {
    P.push(part(ico(r, 1), W, [sx * sep, y, z]));
    P.push(part(box(r * 0.7, r * 0.9, 0.04), K, [sx * sep * 0.95, y - r * 0.1, z - r * 0.85]));
    P.push(part(box(r * 1.6, r * 0.32, 0.05), 0x2a1a0a, [sx * sep, y + r * 1.25, z - r * 0.6], [0, 0, -sx * 0.45]));
  }
}

// --------------------------------------------------------------- 🌾 Trigo-Navalha
function wheatBody(): G {
  const r = rng(1); const P: G[] = [];
  // tronco feito de feixe de talos
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; P.push(part(cyl(0.035, 0.05, 1.0, 3), 0xc9a640, [Math.cos(a) * 0.14, 0.5, Math.sin(a) * 0.14], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12])); }
  P.push(part(cyl(0.2, 0.17, 0.12, 8), 0x8a6a2a, [0, 0.55, 0]));
  // cabeça de espiga com cabelo espetado
  P.push(part(ico(0.26, 0), 0xe8c25a, [0, 1.15, 0], [0, 0, 0], [1, 1.15, 1]));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; P.push(part(cone(0.06, 0.4, 3), 0xf2d36a, [Math.cos(a) * 0.14, 1.45, Math.sin(a) * 0.14 + 0.05], [Math.sin(a) * 0.5 + 0.3, r(), -Math.cos(a) * 0.5])); }
  eyes(P, 1.17, -0.22, 0.1, 0.07);
  // braços e lâminas
  for (const sx of [-1, 1]) {
    P.push(part(cyl(0.035, 0.035, 0.55, 3), 0xc9a640, [sx * 0.38, 0.85, -0.05], [0, 0, sx * 1.1]));
    P.push(part(new THREE.TorusGeometry(0.32, 0.035, 3, 10, Math.PI * 0.9), 0xd8dde3, [sx * 0.62, 0.95, -0.15], [Math.PI / 2, 0, sx > 0 ? -0.4 : Math.PI + 0.4], [1, 1, 2.2]));
  }
  // pernas de raiz
  for (const sx of [-1, 1]) P.push(part(cyl(0.05, 0.03, 0.4, 4), 0x6b4a22, [sx * 0.15, 0.12, 0], [0, 0, sx * 0.5]));
  return shade(merge(P), 0.6);
}

// --------------------------------------------------------------- 🌽 Milho-Artilheiro
function cornBody(): G {
  const P: G[] = [];
  P.push(part(cyl(0.28, 0.3, 1.35, 10), 0xf2cf45, [0, 0.95, 0]));
  for (let i = 0; i < 6; i++) P.push(part(cyl(0.302, 0.302, 0.05, 10), 0xd9a92a, [0, 0.4 + i * 0.22, 0]));
  P.push(part(cone(0.3, 0.35, 10), 0xf2cf45, [0, 1.8, 0]));
  P.push(part(cone(0.07, 0.4, 4), 0xc98a4a, [0, 2.1, 0]));
  // capa de palha
  for (let i = 0; i < 5; i++) { const a = Math.PI * 0.35 + (i / 4) * Math.PI * 1.3; P.push(part(cone(0.22, 1.25, 3), 0x7fb54a, [Math.cos(a) * 0.3, 0.75, Math.sin(a) * 0.3], [Math.sin(a) * -0.35, 0, Math.cos(a) * 0.35], [1, 1, 0.3])); }
  // canhão (boca)
  P.push(part(cyl(0.13, 0.15, 0.45, 10, true), 0x8a6a2a, [0, 1.05, -0.38], [Math.PI / 2, 0, 0]));
  P.push(part(cyl(0.1, 0.1, 0.05, 10), 0x1a1a1a, [0, 1.05, -0.6], [Math.PI / 2, 0, 0]));
  eyes(P, 1.45, -0.28, 0.12, 0.08);
  for (const sx of [-1, 1]) P.push(part(cyl(0.06, 0.04, 0.45, 4), 0x5f8f35, [sx * 0.18, 0.18, 0], [0, 0, sx * 0.35]));
  return shade(merge(P), 0.6);
}

// --------------------------------------------------------------- 🌻 Girassol-Laser
function sunBody(): G {
  const P: G[] = [];
  P.push(part(cyl(0.07, 0.11, 1.5, 6), 0x4f8a35, [0, 0.75, 0]));
  for (const sx of [-1, 1]) P.push(part(cone(0.22, 0.8, 3), 0x63a23e, [sx * 0.35, 0.8, 0], [0, 0, sx * 1.3], [1, 1, 0.25]));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    P.push(part(cone(0.13, 0.42, 3), i % 2 ? 0xffc928 : 0xffb21a, [Math.cos(a) * 0.5, 1.75 + Math.sin(a) * 0.5, -0.05], [0, 0, a - Math.PI / 2], [1, 1, 0.3]));
  }
  P.push(part(cyl(0.36, 0.36, 0.12, 12), 0x5a3a1a, [0, 1.75, 0], [Math.PI / 2, 0, 0]));
  eyes(P, 1.88, -0.14, 0.14, 0.08);
  for (const sx of [-1, 1]) P.push(part(cyl(0.06, 0.04, 0.35, 4), 0x4f8a35, [sx * 0.14, 0.12, 0], [0, 0, sx * 0.5]));
  return shade(merge(P), 0.65);
}
function sunGlow(): G { return merge([part(cyl(0.16, 0.16, 0.06, 10), 0xfff27a, [0, 1.7, -0.08], [Math.PI / 2, 0, 0])]); }

// --------------------------------------------------------------- 🎃 Abóbora-Bomba
function pumpBody(): G {
  const P: G[] = [];
  P.push(part(ico(0.62, 1), 0xf07a1c, [0, 0.55, 0], [0, 0, 0], [1, 0.82, 1]));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.push(part(ico(0.18, 0), 0xd9661a, [Math.cos(a) * 0.48, 0.55, Math.sin(a) * 0.48], [0, 0, 0], [0.6, 2.2, 0.6])); }
  P.push(part(cyl(0.06, 0.09, 0.35, 5), 0x5a4a22, [0, 1.12, 0], [0.2, 0, 0.2]));
  P.push(part(cone(0.18, 0.4, 3), 0x4f8f3a, [0.18, 1.1, 0.1], [0, 0, -1.2], [1, 1, 0.3]));
  // tentáculos de cipó
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; P.push(part(cyl(0.05, 0.02, 0.8, 4), 0x4f8f3a, [Math.cos(a) * 0.62, 0.15, Math.sin(a) * 0.62], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2])); }
  return shade(merge(P), 0.6);
}
function pumpGlow(): G {
  const P: G[] = [];
  for (const sx of [-1, 1]) P.push(part(cone(0.11, 0.18, 3), 0xffe35a, [sx * 0.2, 0.7, -0.5], [Math.PI / 2 - 0.3, 0, Math.PI], [1, 1, 0.3]));
  P.push(part(box(0.5, 0.1, 0.06), 0xffb52a, [0, 0.42, -0.52], [0.25, 0, 0]));
  for (let i = 0; i < 4; i++) P.push(part(cone(0.06, 0.12, 3), 0xffb52a, [-0.18 + i * 0.12, 0.49 - (i % 2) * 0.1, -0.53], [0.25, 0, i % 2 ? Math.PI : 0], [1, 1, 0.4]));
  return merge(P);
}

// --------------------------------------------------------------- 🍓 Morango-Ácido
function berryBody(): G {
  const r = rng(5); const P: G[] = [];
  P.push(part(cone(0.42, 0.8, 9), 0xe2303a, [0, 0.62, 0], [Math.PI, 0, 0]));
  P.push(part(ico(0.4, 1), 0xe2303a, [0, 0.95, 0], [0, 0, 0], [1, 0.55, 1]));
  for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, y = 0.45 + r() * 0.5, rr = 0.42 * (y - 0.2) / 0.8 + 0.05; P.push(part(box(0.03, 0.05, 0.03), 0xffe07a, [Math.cos(a) * rr, y, Math.sin(a) * rr])); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.push(part(cone(0.12, 0.38, 3), 0x3f8a3a, [Math.cos(a) * 0.22, 1.14, Math.sin(a) * 0.22], [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3], [1, 1, 0.3])); }
  // braço-catapulta nas costas
  P.push(part(cyl(0.035, 0.035, 0.9, 4), 0x3f7a2a, [0, 1.35, 0.3], [-0.7, 0, 0]));
  P.push(part(ico(0.14, 0), 0xff3b5c, [0, 1.7, 0.6]));
  eyes(P, 0.92, -0.36, 0.13, 0.075);
  for (const sx of [-1, 1]) P.push(part(cyl(0.05, 0.03, 0.4, 4), 0x3f7a2a, [sx * 0.14, 0.12, 0], [0, 0, sx * 0.5]));
  return shade(merge(P), 0.6);
}

// --------------------------------------------------------------- 💜 Lavanda-Sonífera
function lavBody(): G {
  const P: G[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    P.push(part(cone(0.08, 0.7, 4), i % 2 ? 0x9b6fd6 : 0xb58cf0, [Math.cos(a) * 0.32, 1.25, Math.sin(a) * 0.32], [Math.sin(a) * -0.5, 0, Math.cos(a) * 0.5]));
  }
  P.push(part(ico(0.34, 1), 0x6a4a9a, [0, 1.0, 0], [0, 0, 0], [1, 1.1, 1]));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P.push(part(cone(0.14, 0.5, 3), 0x6e8f5a, [Math.cos(a) * 0.28, 0.5, Math.sin(a) * 0.28], [Math.PI + Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4], [1, 1, 0.3])); }
  eyes(P, 1.05, -0.3, 0.12, 0.07);
  return shade(merge(P), 0.65);
}
function lavGlow(): G { return merge([part(ico(0.13, 1), 0xe8d0ff, [0, 0.62, 0])]); }

/** Plantas-criaturas: as culturas maduras se transformam à noite. */
export class Creatures {
  private body: THREE.InstancedMesh[] = [];
  private glow: (THREE.InstancedMesh | null)[] = [];
  /** direção para onde cada planta olha */
  yaw = new Float32Array(N);
  private delay = new Float32Array(N);
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private nightT = 0;
  /** alvo de cada canteiro (definido pela defesa) */
  aim: (t: number) => { x: number; z: number } | null = () => null;
  charge = new Float32Array(N);

  constructor(scene: THREE.Scene, private fx: FX, high: boolean) {
    const bodies = [wheatBody(), cornBody(), sunBody(), pumpBody(), berryBody(), lavBody()];
    const glows = [null, null, sunGlow(), pumpGlow(), null, lavGlow()];
    const bm = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const gm = new THREE.MeshBasicMaterial({ vertexColors: true });
    bodies.forEach((g, i) => {
      const m = new THREE.InstancedMesh(g, bm, N); m.count = 0; m.frustumCulled = false; m.castShadow = high; m.receiveShadow = true;
      scene.add(m); this.body.push(m);
      const gg = glows[i];
      if (gg) { const mg = new THREE.InstancedMesh(gg, gm, N); mg.count = 0; mg.frustumCulled = false; scene.add(mg); this.glow.push(mg); }
      else this.glow.push(null);
    });
    const r = rng(9);
    for (let t = 0; t < N; t++) { this.delay[t] = r() * 2.5; this.yaw[t] = 0; }
  }

  update(dt: number, night: boolean, time: number, cam: THREE.Vector3) {
    this.nightT = night ? this.nightT + dt : 0;
    const counts = [0, 0, 0, 0, 0, 0];
    let changed = false;
    for (let t = 0; t < N; t++) {
      const ripe = T.s[t] === 2 && T.g[t] >= 1 && owned[(t / 100) | 0];
      const want = ripe && night && this.nightT > this.delay[t] ? 1 : 0;
      const a0 = T.a[t];
      if (!ripe) { if (a0 !== 0) { T.a[t] = 0; changed = true; } continue; }
      if (a0 !== want) {
        T.a[t] = want > a0 ? Math.min(1, a0 + dt * 1.6) : Math.max(0, a0 - dt * 1.2);
        changed = true;
        const x = tileX(t), z = tileZ(t);
        if (a0 === 0 && want === 1) this.fx.spawn(x, 0.5, z, 0x9dff7a, 14, 1.2, 4, 7, 0.8);
        if (a0 === 1 && want === 0) this.fx.spawn(x, 0.6, z, 0xfff2a0, 8, 1, 2, 5, 0.8);
      }
      const a = T.a[t];
      if (a <= 0.001) continue;
      const c = T.c[t];
      const x = tileX(t), z = tileZ(t);
      if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > 110 * 110) continue;
      // mira suave
      const tg = this.aim(t);
      let ty = this.yaw[t];
      if (tg) ty = Math.atan2(-(tg.x - x), -(tg.z - z));
      else ty = Math.sin(time * 0.5 + t) * 0.6;
      let d = ty - this.yaw[t]; d = Math.atan2(Math.sin(d), Math.cos(d));
      const pu = Math.max(0, T.p[t]);
      if (c === 0 && pu > 0) this.yaw[t] += dt * 22; // lâminas giram
      else this.yaw[t] += d * Math.min(1, dt * 6);
      // escala com "pulo" ao nascer
      const k = a < 1 ? 1 + 2.7 * Math.pow(a - 1, 3) + 1.7 * Math.pow(a - 1, 2) : 1;
      const breathe = 1 + Math.sin(time * 3.2 + t * 1.7) * 0.04;
      let sx = k, sy = k * breathe, lean = 0, lift = 0;
      if (c === 1) lean = pu * 0.45;                       // coice do milho
      if (c === 2) lean = -0.12 - pu * 0.2;                // girassol inclina para o alvo
      if (c === 3) { const ch = this.charge[t]; const w = 1 + ch * 0.25 + Math.sin(time * (8 + ch * 30)) * ch * 0.08; sx *= w; sy *= w; }
      if (c === 4) lean = -pu * 0.6;                       // catapulta
      if (c === 5) { lift = 0.25 + Math.sin(time * 2 + t) * 0.15; this.yaw[t] += dt * 0.6; }
      if (pu > 0 && c !== 0) { sx *= 1 + pu * 0.12; sy *= 1 - pu * 0.06; }
      if (T.p[t] < 0) { sx *= 1 + T.p[t] * 0.2; sy *= 1 + T.p[t] * 0.3; } // sendo mordida
      this.e.set(lean, this.yaw[t], 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.m4.compose(this.p.set(x, 0.08 + lift * k + Math.abs(Math.sin(time * 4 + t)) * 0.03, z), this.q, this.sc.set(sx, sy, sx));
      this.body[c].setMatrixAt(counts[c], this.m4);
      this.glow[c]?.setMatrixAt(counts[c], this.m4);
      counts[c]++;
    }
    this.body.forEach((m, i) => {
      m.count = counts[i]; m.instanceMatrix.needsUpdate = true;
      const g = this.glow[i]; if (g) { g.count = counts[i]; g.instanceMatrix.needsUpdate = true; }
    });
    if (changed) markDirty();
  }
}
