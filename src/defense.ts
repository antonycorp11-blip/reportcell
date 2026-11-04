import * as THREE from 'three';
import * as farm from './farm';
import { T, N, owned, live, tileY, tileX, tileZ } from './farm';
import { lv, sk, pct } from './state';
import { part, merge, ico, box } from './gfx';
import type { Horde, Zombie } from './zombies';
import type { FX } from './fx';

/** Atributos das culturas-defensoras (índice = cultura). */
export interface DefSpec { kind: 'blade' | 'shoot' | 'laser' | 'bomb' | 'lob' | 'aura' | 'wall' | 'flame'; range: number; dmg: number; cd: number; eyeY: number; burn?: number; pierce?: boolean; slow?: boolean; radius?: number }
export const DEF: DefSpec[] = [
  { kind: 'blade', range: 2.4, dmg: 8, cd: 0.5, eyeY: 1.05 },
  { kind: 'shoot', range: 15, dmg: 15, cd: 0.9, eyeY: 1.95 },
  { kind: 'laser', range: 19, dmg: 28, cd: 1.5, eyeY: 1.75 },
  { kind: 'bomb', range: 2.4, dmg: 170, cd: 0, eyeY: 0.45 },
  { kind: 'lob', range: 13, dmg: 20, cd: 1.7, eyeY: 0.5 },
  { kind: 'aura', range: 6, dmg: 5, cd: 0, eyeY: 0.85 },
  { kind: 'wall', range: 0, dmg: 14, cd: 0, eyeY: 1.4 },
  { kind: 'flame', range: 6.5, dmg: 34, cd: 0.15, eyeY: 1.6 },
  { kind: 'shoot', range: 16, dmg: 17, cd: 0.8, eyeY: 1.95, burn: 9 },
  { kind: 'laser', range: 21, dmg: 30, cd: 1.3, eyeY: 1.75, pierce: true, slow: true },
  { kind: 'bomb', range: 2.4, dmg: 260, cd: 0, eyeY: 0.45, radius: 6.5 },
];

interface Proj { kind: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg: number; target: Zombie | null; player: boolean; src: number; burn?: number }
interface Beam { g: THREE.Group; core: THREE.Mesh; glow: THREE.Mesh; flash: THREE.Mesh; muzzle: THREE.Mesh; life: number; len: number }
const BEAM_T = 0.38;

export interface DefCtx { kill: (z: Zombie, by: 'plant' | 'player') => void; boom: (x: number, z: number) => void; shot: (k: number) => void; levelUp: (t: number, lvl: number) => void }

export class Defense {
  private cd = new Float32Array(N);
  private projs: Proj[] = [];
  private pm: THREE.InstancedMesh[] = [];
  private beams: Beam[] = [];
  aimX = new Float32Array(N);
  aimZ = new Float32Array(N);
  hasAim = new Uint8Array(N);
  charge = new Float32Array(N);
  private auraT = 0;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private v = new THREE.Vector3();
  private s1 = new THREE.Vector3(1, 1, 1);

  constructor(private scene: THREE.Scene, private horde: Horde, private fx: FX) {
    const kinds = [
      { g: ico(0.12, 0), c: 0xffd54a },        // 0 grão de milho
      { g: ico(0.2, 0), c: 0xff3b5c },         // 1 ácido
      { g: box(0.1, 0.1, 0.3), c: 0x9dff7a },  // 2 semente do jogador
      { g: ico(0.15, 0), c: 0xff6a1a },        // 3 grão em brasa
    ];
    for (const k of kinds) {
      const m = new THREE.InstancedMesh(k.g, new THREE.MeshBasicMaterial({ color: k.c }), 200);
      m.count = 0; m.frustumCulled = false;
      scene.add(m); this.pm.push(m);
    }
    const cylG = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
    const sphG = new THREE.SphereGeometry(1, 12, 8);
    for (let i = 0; i < 24; i++) {
      const add = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
      const g = new THREE.Group();
      const core = new THREE.Mesh(cylG, add(0xfffbe0, 1));
      const glow = new THREE.Mesh(cylG, add(0xffc21a, 0.55));
      const flash = new THREE.Mesh(sphG, add(0xffe066, 0.9));
      const muzzle = new THREE.Mesh(sphG, add(0xfff2a0, 0.9));
      for (const m of [core, glow, flash, muzzle]) { m.frustumCulled = false; m.renderOrder = 12; }
      g.add(core, glow);
      scene.add(g, flash, muzzle);
      g.visible = flash.visible = muzzle.visible = false;
      this.beams.push({ g, core, glow, flash, muzzle, life: 0, len: 1 });
    }
  }

  private rangeK = 1;
  private rateK = 1;
  dmgMult(t: number) { return (1 + 0.15 * lv('rage')) * pct('pdmg') * Math.max(0.7, T.f[t]) * (1 + 0.3 * farm.plantLevel(t)); }

  private killBy(z: Zombie, t: number) {
    this.ctx.kill(z, 'plant');
    if (t < 0 || T.s[t] !== 2) return;
    const before = farm.plantLevel(t);
    T.k[t]++;
    const after = farm.plantLevel(t);
    if (after > before) this.ctx.levelUp(t, after);
  }

  fireSeed(from: THREE.Vector3, target: Zombie | null, dir: THREE.Vector3, dmg: number) {
    const sp = 34;
    let vx = dir.x * sp, vy = dir.y * sp, vz = dir.z * sp;
    if (target) {
      const tp = target.g.position;
      const ty = target.kind === 'crow' ? 3.4 : 1.2 * (target.kind === 'colossus' ? 2.2 : 1);
      this.v.set(tp.x - from.x, ty - from.y, tp.z - from.z).normalize().multiplyScalar(sp);
      vx = this.v.x; vy = this.v.y; vz = this.v.z;
    }
    this.projs.push({ kind: 2, x: from.x, y: from.y, z: from.z, vx, vy, vz, life: 1.2, dmg, target, player: true, src: -1 });
  }

  update(dt: number, night: boolean, camPos: THREE.Vector3) {
    const H = this.horde;
    this.rangeK = pct('range');
    this.rateK = pct('rate') * (sk('d2') ? 1.25 : 1);
    const any = night && H.alive() > 0;
    let pulsing = false;
    this.auraT -= dt;
    const doAura = this.auraT <= 0;
    if (doAura) this.auraT = 0.25;
    for (let t = 0; t < N; t++) {
      if (T.p[t] !== 0) { T.p[t] = T.p[t] > 0 ? Math.max(0, T.p[t] - dt * 4) : Math.min(0, T.p[t] + dt * 2); pulsing = true; }
      this.hasAim[t] = 0;
      if (!night || T.s[t] !== 2 || T.g[t] < 1 || !live(t) || T.a[t] < 0.6) { this.charge[t] = 0; continue; }
      const c = T.c[t]; const d0 = DEF[c];
      const d = { ...d0, range: d0.range * this.rangeK, cd: d0.cd / this.rateK };
      if (sk('d1') && T.h[t] < farm.tileMaxHp(t)) T.h[t] = Math.min(farm.tileMaxHp(t), T.h[t] + farm.tileMaxHp(t) * 0.04 * dt);
      const x = tileX(t), z = tileZ(t);
      let look: Zombie | null = null;
      if (any) look = H.nearest(x, z, Math.max(d.range, 10), c !== 0 && c !== 3 && c !== 4);
      if (look) { this.hasAim[t] = 1; this.aimX[t] = look.g.position.x; this.aimZ[t] = look.g.position.z; }
      if (!any) continue;
      this.cd[t] -= dt;
      const m = this.dmgMult(t);
      switch (d.kind) {
        case 'blade': {
          if (this.cd[t] > 0) break;
          let hit = false;
          H.each(x, z, d.range, (zb) => { if (zb.kind === 'crow') return; hit = true; if (H.hit(zb, d.dmg * m, { slow: 0.5, slowT: 1 })) this.killBy(zb, t); });
          if (hit) { this.cd[t] = d.cd; T.p[t] = 1; this.fx.spawn(x, 0.8, z, 0xf4e08a, 3, 1.2, 1.5, 6, 0.3); }
          break;
        }
        case 'shoot': case 'lob': {
          if (this.cd[t] > 0 || !look) break;
          const lp = look.g.position;
          if ((lp.x - x) ** 2 + (lp.z - z) ** 2 > d.range * d.range) break;
          if (d.kind === 'lob' && look.kind === 'crow') break;
          this.cd[t] = d.cd * (0.85 + Math.random() * 0.3); T.p[t] = 1;
          if (d.kind === 'shoot') {
            const ty = look.kind === 'crow' ? 3.4 : 1.2;
            this.v.set(lp.x - x, ty - 1.8, lp.z - z).normalize().multiplyScalar(24);
            this.projs.push({ kind: d.burn ? 3 : 0, x, y: 1.8, z, vx: this.v.x, vy: this.v.y, vz: this.v.z, life: 1, dmg: d.dmg * m, target: look, player: false, src: t, burn: d.burn });
            this.ctx.shot(0);
          } else {
            const tt = 0.85;
            this.projs.push({ kind: 1, x, y: 0.6, z, vx: (lp.x - x) / tt, vy: 4.5 + 9.8 * tt / 2 - 4.5, vz: (lp.z - z) / tt, life: tt, dmg: d.dmg * m, target: null, player: false, src: t });
            this.ctx.shot(1);
          }
          break;
        }
        case 'laser': {
          if (this.cd[t] > 0 || !look) break;
          const lp = look.g.position;
          if ((lp.x - x) ** 2 + (lp.z - z) ** 2 > d.range * d.range) break;
          this.cd[t] = d.cd; T.p[t] = 1;
          const ty = look.kind === 'crow' ? 3.4 : 1.3 * (look.kind === 'colossus' ? 2 : 1);
          const dl = Math.hypot(lp.x - x, lp.z - z) || 1;
          const ox = x + ((lp.x - x) / dl) * 0.35, oz = z + ((lp.z - z) / dl) * 0.35;
          if (sk('d2') || d.pierce) {
            // laser atravessa: estende o feixe e fere todos na linha
            const ex = x + ((lp.x - x) / dl) * d.range, ez = z + ((lp.z - z) / dl) * d.range;
            this.beam(ox, 1.7, oz, ex, ty, ez);
            for (const zb of [...H.list]) {
              if (zb.dead || zb.burrowed || zb === look) continue;
              const vx = ex - x, vz = ez - z, L = vx * vx + vz * vz;
              const u = Math.max(0, Math.min(1, ((zb.g.position.x - x) * vx + (zb.g.position.z - z) * vz) / L));
              if ((x + vx * u - zb.g.position.x) ** 2 + (z + vz * u - zb.g.position.z) ** 2 < 0.8 && H.hit(zb, d.dmg * m, d.slow ? { slow: 0.5, slowT: 1.5 } : {})) this.killBy(zb, t);
            }
          } else this.beam(ox, 1.7, oz, lp.x, ty, lp.z);
          if (H.hit(look, d.dmg * m, d.slow ? { slow: 0.5, slowT: 1.5 } : {})) this.killBy(look, t);
          this.ctx.shot(2);
          break;
        }
        case 'bomb': {
          const zb = H.nearest(x, z, 4.2, false, true);
          if (!zb) { this.charge[t] = Math.max(0, this.charge[t] - dt); break; }
          this.charge[t] += dt * 1.8;
          const close = (zb.g.position.x - x) ** 2 + (zb.g.position.z - z) ** 2 < 2.2;
          if (this.charge[t] < 1 && !close) break;
          this.charge[t] = 0;
          H.each(x, z, d.radius ?? 4.5, (o) => { if (H.hit(o, d.dmg * m, { ignoreBurrow: true, knock: this.v.set(o.g.position.x - x, 0, o.g.position.z - z).normalize().multiplyScalar(8) })) this.killBy(o, -1); }, true);
          this.ctx.boom(x, z);
          T.s[t] = 3; T.c[t] = -1; T.g[t] = 0; T.h[t] = 0;
          farm.markDirty();
          break;
        }
        case 'aura': {
          if (!doAura) break;
          let hit = false;
          H.each(x, z, d.range, (zb) => { hit = true; if (H.hit(zb, d.dmg * m * 0.25, { slow: 0.45, slowT: 0.6, ignoreBurrow: true })) this.killBy(zb, t); }, true);
          if (hit) { T.p[t] = 0.6; const a = Math.random() * 6.28; this.fx.spawn(x + Math.cos(a) * 2, 0.8, z + Math.sin(a) * 2, 0xc9a8ff, 2, 1, 0.8, -0.3, 1); }
          break;
        }
        case 'flame': {
          if (this.cd[t] > 0 || !look || look.kind === 'crow') break;
          const lp = look.g.position;
          const dd = Math.hypot(lp.x - x, lp.z - z);
          if (dd > d.range) break;
          this.cd[t] = d.cd; T.p[t] = 0.7;
          H.each(lp.x, lp.z, 1.8, (zb) => { if (zb.kind !== 'crow' && H.hit(zb, d.dmg * m * d.cd, { poison: 6 })) this.killBy(zb, t); });
          for (let k = 1; k <= 3; k++) { const f = k / 3; this.fx.spawn(x + (lp.x - x) * f, 1.3 - f * 0.4, z + (lp.z - z) * f, k === 3 ? 0xff4a1a : 0xffb02a, 2, 0.6, 1, -1, 0.35); }
          if (Math.random() < 0.3) this.ctx.shot(4);
          break;
        }
      }
    }
    if (pulsing) farm.markDirty();
    this.updateProjs(dt);
    for (const b of this.beams) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const k = Math.max(0, b.life / BEAM_T);
      const w = Math.sin(k * Math.PI) ;
      b.core.scale.set(0.09 * w + 0.02, b.len, 0.09 * w + 0.02);
      b.glow.scale.set(0.45 * w + 0.06, b.len, 0.45 * w + 0.06);
      (b.glow.material as THREE.MeshBasicMaterial).opacity = 0.6 * k;
      (b.core.material as THREE.MeshBasicMaterial).opacity = Math.min(1, k * 1.6);
      const fs = 0.9 * (1 - k) + 0.35;
      b.flash.scale.setScalar(fs * 1.3); (b.flash.material as THREE.MeshBasicMaterial).opacity = k * 0.85;
      b.muzzle.scale.setScalar(0.45 * w + 0.1); (b.muzzle.material as THREE.MeshBasicMaterial).opacity = k;
      if (b.life <= 0) b.g.visible = b.flash.visible = b.muzzle.visible = false;
    }
  }

  ctx: DefCtx = { kill: () => { /* */ }, boom: () => { /* */ }, shot: () => { /* */ }, levelUp: () => { /* */ } };

  private beam(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    const b = this.beams.find((x) => x.life <= 0);
    if (!b) return;
    const a = new THREE.Vector3(x1, y1, z1), c = new THREE.Vector3(x2, y2, z2);
    const dir = c.clone().sub(a);
    b.len = dir.length();
    b.g.position.copy(a);
    b.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    b.flash.position.copy(c); b.muzzle.position.copy(a);
    b.life = BEAM_T;
    b.g.visible = b.flash.visible = b.muzzle.visible = true;
    this.fx.spawn(x2, y2, z2, 0xfff06a, 14, 1.2, 3, 4, 0.6);
    this.fx.spawn(x2, y2, z2, 0xff9a2a, 6, 0.8, 2, 6, 0.5);
  }


  private updateProjs(dt: number) {
    const H = this.horde;
    const counts = [0, 0, 0, 0];
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.life -= dt;
      if (p.kind === 3 && Math.random() < 0.5) this.fx.spawn(p.x, p.y, p.z, 0xffa02a, 1, 0.1, 0.3, -1, 0.3);
      if (p.kind === 1) p.vy -= 9.8 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      let done = false;
      if (p.kind === 1) {
        if (p.life <= 0 || p.y <= 0.1) {
          H.each(p.x, p.z, 2.4, (zb) => { if (H.hit(zb, p.dmg, { poison: 7 })) this.killBy(zb, p.src); });
          this.fx.spawn(p.x, 0.3, p.z, 0xff3b5c, 14, 1.8, 2.5, 8, 0.7);
          done = true;
        }
      } else {
        // colisão com qualquer zumbi
        for (const zb of H.list) {
          if (zb.dead || zb.burrowed) continue;
          const zp = zb.g.position;
          const sc = zb.kind === 'colossus' ? 2.5 : 1;
          const zy = zb.kind === 'crow' ? 3.4 : 1.1 * sc;
          const dx = zp.x - p.x, dz = zp.z - p.z, dy = zy - p.y;
          if (dx * dx + dz * dz < 0.5 * sc * sc && Math.abs(dy) < 1.1 * sc) {
            this.v.set(p.vx, 0, p.vz).normalize().multiplyScalar(p.player ? 3 : 1.5);
            if (H.hit(zb, p.dmg, { knock: this.v, poison: p.burn })) { if (p.player) this.ctx.kill(zb, 'player'); else this.killBy(zb, p.src); }
            done = true; break;
          }
        }
        if (p.life <= 0 || p.y < 0) done = true;
      }
      if (done) { this.projs.splice(i, 1); continue; }
      const m = this.pm[p.kind];
      if (counts[p.kind] < 200) {
        this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.v.set(p.vx, p.vy, p.vz).normalize());
        this.m4.compose(this.v.set(p.x, p.y, p.z), this.q, this.s1);
        m.setMatrixAt(counts[p.kind]++, this.m4);
      }
    }
    this.pm.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
  }

  reset() { this.projs = []; this.cd.fill(0); }
}
