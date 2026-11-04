import * as THREE from 'three';
import { bx, mat, cyl, cone, ico, box, addOutlines } from './gfx';
import { game } from './state';
import type { FX } from './fx';

export interface WallDef { name: string; icon: string; cost: number; hp: number; desc: string; level: number }
export const WALLS: WallDef[] = [
  { name: 'Cerca', icon: '🪵', cost: 25, hp: 260, desc: 'Bloqueia a passagem — os zumbis param para quebrar', level: 1 },
  { name: 'Espinhos', icon: '🌵', cost: 45, hp: 160, desc: 'Fere e deixa lento quem passa por cima', level: 2 },
  { name: 'Isca', icon: '🔔', cost: 90, hp: 380, desc: 'Espantalho barulhento: atrai zumbis num raio de 9 m', level: 4 },
];

export interface Wall { type: number; x: number; z: number; rot: number; hp: number; g: THREE.Group; bar: THREE.Mesh; hitT: number }

export class Walls {
  list: Wall[] = [];
  ghost = new THREE.Group();
  private ghostMats: THREE.MeshBasicMaterial[] = [];
  private ghostType = -1;

  constructor(private scene: THREE.Scene, private fx: FX) {
    scene.add(this.ghost);
    this.ghost.visible = false;
  }

  private model(type: number): THREE.Group {
    const g = new THREE.Group();
    if (type === 0) {
      for (const x of [-0.9, 0, 0.9]) bx(g, 0.18, 1.5, 0.18, 0x6b4425, x, 0.75, 0);
      for (const y of [0.45, 0.95, 1.35]) bx(g, 2.0, 0.22, 0.1, 0x9a6a3c, 0, y, 0);
      const d = bx(g, 2.3, 0.15, 0.08, 0x86592f, 0, 0.9, -0.08); d.rotation.z = 0.5;
    } else if (type === 1) {
      bx(g, 1.9, 0.15, 1.9, 0x6b4425, 0, 0.07, 0);
      for (let i = 0; i < 9; i++) {
        const s = new THREE.Mesh(cone(0.09, 0.7, 4), mat(0xc9c2b0));
        s.position.set(-0.6 + (i % 3) * 0.6, 0.4, -0.6 + Math.floor(i / 3) * 0.6);
        s.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
        s.castShadow = true; g.add(s);
      }
    } else {
      bx(g, 0.14, 2.4, 0.14, 0x6b4425, 0, 1.2, 0);
      bx(g, 1.6, 0.1, 0.1, 0x6b4425, 0, 1.8, 0);
      bx(g, 0.7, 0.8, 0.35, 0xc23b2b, 0, 1.6, 0);
      const h = new THREE.Mesh(ico(0.26, 1), mat(0xe9d39a)); h.position.y = 2.25; g.add(h);
      const bell = new THREE.Mesh(cyl(0.08, 0.16, 0.2, 8), mat(0xe8b830)); bell.position.set(0.7, 1.6, 0); g.add(bell);
      const flag = bx(g, 0.5, 0.35, 0.03, 0xff3a2a, 0.3, 2.55, 0);
      bx(g, 0.04, 0.8, 0.04, 0x6b4425, 0, 2.6, 0);
      flag.name = 'flag';
    }
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
  }

  add(type: number, x: number, z: number, rot: number, hp?: number): Wall {
    const g = this.model(type);
    g.position.set(x, 0, z); g.rotation.y = rot;
    addOutlines(g, 0.035);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.12), new THREE.MeshBasicMaterial({ color: 0x5fd04a, depthTest: false }));
    bar.position.y = type === 2 ? 3.1 : 1.9; bar.renderOrder = 21; bar.visible = false;
    g.add(bar);
    this.scene.add(g);
    const w: Wall = { type, x, z, rot, hp: hp ?? WALLS[type].hp, g, bar, hitT: 0 };
    this.list.push(w);
    g.scale.setScalar(0.01);
    return w;
  }

  at(x: number, z: number, r = 1.1): Wall | null {
    for (const w of this.list) if ((w.x - x) ** 2 + (w.z - z) ** 2 < r * r) return w;
    return null;
  }

  damage(w: Wall, d: number) {
    w.hp -= d; w.hitT = 0.15;
    if (Math.random() < 0.15) this.fx.spawn(w.x, 1, w.z, 0x9a6a3c, 2, 1, 2, 9, 0.5);
    if (w.hp <= 0) this.remove(w);
  }

  remove(w: Wall) {
    this.fx.spawn(w.x, 0.8, w.z, 0x9a6a3c, 25, 1.8, 4, 9, 0.9);
    this.scene.remove(w.g);
    this.list.splice(this.list.indexOf(w), 1);
  }

  clear() { for (const w of [...this.list]) this.scene.remove(w.g); this.list = []; }

  setGhost(type: number, x: number, z: number, rot: number, ok: boolean) {
    if (type < 0) { this.ghost.visible = false; return; }
    if (type !== this.ghostType) {
      this.ghost.clear();
      this.ghostMats = [];
      const m = this.model(type);
      m.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) { const gm = new THREE.MeshBasicMaterial({ color: 0x7dff6a, transparent: true, opacity: 0.45, depthWrite: false }); mesh.material = gm; mesh.castShadow = false; this.ghostMats.push(gm); }
      });
      this.ghost.add(m);
      this.ghostType = type;
    }
    this.ghost.visible = true;
    this.ghost.position.set(x, 0, z);
    this.ghost.rotation.y = rot;
    for (const gm of this.ghostMats) gm.color.set(ok ? 0x7dff6a : 0xff5a4a);
  }

  update(dt: number, time: number, cam: THREE.Camera) {
    for (const w of this.list) {
      if (w.g.scale.x < 1) w.g.scale.setScalar(Math.min(1, w.g.scale.x + dt * 4));
      w.hitT -= dt;
      w.g.position.x = w.x + (w.hitT > 0 ? (Math.random() - 0.5) * 0.08 : 0);
      const max = WALLS[w.type].hp;
      w.bar.visible = w.hp < max;
      if (w.bar.visible) {
        w.bar.scale.x = Math.max(0.01, w.hp / max);
        w.bar.quaternion.copy(cam.quaternion).premultiply(w.g.quaternion.clone().invert());
        (w.bar.material as THREE.MeshBasicMaterial).color.set(w.hp / max > 0.4 ? 0x5fd04a : 0xff5a3a);
      }
      if (w.type === 2) { const f = w.g.getObjectByName('flag'); if (f) f.rotation.y = Math.sin(time * 4 + w.x) * 0.4; }
    }
  }

  serialize() { return this.list.map((w) => ({ type: w.type, x: w.x, z: w.z, rot: w.rot, hp: Math.round(w.hp) })); }
  load(arr: { type: number; x: number; z: number; rot: number; hp: number }[] | undefined) {
    this.clear();
    for (const w of arr || []) { const n = this.add(w.type, w.x, w.z, w.rot, w.hp); n.g.scale.setScalar(1); }
  }
}

export const wallCost = (t: number) => WALLS[t].cost;
export const canBuildType = (t: number) => game.s.level >= WALLS[t].level;
