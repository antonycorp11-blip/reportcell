import * as THREE from 'three';
import { box, mat, cone, ico } from './gfx';
import { resolve } from './physics';
import * as farm from './farm';
import type { FX } from './fx';
import type { Walls } from './walls';
import { buildZombie } from './zmodels';

export type ZKind = 'walker' | 'runner' | 'brute' | 'digger' | 'crow' | 'colossus';

export const ZDEF: Record<ZKind, { name: string; hp: number; speed: number; dps: number; reward: number; scale: number; shirt: number; skin: number }> = {
  walker: { name: 'Andarilho', hp: 95, speed: 1.4, dps: 15, reward: 6, scale: 1, shirt: 0x5a6f8a, skin: 0x86a06e },
  runner: { name: 'Corredor', hp: 55, speed: 3.1, dps: 12, reward: 8, scale: 0.9, shirt: 0xa0463a, skin: 0x9aae7a },
  brute: { name: 'Brutamonte', hp: 520, speed: 0.85, dps: 40, reward: 26, scale: 1.55, shirt: 0x3c3c44, skin: 0x6f8a5a },
  digger: { name: 'Cavador', hp: 140, speed: 1.8, dps: 20, reward: 15, scale: 0.95, shirt: 0x7a5a3a, skin: 0x8a9a62 },
  crow: { name: 'Corvo-zumbi', hp: 48, speed: 3.6, dps: 9, reward: 10, scale: 1, shirt: 0x1d1f22, skin: 0x2f3a2a },
  colossus: { name: 'Colosso', hp: 4200, speed: 0.65, dps: 90, reward: 320, scale: 2.7, shirt: 0x4a2a3a, skin: 0x5f7a4a },
};

export interface Zombie {
  kind: ZKind; g: THREE.Group; hp: number; max: number; speed: number; dps: number; reward: number;
  legs: THREE.Object3D[]; arms: THREE.Object3D[]; body: THREE.Object3D;
  walk: number; slowT: number; slowK: number; poisonT: number; poisonD: number;
  dead: number; burrowed: boolean; mound?: THREE.Mesh; bar: THREE.Group; barFg: THREE.Mesh;
  hitT: number; ramT: number; groan: number; vx: number; vz: number; eating: boolean;
  path: [number, number][] | null; wp: number; ox: number; oz: number;
  torso: THREE.Object3D; head: THREE.Object3D; lean: number;
}

const BASE = new THREE.Vector3(-17, 0, 12);
const HOUSE = { x1: -22.4, z1: 7.8, x2: -11.6, z2: 16.2 };
const geo = {
  torso: box(0.56, 0.72, 0.32), head: box(0.4, 0.42, 0.4), limb: box(0.17, 0.62, 0.17), leg: box(0.2, 0.8, 0.2),
  eye: box(0.08, 0.06, 0.04), mound: new THREE.SphereGeometry(0.7, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  wing: box(1.1, 0.04, 0.4), beak: cone(0.06, 0.25, 4), bar: new THREE.PlaneGeometry(1, 0.11),
};
geo.limb.translate(0, -0.28, 0);
geo.leg.translate(0, -0.4, 0);
geo.wing.translate(0.55, 0, 0);
export const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b2a });
const barBg = new THREE.MeshBasicMaterial({ color: 0x220000, depthTest: false, transparent: true, opacity: 0.7 });
const barFgMat = new THREE.MeshBasicMaterial({ color: 0xff4040, depthTest: false });
const pants = [0x3a4a5e, 0x4e3e2e, 0x2e3a2e, 0x5a4a6a];

export interface ZCtx {
  player: THREE.Vector3; tractor: THREE.Vector3 | null; tractorSpeed: number; camera: THREE.Camera;
  hurtPlayer: (d: number) => void; hurtBase: (d: number) => void; kill: (z: Zombie) => void; ramHit: (z: Zombie) => void;
  walls: Walls; speedMult: number;
}

export class Horde {
  list: Zombie[] = [];
  private scene: THREE.Scene;
  private fx: FX;
  outline = true;

  constructor(scene: THREE.Scene, fx: FX) { this.scene = scene; this.fx = fx; }

  alive() { let n = 0; for (const z of this.list) if (z.dead === 0) n++; return n; }

  spawn(kind: ZKind, x: number, z: number, hpMult: number, path: [number, number][] | null = null) {
    const d = ZDEF[kind];
    const parts = buildZombie(kind, this.outline);
    const g = parts.root;
    const body = parts.body;
    const legs: THREE.Object3D[] = parts.legs, arms: THREE.Object3D[] = parts.arms;
    // barra de vida
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(geo.bar, barBg); bg.renderOrder = 20; bar.add(bg);
    const fg = new THREE.Mesh(geo.bar, barFgMat); fg.renderOrder = 21; fg.position.z = 0.001; bar.add(fg);
    bar.position.y = kind === 'crow' ? 4.2 : 2.0 * d.scale + 0.25;
    bar.scale.setScalar(kind === 'colossus' ? 2.4 : 1);
    bar.visible = false;
    g.add(bar);
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-(BASE.x - x), -(BASE.z - z));
    this.scene.add(g);
    const zb: Zombie = {
      kind, g, hp: d.hp * hpMult, max: d.hp * hpMult, speed: d.speed * (0.9 + Math.random() * 0.2), dps: d.dps * (1 + (hpMult - 1) * 0.5), reward: Math.round(d.reward * (1 + (hpMult - 1) * 0.4)),
      legs, arms, body, torso: parts.torso, head: parts.head, lean: parts.torso.rotation.x, walk: Math.random() * 6, slowT: 0, slowK: 1, poisonT: 0, poisonD: 0, dead: 0,
      burrowed: kind === 'digger', bar, barFg: fg, hitT: 0, ramT: 0, groan: 2 + Math.random() * 8, vx: 0, vz: 0, eating: false,
      path: kind === 'crow' ? null : path, wp: 1, ox: (Math.random() - 0.5) * 2.4, oz: (Math.random() - 0.5) * 2.4,
    };
    if (zb.burrowed) {
      body.visible = false;
      zb.mound = new THREE.Mesh(geo.mound, mat(0x6b4a2a)); zb.mound.scale.y = 0.5; g.add(zb.mound);
    }
    this.list.push(zb);
    return zb;
  }

  /** Aplica dano; retorna true se matou. */
  hit(z: Zombie, dmg: number, opt: { slow?: number; slowT?: number; poison?: number; knock?: THREE.Vector3; ignoreBurrow?: boolean } = {}): boolean {
    if (z.dead) return false;
    if (z.burrowed && !opt.ignoreBurrow) return false;
    z.hp -= dmg;
    z.hitT = 0.12;
    if (opt.slow) { z.slowK = Math.min(z.slowK, opt.slow); z.slowT = Math.max(z.slowT, opt.slowT ?? 1); }
    if (opt.poison) { z.poisonD = Math.max(z.poisonD, opt.poison); z.poisonT = 3; }
    if (opt.knock && z.kind !== 'colossus') { z.vx += opt.knock.x; z.vz += opt.knock.z; }
    const p = z.g.position;
    this.fx.spawn(p.x, (z.kind === 'crow' ? 3.4 : 1.3) * (z.kind === 'colossus' ? 2 : 1), p.z, 0x7fbf3a, 4, 0.8, 2.5, 8, 0.5);
    if (z.hp <= 0) { z.dead = 0.001; z.bar.visible = false; return true; }
    return false;
  }

  /** Zumbi vivo e atingível mais próximo de um ponto. */
  nearest(x: number, z: number, range: number, allowFly = true, allowBurrow = false): Zombie | null {
    let best: Zombie | null = null, bd = range * range;
    for (const zb of this.list) {
      if (zb.dead || (zb.burrowed && !allowBurrow) || (!allowFly && zb.kind === 'crow')) continue;
      const dx = zb.g.position.x - x, dz = zb.g.position.z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = zb; }
    }
    return best;
  }

  each(x: number, z: number, r: number, f: (z: Zombie) => void, burrowToo = false) {
    for (const zb of this.list) {
      if (zb.dead || (zb.burrowed && !burrowToo)) continue;
      const dx = zb.g.position.x - x, dz = zb.g.position.z - z;
      if (dx * dx + dz * dz < r * r) f(zb);
    }
  }

  clear() { for (const z of this.list) this.scene.remove(z.g); this.list = []; }

  update(dt: number, time: number, ctx: ZCtx) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const z = L[i];
      const p = z.g.position;
      if (z.dead) {
        z.dead += dt;
        if (z.dead < 0.5) z.body.rotation.x = -(z.dead / 0.5) * 1.5;
        else p.y -= dt * 0.8;
        if (z.kind === 'crow') p.y -= dt * 4;
        if (z.dead > 2.2) { this.scene.remove(z.g); L.splice(i, 1); }
        continue;
      }
      // status
      if (z.poisonT > 0) { z.poisonT -= dt; z.hp -= z.poisonD * dt; if (Math.random() < dt * 4) this.fx.spawn(p.x, 1.5, p.z, 0xff4f6a, 1, 0.4, 1, -1, 0.6); if (z.hp <= 0) { z.dead = 0.001; z.bar.visible = false; ctx.kill(z); continue; } }
      if (z.slowT > 0) { z.slowT -= dt; if (z.slowT <= 0) z.slowK = 1; }
      z.hitT -= dt;
      z.ramT -= dt;

      // alvo: jogador (se perto) ou a casa
      const dpx = ctx.player.x - p.x, dpz = ctx.player.z - p.z;
      const dPlayer = Math.hypot(dpx, dpz);
      const chase = dPlayer < (z.kind === 'crow' ? 16 : 10) && !z.burrowed;
      let tx = BASE.x, tz = BASE.z;
      if (z.path && z.wp < z.path.length) {
        const last = z.wp === z.path.length - 1;
        tx = z.path[z.wp][0] + (last ? 0 : z.ox); tz = z.path[z.wp][1] + (last ? 0 : z.oz);
        if ((tx - p.x) ** 2 + (tz - p.z) ** 2 < (last ? 0.5 : 3)) z.wp++;
      }
      // isca (espantalho) atrai
      let decoy: import('./walls').Wall | null = null;
      if (!chase && !z.burrowed && z.kind !== 'colossus') {
        for (const w of ctx.walls.list) if (w.type === 2 && (w.x - p.x) ** 2 + (w.z - p.z) ** 2 < 81) { decoy = w; tx = w.x; tz = w.z; break; }
      }
      if (chase) { tx = ctx.player.x; tz = ctx.player.z; }
      // distância até a casa
      const cx = Math.max(HOUSE.x1, Math.min(p.x, HOUSE.x2)), cz = Math.max(HOUSE.z1, Math.min(p.z, HOUSE.z2));
      const dHouse = Math.hypot(p.x - cx, p.z - cz);
      if (z.burrowed && dHouse < 16) {
        z.burrowed = false; z.body.visible = true; if (z.mound) z.g.remove(z.mound);
        this.fx.spawn(p.x, 0.3, p.z, 0x6b4a2a, 25, 2, 5, 9, 0.9);
      }
      let speed = z.speed * z.slowK * ctx.speedMult;
      z.eating = false;
      let attacking = false;
      // barricadas
      if (z.kind !== 'crow' && !z.burrowed) {
        for (const w of ctx.walls.list) {
          const dx = p.x - w.x, dz = p.z - w.z;
          if (dx * dx + dz * dz > 6) continue;
          const c = Math.cos(w.rot), sn = Math.sin(w.rot);
          const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
          const sc = ZDEF[z.kind].scale;
          if (w.type === 0 && Math.abs(lx) < 1.15 + 0.3 * sc && Math.abs(lz) < 0.55 + 0.3 * sc) { attacking = true; ctx.walls.damage(w, z.dps * dt * (z.kind === 'colossus' ? 3 : 1)); tx = w.x; tz = w.z; break; }
          if (w.type === 2 && dx * dx + dz * dz < (0.9 + 0.4 * sc) ** 2) { attacking = true; ctx.walls.damage(w, z.dps * dt); tx = w.x; tz = w.z; break; }
          if (w.type === 1 && Math.abs(lx) < 1.1 && Math.abs(lz) < 1.1) {
            speed *= 0.5;
            ctx.walls.damage(w, 5 * dt);
            if (this.hit(z, 18 * dt, { slow: 0.5, slowT: 0.5 })) { ctx.kill(z); }
          }
        }
        if (z.dead) continue;
      }
      void decoy;
      if (attacking) { /* quebrando barricada */ }
      else if (!chase && dHouse < 0.9 * (z.kind === 'colossus' ? 2.2 : 1) + 0.5) { attacking = true; ctx.hurtBase(z.dps * dt); }
      else if (chase && dPlayer < 1.2 * (z.kind === 'colossus' ? 2 : 1)) { attacking = true; ctx.hurtPlayer(z.dps * dt); }
      else if (z.kind !== 'crow' && !z.burrowed) {
        const t = farm.tileAt(p.x, p.z);
        if (t >= 0 && farm.T.s[t] === 2 && farm.T.h[t] > 0) {
          z.eating = true;
          if (farm.T.c[t] === 6 && this.hit(z, 14 * dt * (1 + 0.3 * farm.plantLevel(t)))) { ctx.kill(z); continue; }
          if (farm.damageTile(t, z.dps * dt * (z.kind === 'colossus' ? 4 : 1))) this.fx.spawn(farm.tileX(t), 0.5, farm.tileZ(t), 0x6a8a3a, 12, 1.2, 3, 9, 0.8);
          else if (Math.random() < dt * 3) this.fx.spawn(farm.tileX(t), 0.6, farm.tileZ(t), 0x7fb54a, 2, 0.8, 2, 9, 0.5);
        }
      }
      if (attacking || z.eating) speed = 0;
      const dx = tx - p.x, dz = tz - p.z, dd = Math.hypot(dx, dz) || 1;
      let mx = (dx / dd) * speed, mz = (dz / dd) * speed;
      // separação
      for (const o of L) {
        if (o === z || o.dead || o.kind === 'crow') continue;
        const ox = p.x - o.g.position.x, oz = p.z - o.g.position.z, od = ox * ox + oz * oz;
        if (od < 0.64 && od > 1e-4) { const k = (0.8 - Math.sqrt(od)) * 2; mx += ox * k; mz += oz * k; }
      }
      p.x += (mx + z.vx) * dt; p.z += (mz + z.vz) * dt;
      z.vx *= Math.exp(-dt * 6); z.vz *= Math.exp(-dt * 6);
      if (z.kind !== 'crow') resolve(p, 0.4 * ZDEF[z.kind].scale);
      if (z.burrowed && Math.random() < dt * 6) this.fx.spawn(p.x, 0.2, p.z, 0x6b4a2a, 1, 0.6, 1.5, 9, 0.5);
      // trator atropela
      if (ctx.tractor && Math.abs(ctx.tractorSpeed) > 1.8 && z.ramT <= 0 && z.kind !== 'crow' && !z.burrowed) {
        const tx2 = p.x - ctx.tractor.x, tz2 = p.z - ctx.tractor.z;
        if (tx2 * tx2 + tz2 * tz2 < 5.5) { z.ramT = 0.6; ctx.ramHit(z); }
      }
      // animação
      if (speed > 0.05) {
        const yaw = Math.atan2(-mx, -mz);
        let dy = yaw - z.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        z.g.rotation.y += dy * Math.min(1, dt * 5);
      } else if (attacking || z.eating) {
        const yaw = Math.atan2(-(tx - p.x), -(tz - p.z));
        if (!z.eating) z.g.rotation.y = yaw;
      }
      z.walk += dt * speed * 4.5;
      const sw = Math.sin(z.walk) * 0.6;
      const hitK = z.hitT > 0 ? z.hitT / 0.12 : 0;
      z.g.scale.set(1 + hitK * 0.12, 1 - hitK * 0.12, 1 + hitK * 0.12);
      if (z.kind === 'crow') {
        const f = Math.sin(time * 14 + z.walk) * 0.7;
        z.arms[0].rotation.z = -f; z.arms[1].rotation.z = f;
        z.body.position.y = Math.sin(time * 3 + z.walk) * 0.2;
        z.head.rotation.z = Math.sin(time * 4 + z.walk) * 0.25;
      } else {
        const moving = speed > 0.05 ? 1 : 0;
        z.legs[0].rotation.x = sw * moving; z.legs[1].rotation.x = -sw * moving;
        const atk = attacking || z.eating ? Math.sin(time * 11 + z.walk) * 0.6 : 0;
        const reach = z.kind === 'brute' || z.kind === 'colossus' ? 1.1 : 1.4;
        z.arms[0].rotation.x = reach + sw * 0.3 * moving + atk + Math.sin(time * 2.3 + z.walk) * 0.1;
        z.arms[1].rotation.x = reach - sw * 0.3 * moving - atk + Math.sin(time * 2.1 + z.walk + 1) * 0.1;
        z.arms[0].rotation.z = -0.15; z.arms[1].rotation.z = 0.15;
        // cambaleio
        z.body.rotation.z = Math.sin(z.walk * 0.5) * 0.12;
        z.body.position.y = (z.eating ? -0.3 : 0) + Math.abs(Math.cos(z.walk)) * 0.06 * moving;
        z.torso.rotation.x = z.lean + (z.eating ? 0.6 : 0) + Math.sin(z.walk) * 0.06;
        z.head.rotation.z = Math.sin(z.walk * 0.5 + 0.8) * 0.3 + 0.15;
        z.head.rotation.x = Math.sin(time * 1.7 + z.walk) * 0.12 - (z.eating ? 0.4 : 0);
      }
      // barra de vida
      if (z.hp < z.max) {
        z.bar.visible = true;
        const k = Math.max(0, z.hp / z.max);
        z.barFg.scale.x = k; z.barFg.position.x = -(1 - k) / 2;
        z.bar.quaternion.copy(ctx.camera.quaternion).premultiply(z.g.quaternion.clone().invert());
      }
      z.groan -= dt;
    }
  }
}
