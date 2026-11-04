import * as THREE from 'three';
import { mat, addOutlines } from './gfx';
import { game, lv } from './state';
import type { FX } from './fx';
import type { Horde, Zombie } from './zombies';

const HX = -17, HZ = 12;
export interface Entry { name: string; x: number; z: number; nx: number; nz: number; door: boolean; boards: THREE.Mesh[]; g: THREE.Group }

const ENTRIES: [string, number, number, number, number, boolean][] = [
  ['Porta', -11.9, 12, 1, 0, true],
  ['Janela da frente', -11.95, 9.4, 1, 0, false],
  ['Janela da frente', -11.95, 14.6, 1, 0, false],
  ['Janela norte', -19.5, 7.9, 0, -1, false],
  ['Janela norte', -14.5, 7.9, 0, -1, false],
  ['Janela dos fundos', -22.05, 12, -1, 0, false],
];
export const PLANK_HP = 70;
export const plankHp = () => PLANK_HP * (lv('plates') ? 2.2 : 1);
export const maxPlanks = (e: Entry) => (e.door ? 4 : 3);

export class House {
  entries: Entry[] = [];
  private turret = new THREE.Group();
  private turretHead = new THREE.Group();
  private porch = new THREE.Group();
  private light = new THREE.SpotLight(0xfff0c0, 0, 30, 1.0, 0.5, 1.2);
  private lightMesh = new THREE.Group();
  private turretCd = 0;
  private hitT: number[] = [];
  onBreak: (e: Entry) => void = () => { /* */ };

  constructor(private scene: THREE.Scene, private fx: FX, private horde: Horde) {
    for (const [name, x, z, nx, nz, door] of ENTRIES) {
      const g = new THREE.Group();
      g.position.set(x + nx * 0.12, 0, z + nz * 0.12);
      g.rotation.y = Math.atan2(nx, nz);
      const boards: THREE.Mesh[] = [];
      const n = door ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(door ? 1.7 : 1.5, 0.22, 0.08), mat(i % 2 ? 0x9a6a3c : 0xb07a46));
        if (door) b.position.set(0, 0.5 + i * 0.5, 0); else b.position.set(0, 2.15 + (i - 1) * 0.42, 0);
        b.rotation.z = (i % 2 ? 1 : -1) * (door ? 0.12 : 0.35);
        b.castShadow = true;
        // pregos
        for (const sx of [-0.6, 0.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), mat(0x5a5a5a)); p.position.set(sx, 0, 0.05); b.add(p); }
        g.add(b); boards.push(b);
      }
      addOutlines(g, 0.025);
      scene.add(g);
      this.entries.push({ name, x, z, nx, nz, door, boards, g });
      this.hitT.push(0);
    }
    // torreta no telhado
    const T = this.turret; T.position.set(HX + 2, 6.6, HZ - 1.5);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.5, 10), mat(0x5a5f66)); T.add(base);
    const H = this.turretHead; H.position.y = 0.55; T.add(H);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), mat(0x6f7a5a)); H.add(body);
    for (const sx of [-0.18, 0.18]) { const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 8), mat(0x3a3a3a)); barrel.rotation.x = Math.PI / 2; barrel.position.set(sx, 0.05, -0.75); H.add(barrel); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a2a })); lamp.position.set(0, 0.35, 0.2); H.add(lamp);
    addOutlines(T, 0.03);
    scene.add(T);
    // armadilha de varanda: estacas ao redor da casa
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const x = HX + Math.cos(a) * 7.6, z = HZ + Math.sin(a) * 6.4;
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 5), mat(0xd8cfb4));
      s.position.set(x, 0.3, z); s.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
      this.porch.add(s);
    }
    addOutlines(this.porch, 0.02);
    scene.add(this.porch);
    // holofote
    const L = this.lightMesh; L.position.set(HX - 4, 6.4, HZ - 3.6);
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.5, 10), mat(0x3a3a3a)); lb.rotation.x = 1.0; L.add(lb);
    const lg = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), new THREE.MeshBasicMaterial({ color: 0xfff6c8 })); lg.position.set(0, -0.15, -0.23); lg.rotation.x = 1.0 + Math.PI / 2; lg.rotation.x = -0.6; L.add(lg);
    addOutlines(L, 0.02);
    scene.add(L);
    this.light.position.set(HX - 4, 6.4, HZ - 3.6);
    this.light.target.position.set(HX, 0, HZ - 16);
    scene.add(this.light, this.light.target);
    if (!game.s.entries || game.s.entries.length !== this.entries.length) game.s.entries = this.entries.map((e) => maxPlanks(e) * plankHp());
    this.refresh();
  }

  hp(i: number) { return game.s.entries[i]; }
  max(i: number) { return maxPlanks(this.entries[i]) * plankHp(); }

  /** Entrada mais próxima de um ponto. */
  nearest(x: number, z: number): number {
    let b = 0, bd = Infinity;
    this.entries.forEach((e, i) => { const d = (e.x - x) ** 2 + (e.z - z) ** 2; if (d < bd) { bd = d; b = i; } });
    return b;
  }
  /** Ponto onde o zumbi fica para atacar a entrada. */
  spot(i: number) { const e = this.entries[i]; return { x: e.x + e.nx * 0.95, z: e.z + e.nz * 0.95 }; }

  damage(i: number, d: number) {
    const before = Math.ceil(game.s.entries[i] / plankHp());
    game.s.entries[i] = Math.max(0, game.s.entries[i] - d);
    this.hitT[i] = 0.15;
    const after = Math.ceil(game.s.entries[i] / plankHp());
    if (after < before) {
      const e = this.entries[i];
      this.fx.spawn(e.x + e.nx * 0.4, e.door ? 1.2 : 2.2, e.z + e.nz * 0.4, 0xb07a46, 14, 1.2, 4, 9, 0.9);
      this.refresh();
      if (after === 0) this.onBreak(e);
    }
  }

  /** Prega uma tábua. Retorna false se já está no máximo. */
  repair(i: number): boolean {
    const m = this.max(i);
    if (game.s.entries[i] >= m - 0.5) return false;
    game.s.entries[i] = Math.min(m, (Math.floor(game.s.entries[i] / plankHp()) + 1) * plankHp());
    const e = this.entries[i];
    this.fx.spawn(e.x + e.nx * 0.4, e.door ? 1.2 : 2.2, e.z + e.nz * 0.4, 0xe8c27a, 10, 0.8, 2, 6, 0.6);
    this.refresh();
    return true;
  }

  repairAll() { this.entries.forEach((_, i) => { game.s.entries[i] = this.max(i); }); this.refresh(); }

  refresh() {
    const metal = lv('plates') > 0;
    this.entries.forEach((e, i) => {
      const n = Math.ceil(game.s.entries[i] / plankHp() - 0.001);
      e.boards.forEach((b, k) => {
        b.visible = k < n;
        b.material = mat(metal ? (k % 2 ? 0x8a949e : 0xa2acb6) : (k % 2 ? 0x9a6a3c : 0xb07a46));
      });
    });
    this.turret.visible = lv('turret') > 0;
    this.porch.visible = lv('porch') > 0;
    this.lightMesh.visible = lv('spot') > 0;
  }

  openCount() { return game.s.entries.filter((h) => h <= 0).length; }

  update(dt: number, time: number, night: boolean, kill: (z: Zombie) => void, shot: (from: THREE.Vector3, to: THREE.Vector3) => void) {
    this.entries.forEach((e, i) => {
      this.hitT[i] -= dt;
      e.g.position.x = e.x + e.nx * 0.12 + (this.hitT[i] > 0 ? (Math.random() - 0.5) * 0.08 : 0);
    });
    this.light.intensity = night && lv('spot') ? 120 : 0;
    if (lv('spot')) this.light.target.position.set(HX + Math.sin(time * 0.5) * 12, 0, HZ - 14 + Math.cos(time * 0.4) * 4);
    if (!night) return;
    // torreta
    if (lv('turret')) {
      this.turretCd -= dt;
      const z = this.horde.nearest(HX, HZ, 18);
      if (z) {
        const yaw = Math.atan2(-(z.g.position.x - (HX + 2)), -(z.g.position.z - (HZ - 1.5)));
        this.turretHead.rotation.y += (Math.atan2(Math.sin(yaw - this.turretHead.rotation.y), Math.cos(yaw - this.turretHead.rotation.y))) * Math.min(1, dt * 8);
        if (this.turretCd <= 0) {
          this.turretCd = 0.45;
          const from = this.turretHead.localToWorld(new THREE.Vector3(0, 0.05, -1.2));
          shot(from, new THREE.Vector3(z.g.position.x, z.kind === 'crow' ? 3.4 : 1.2, z.g.position.z));
          if (this.horde.hit(z, 14 * (1 + 0.5 * (lv('turret') - 1)))) kill(z);
        }
      }
    }
    // armadilha
    if (lv('porch')) {
      this.horde.each(HX, HZ, 8.2, (z) => {
        const dx = (z.g.position.x - HX) / 7.6, dz = (z.g.position.z - HZ) / 6.4;
        if (dx * dx + dz * dz < 1.15 && dx * dx + dz * dz > 0.7 && z.kind !== 'crow' && this.horde.hit(z, 12 * dt, { slow: 0.5, slowT: 0.3 })) kill(z);
      });
    }
    // holofote cega quem está na luz
    if (lv('spot')) {
      const tp = this.light.target.position;
      this.horde.each(tp.x, tp.z, 6, (z) => { z.slowK = Math.min(z.slowK, 0.75); z.slowT = Math.max(z.slowT, 0.2); });
    }
  }
}
