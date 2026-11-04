import * as THREE from 'three';
import { bx, mat, cyl, cone } from './gfx';
import { resolve } from './physics';
import { TILE } from './farm';

const ORANGE = 0xe8642c, DARK = 0x2e2f33, GREY = 0x6f747b, CREAM = 0xf2e6c8;

export class Tractor {
  group = new THREE.Group();
  speed = 0;
  yaw = 0;
  headYaw = 0;
  private wheelsR: THREE.Object3D[] = [];
  private wheelsF: THREE.Object3D[] = [];
  private frontPivots: THREE.Group[] = [];
  private impl: THREE.Group[] = [];
  private implRoot = new THREE.Group();
  private header = new THREE.Group();
  private reel!: THREE.Group;
  private steer = 0;
  readonly seat = new THREE.Vector3(0, 2.6, 1.0);
  readonly exhaust = new THREE.Vector3(0.45, 3.0, -1.35);

  constructor(scene: THREE.Scene) {
    const g = this.group;
    // chassi e capô
    bx(g, 1.1, 0.5, 4.2, DARK, 0, 0.85, -0.4);
    bx(g, 1.3, 1.0, 2.4, ORANGE, 0, 1.45, -1.35);
    bx(g, 1.32, 0.12, 2.42, CREAM, 0, 1.98, -1.35);
    bx(g, 1.2, 0.8, 0.12, 0x222222, 0, 1.45, -2.58); // grade
    for (const x of [-0.42, 0.42]) {
      const hl = new THREE.Mesh(cyl(0.12, 0.12, 0.08, 8), new THREE.MeshBasicMaterial({ color: 0xfff6cf }));
      hl.rotation.x = Math.PI / 2; hl.position.set(x, 1.75, -2.6); g.add(hl);
    }
    // cabine aberta
    bx(g, 1.8, 0.2, 2.0, DARK, 0, 1.35, 0.6);
    bx(g, 1.9, 0.9, 0.2, ORANGE, 0, 1.0, 1.6);
    for (const [x, z] of [[-0.85, -0.3], [0.85, -0.3], [-0.85, 1.5], [0.85, 1.5]]) bx(g, 0.07, 1.9, 0.07, DARK, x, 2.4, z);
    bx(g, 2.0, 0.12, 2.1, ORANGE, 0, 3.38, 0.6);
    bx(g, 2.06, 0.06, 2.16, CREAM, 0, 3.47, 0.6);
    bx(g, 0.8, 0.12, 0.7, 0x3a3a3a, 0, 1.6, 0.7); // assento
    bx(g, 0.8, 0.7, 0.12, 0x3a3a3a, 0, 1.95, 1.05);
    // painel e volante
    bx(g, 0.8, 0.45, 0.25, DARK, 0, 1.75, -0.2);
    const col = new THREE.Mesh(cyl(0.04, 0.04, 0.6, 6), mat(DARK)); col.position.set(0, 1.85, -0.05); col.rotation.x = -0.6; g.add(col);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), mat(0x1a1a1a)); wheel.position.set(0, 2.05, 0.12); wheel.rotation.x = -0.95; g.add(wheel);
    // escape
    const ex = new THREE.Mesh(cyl(0.07, 0.08, 1.5, 8), mat(0x555555)); ex.position.set(0.45, 2.3, -1.35); g.add(ex);
    // rodas traseiras
    for (const x of [-1.05, 1.05]) {
      const w = new THREE.Group(); w.position.set(x, 0.9, 0.8);
      const tire = new THREE.Mesh(cyl(0.9, 0.9, 0.6, 16), mat(0x1c1c1c)); tire.rotation.z = Math.PI / 2; tire.castShadow = true; w.add(tire);
      const rim = new THREE.Mesh(cyl(0.5, 0.5, 0.62, 10), mat(0xf2c230)); rim.rotation.z = Math.PI / 2; w.add(rim);
      for (let k = 0; k < 8; k++) { const lug = bx(w, 0.62, 0.12, 0.22, 0x1c1c1c, 0, 0, 0); const a = (k / 8) * Math.PI * 2; lug.position.set(0, Math.cos(a) * 0.9, Math.sin(a) * 0.9); lug.rotation.x = -a; }
      g.add(w); this.wheelsR.push(w);
      bx(g, 0.7, 0.1, 1.8, ORANGE, x, 1.9, 0.8);
    }
    // rodas dianteiras
    for (const x of [-0.8, 0.8]) {
      const pv = new THREE.Group(); pv.position.set(x, 0.5, -2.0);
      const w = new THREE.Group();
      const tire = new THREE.Mesh(cyl(0.5, 0.5, 0.36, 14), mat(0x1c1c1c)); tire.rotation.z = Math.PI / 2; tire.castShadow = true; w.add(tire);
      const rim = new THREE.Mesh(cyl(0.28, 0.28, 0.38, 10), mat(0xf2c230)); rim.rotation.z = Math.PI / 2; w.add(rim);
      pv.add(w); g.add(pv);
      this.frontPivots.push(pv); this.wheelsF.push(w);
    }
    // implementos
    g.add(this.implRoot);
    this.impl = [this.plow(), this.seeder(), this.sprayer(), new THREE.Group()];
    for (const i of this.impl) this.implRoot.add(i);
    this.buildHeader();
    g.add(this.header);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    scene.add(g);
  }

  private plow() {
    const g = new THREE.Group(); g.position.z = 2.9;
    bx(g, 2, 0.15, 0.2, GREY, 0, 0.75, -0.6);
    bx(g, 0.15, 0.15, 1.2, GREY, 0, 0.75, -1.2);
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(cyl(0.32, 0.32, 0.05, 10), mat(0xb9bec6)); d.rotation.set(0.3, 0, Math.PI / 2 + 0.3); d.position.set(-0.75 + i * 0.5, 0.35, -0.3 + (i % 2) * 0.3); g.add(d);
      bx(g, 0.06, 0.5, 0.06, GREY, -0.75 + i * 0.5, 0.6, -0.4);
    }
    return g;
  }
  private seeder() {
    const g = new THREE.Group(); g.position.z = 2.9;
    bx(g, 2, 0.15, 0.2, GREY, 0, 0.6, -0.4);
    bx(g, 0.15, 0.15, 1.2, GREY, 0, 0.75, -1.2);
    bx(g, 1.9, 0.6, 0.8, 0x3d7fc2, 0, 1.2, 0);
    bx(g, 1.95, 0.08, 0.85, 0xf2efe6, 0, 1.52, 0);
    for (let i = 0; i < 4; i++) bx(g, 0.07, 0.7, 0.07, 0x222222, -0.75 + i * 0.5, 0.45, 0.1);
    return g;
  }
  private sprayer() {
    const g = new THREE.Group(); g.position.z = 2.6;
    bx(g, 0.15, 0.15, 1.0, GREY, 0, 0.75, -1);
    const tank = new THREE.Mesh(cyl(0.55, 0.55, 1.3, 12), mat(0xf2efe6)); tank.rotation.z = Math.PI / 2; tank.position.set(0, 1.2, 0); g.add(tank);
    bx(g, 2, 0.08, 0.08, GREY, 0, 0.9, 0.6);
    for (let i = 0; i < 5; i++) bx(g, 0.04, 0.3, 0.04, 0x3d7fc2, -0.9 + i * 0.45, 0.7, 0.6);
    return g;
  }
  private buildHeader() {
    const g = this.header; g.position.z = -3.4;
    bx(g, 2.1, 0.5, 0.9, 0xd8b02a, 0, 0.45, 0);
    for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(cone(0.09, 0.5, 4), mat(0xb9bec6)); c.rotation.x = -Math.PI / 2; c.position.set(-0.9 + i * 0.3, 0.25, -0.65); g.add(c); }
    this.reel = new THREE.Group(); this.reel.position.set(0, 0.95, -0.25);
    const ax = new THREE.Mesh(cyl(0.05, 0.05, 2.1, 6), mat(GREY)); ax.rotation.z = Math.PI / 2; this.reel.add(ax);
    for (let k = 0; k < 5; k++) { const b = bx(this.reel, 2.0, 0.05, 0.05, 0xe8642c, 0, 0, 0); const a = (k / 5) * Math.PI * 2; b.position.set(0, Math.cos(a) * 0.38, Math.sin(a) * 0.38); }
    g.add(this.reel);
    bx(g, 0.15, 0.15, 1.2, GREY, 0, 0.75, 0.9);
  }

  setMode(mode: number, width: number) {
    this.impl.forEach((g, i) => { g.visible = i === mode; });
    this.header.visible = mode === 3;
    const sx = (width * TILE) / 2;
    for (const g of this.impl) g.scale.x = sx;
    this.header.scale.x = sx;
  }

  setPose(x: number, z: number, yaw: number) {
    this.group.position.set(x, 0, z);
    this.yaw = yaw;
    this.group.rotation.y = yaw;
  }

  update(dt: number, throttle: number, steer: number, maxSpeed: number, gps = false) {
    const target = throttle * maxSpeed * (throttle < 0 ? 0.5 : 1);
    const acc = Math.abs(target) > Math.abs(this.speed) ? 5 : 8;
    this.speed += Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), acc * dt);
    this.steer += (steer - this.steer) * Math.min(1, dt * 6);
    this.yaw -= this.steer * Math.sign(this.speed) * Math.min(Math.abs(this.speed), 4) * 0.42 * dt;
    const p = this.group.position;
    // Assistência: alinha às fileiras quando não está virando
    if (Math.abs(steer) < 0.12 && Math.abs(this.speed) > 0.6) {
      const q = Math.PI / 2;
      const target = Math.round(this.yaw / q) * q;
      const diff = target - this.yaw;
      const thr = gps ? 0.7 : 0.22;
      if (Math.abs(diff) < thr) {
        this.yaw += diff * Math.min(1, dt * (gps ? 4 : 2.2));
        if (gps && Math.abs(diff) < 0.08) {
          // centraliza nos canteiros (centros em coordenadas ímpares)
          const alongZ = Math.abs(Math.sin(target)) < 0.5;
          const odd = (v: number) => Math.round((v - 1) / 2) * 2 + 1;
          const k = Math.min(1, dt * 2.5);
          if (alongZ) p.x += (odd(p.x) - p.x) * k; else p.z += (odd(p.z) - p.z) * k;
        }
      }
    }
    p.x += -Math.sin(this.yaw) * this.speed * dt;
    p.z += -Math.cos(this.yaw) * this.speed * dt;
    if (resolve(p, 1.9)) this.speed *= 0.6;
    this.group.rotation.y = this.yaw;
    const sp = this.speed * dt;
    for (const w of this.wheelsR) w.rotation.x -= sp / 0.9;
    for (const w of this.wheelsF) w.rotation.x -= sp / 0.5;
    for (const pv of this.frontPivots) pv.rotation.y = -this.steer * 0.5;
    this.reel.rotation.x -= dt * 4;
    // leve vibração do motor
    this.group.position.y = Math.sin(performance.now() * 0.06) * 0.008;
  }

  /** Pontos de trabalho do implemento no mundo. */
  workPoints(mode: number, width: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const lz = mode === 3 ? -3.4 : 3.0;
    for (let i = 0; i < width; i++) {
      const lx = (i - (width - 1) / 2) * TILE;
      out.push(this.group.localToWorld(new THREE.Vector3(lx, 0, lz)));
    }
    return out;
  }

  exhaustWorld() { return this.group.localToWorld(this.exhaust.clone()); }
  seatWorld() { return this.group.localToWorld(this.seat.clone()); }
}
