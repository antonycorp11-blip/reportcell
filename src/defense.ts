import * as THREE from 'three';
import * as farm from './farm';
import { T, N, owned, tileX, tileZ } from './farm';
import { lv } from './state';
import { part, merge, ico, box } from './gfx';
import type { Horde, Zombie } from './zombies';
import type { FX } from './fx';

/** Atributos das culturas-defensoras (índice = cultura). */
export const DEF = [
  { kind: 'blade', range: 2.4, dmg: 8, cd: 0.5, eyeY: 1.05 },
  { kind: 'shoot', range: 15, dmg: 15, cd: 0.9, eyeY: 1.95 },
  { kind: 'laser', range: 19, dmg: 28, cd: 1.5, eyeY: 1.75 },
  { kind: 'bomb', range: 2.4, dmg: 170, cd: 0, eyeY: 0.45 },
  { kind: 'lob', range: 13, dmg: 20, cd: 1.7, eyeY: 0.5 },
  { kind: 'aura', range: 6, dmg: 5, cd: 0, eyeY: 0.85 },
] as const;

interface Proj { kind: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg: number; target: Zombie | null; player: boolean }
interface Beam { line: THREE.Line; life: number }

export interface DefCtx { kill: (z: Zombie, by: 'plant' | 'player') => void; boom: (x: number, z: number) => void; shot: (k: number) => void }

export class Defense {
  private cd = new Float32Array(N);
  private projs: Proj[] = [];
  private pm: THREE.InstancedMesh[] = [];
  private beams: Beam[] = [];
  private eyes: THREE.InstancedMesh;
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
    ];
    for (const k of kinds) {
      const m = new THREE.InstancedMesh(k.g, new THREE.MeshBasicMaterial({ color: k.c }), 200);
      m.count = 0; m.frustumCulled = false;
      scene.add(m); this.pm.push(m);
    }
    for (let i = 0; i < 24; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff06a, transparent: true, opacity: 0 }));
      l.frustumCulled = false; l.visible = false;
      scene.add(l); this.beams.push({ line: l, life: 0 });
    }
    // olhos das plantas vivas
    const eg = merge([
      part(ico(0.065, 1), 0xfff6c0, [-0.08, 0, 0]), part(ico(0.065, 1), 0xfff6c0, [0.08, 0, 0]),
      part(box(0.045, 0.06, 0.03), 0x111111, [-0.08, -0.005, -0.055]), part(box(0.045, 0.06, 0.03), 0x111111, [0.08, -0.005, -0.055]),
      part(box(0.09, 0.02, 0.02), 0x1a2a0a, [-0.08, 0.075, -0.05], [0, 0, -0.4]), part(box(0.09, 0.02, 0.02), 0x1a2a0a, [0.08, 0.075, -0.05], [0, 0, 0.4]),
    ]);
    this.eyes = new THREE.InstancedMesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true }), N);
    this.eyes.count = 0; this.eyes.frustumCulled = false;
    scene.add(this.eyes);
  }

  dmgMult(t: number) { return (1 + 0.15 * lv('rage')) * Math.max(0.7, T.f[t]); }

  fireSeed(from: THREE.Vector3, target: Zombie | null, dir: THREE.Vector3, dmg: number) {
    const sp = 34;
    let vx = dir.x * sp, vy = dir.y * sp, vz = dir.z * sp;
    if (target) {
      const tp = target.g.position;
      const ty = target.kind === 'crow' ? 3.4 : 1.2 * (target.kind === 'colossus' ? 2.2 : 1);
      this.v.set(tp.x - from.x, ty - from.y, tp.z - from.z).normalize().multiplyScalar(sp);
      vx = this.v.x; vy = this.v.y; vz = this.v.z;
    }
    this.projs.push({ kind: 2, x: from.x, y: from.y, z: from.z, vx, vy, vz, life: 1.2, dmg, target, player: true });
  }

  update(dt: number, night: boolean, camPos: THREE.Vector3) {
    const H = this.horde;
    const any = night && H.alive() > 0;
    let pulsing = false;
    let ne = 0;
    this.auraT -= dt;
    const doAura = this.auraT <= 0;
    if (doAura) this.auraT = 0.25;
    for (let t = 0; t < N; t++) {
      if (T.p[t] !== 0) { T.p[t] = T.p[t] > 0 ? Math.max(0, T.p[t] - dt * 4) : Math.min(0, T.p[t] + dt * 2); pulsing = true; }
      if (!night || T.s[t] !== 2 || T.g[t] < 1 || !owned[(t / 100) | 0]) continue;
      const c = T.c[t]; const d = DEF[c];
      const x = tileX(t), z = tileZ(t);
      // olhos olhando para o zumbi mais próximo
      let look: Zombie | null = null;
      if (any) look = H.nearest(x, z, Math.max(d.range, 10));
      if (camPos.distanceToSquared(this.v.set(x, 0, z)) < 4900 && ne < N) {
        const yaw = look ? Math.atan2(-(look.g.position.x - x), -(look.g.position.z - z)) : 0;
        this.q.setFromAxisAngle(this.up, yaw);
        this.m4.compose(this.v.set(x, d.eyeY + (c === 2 ? 0.05 : 0) + Math.max(0, T.p[t]) * 0.15, z), this.q, this.s1);
        this.eyes.setMatrixAt(ne++, this.m4);
      }
      if (!any) continue;
      this.cd[t] -= dt;
      const m = this.dmgMult(t);
      switch (d.kind) {
        case 'blade': {
          if (this.cd[t] > 0) break;
          let hit = false;
          H.each(x, z, d.range, (zb) => { if (zb.kind === 'crow') return; hit = true; if (H.hit(zb, d.dmg * m, { slow: 0.5, slowT: 1 })) this.ctx.kill(zb, 'plant'); });
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
            this.projs.push({ kind: 0, x, y: 1.8, z, vx: this.v.x, vy: this.v.y, vz: this.v.z, life: 1, dmg: d.dmg * m, target: look, player: false });
            this.ctx.shot(0);
          } else {
            const tt = 0.85;
            this.projs.push({ kind: 1, x, y: 0.6, z, vx: (lp.x - x) / tt, vy: 4.5 + 9.8 * tt / 2 - 4.5, vz: (lp.z - z) / tt, life: tt, dmg: d.dmg * m, target: null, player: false });
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
          this.beam(x, 1.75, z, lp.x, ty, lp.z);
          if (H.hit(look, d.dmg * m)) this.ctx.kill(look, 'plant');
          this.ctx.shot(2);
          break;
        }
        case 'bomb': {
          const zb = H.nearest(x, z, d.range, false, true);
          if (!zb) break;
          H.each(x, z, 4.5, (o) => { if (H.hit(o, d.dmg * m, { ignoreBurrow: true, knock: this.v.set(o.g.position.x - x, 0, o.g.position.z - z).normalize().multiplyScalar(8) })) this.ctx.kill(o, 'plant'); }, true);
          this.ctx.boom(x, z);
          T.s[t] = 3; T.c[t] = -1; T.g[t] = 0; T.h[t] = 0;
          farm.markDirty();
          break;
        }
        case 'aura': {
          if (!doAura) break;
          let hit = false;
          H.each(x, z, d.range, (zb) => { hit = true; if (H.hit(zb, d.dmg * m * 0.25, { slow: 0.45, slowT: 0.6, ignoreBurrow: true })) this.ctx.kill(zb, 'plant'); }, true);
          if (hit) { T.p[t] = 0.6; const a = Math.random() * 6.28; this.fx.spawn(x + Math.cos(a) * 2, 0.8, z + Math.sin(a) * 2, 0xc9a8ff, 2, 1, 0.8, -0.3, 1); }
          break;
        }
      }
    }
    this.eyes.count = ne;
    this.eyes.instanceMatrix.needsUpdate = true;
    if (pulsing) farm.markDirty();
    this.updateProjs(dt);
    for (const b of this.beams) {
      if (b.life <= 0) continue;
      b.life -= dt;
      (b.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, b.life / 0.25);
      if (b.life <= 0) b.line.visible = false;
    }
  }

  ctx: DefCtx = { kill: () => { /* */ }, boom: () => { /* */ }, shot: () => { /* */ } };

  private beam(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    const b = this.beams.find((x) => x.life <= 0);
    if (!b) return;
    const pos = b.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, x1, y1, z1); pos.setXYZ(1, x2, y2, z2); pos.needsUpdate = true;
    b.line.geometry.computeBoundingSphere();
    b.life = 0.25; b.line.visible = true;
    this.fx.spawn(x2, y2, z2, 0xfff06a, 6, 0.6, 2, 3, 0.4);
  }

  private updateProjs(dt: number) {
    const H = this.horde;
    const counts = [0, 0, 0];
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.life -= dt;
      if (p.kind === 1) p.vy -= 9.8 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      let done = false;
      if (p.kind === 1) {
        if (p.life <= 0 || p.y <= 0.1) {
          H.each(p.x, p.z, 2.4, (zb) => { if (H.hit(zb, p.dmg, { poison: 7 })) this.ctx.kill(zb, 'plant'); });
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
            if (H.hit(zb, p.dmg, { knock: this.v })) this.ctx.kill(zb, p.player ? 'player' : 'plant');
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
