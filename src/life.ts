import * as THREE from 'three';
import { bx, mat, cyl, cone, ico, box, prism, part, merge, rng, windMat, shade } from './gfx';
import { colliders } from './physics';
import { game, lv, type State } from './state';
import type { FX } from './fx';

interface Animal {
  g: THREE.Group; legs: THREE.Object3D[]; head: THREE.Object3D;
  kind: 'cow' | 'chicken'; target: THREE.Vector3; wait: number; walk: number; area: number[];
}

interface Deco { name: string; g: THREE.Group; cond: (s: State) => boolean; shown: boolean; anim: number; fx?: THREE.Vector3 }

const PASTURE = [38, 2, 61, 29];
const COOP_AREA = [8, 19.5, 30, 29.5];

export class Life {
  private scene: THREE.Scene;
  private fx: FX;
  private animals: Animal[] = [];
  private decos: Deco[] = [];
  private init = false;
  private turbineRotor = new THREE.Group();
  private fountainT = 0;
  private beeT = 0;
  onUnlock: (name: string) => void = () => { /* */ };

  constructor(scene: THREE.Scene, fx: FX) {
    this.scene = scene;
    this.fx = fx;
    this.add('Espantalho', this.scarecrow(), (s) => s.level >= 2, new THREE.Vector3(38, 0, -10));
    this.add('Galinheiro', this.coop(), (s) => s.level >= 2, new THREE.Vector3(27, 0, 26));
    this.add('Canteiro de flores', this.flowerBeds(), (s) => s.level >= 3, new THREE.Vector3(-17, 0, 6.6));
    this.add('Pasto com vacas', this.pasture(), (s) => s.level >= 4, new THREE.Vector3(50, 0, 15));
    this.add('Área de piquenique', this.picnic(), (s) => s.level >= 4, new THREE.Vector3(-46, 0, 12));
    this.add('Apiário', this.hives(), (s) => s.level >= 5, new THREE.Vector3(-25, 0, 0));
    this.add('Pomar', this.orchard(), (s) => s.level >= 6, new THREE.Vector3(-19, 0, 25));
    this.add('Bandeirinhas de festa', this.bunting(), (s) => s.level >= 7, new THREE.Vector3(0, 0, -3));
    this.add('Chafariz', this.fountain(), (s) => s.level >= 9, new THREE.Vector3(0, 0, 5.5));
    this.add('Estufa', this.greenhouse(), (s) => s.level >= 10, new THREE.Vector3(-50, 0, 2));
    this.add('Painéis solares', this.solar(), (s) => (s.up.robots || 0) > 0, new THREE.Vector3(18, 9, 12));
    this.add('Turbina eólica', this.turbine(), (s) => s.prestiges > 0 || s.level >= 12, new THREE.Vector3(64, 0, -46));

    colliders.circles.push(
      { x: 0, z: 5.5, r: 1.7, on: () => this.isShown('Chafariz') },
      { x: 27, z: 26, r: 2.2, on: () => this.isShown('Galinheiro') },
      { x: -50, z: 2, r: 4.5, on: () => this.isShown('Estufa') },
      { x: 64, z: -46, r: 1.2, on: () => this.isShown('Turbina eólica') },
    );
  }

  private isShown(n: string) { return !!this.decos.find((d) => d.name === n)?.shown; }

  private add(name: string, g: THREE.Group, cond: (s: State) => boolean, fx?: THREE.Vector3) {
    g.visible = false;
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.scene.add(g);
    this.decos.push({ name, g, cond, shown: false, anim: 0, fx });
  }

  // -------------------------------------------------------------- modelos
  private scarecrow() {
    const g = new THREE.Group(); g.position.set(38, 0, -10);
    bx(g, 0.12, 2.6, 0.12, 0x7a5532, 0, 1.3, 0);
    bx(g, 1.8, 0.1, 0.1, 0x7a5532, 0, 1.9, 0);
    bx(g, 0.7, 0.8, 0.35, 0x4a7fc2, 0, 1.75, 0);
    bx(g, 0.7, 0.12, 0.38, 0x8a5a30, 0, 1.4, 0);
    for (const x of [-0.6, 0.6]) bx(g, 0.5, 0.25, 0.25, 0xc23b2b, x, 1.9, 0);
    const h = new THREE.Mesh(ico(0.28, 1), mat(0xe9d39a)); h.position.y = 2.45; g.add(h);
    const hat = new THREE.Mesh(cone(0.45, 0.45, 8), mat(0xc9a14a)); hat.position.y = 2.75; g.add(hat);
    const brim = new THREE.Mesh(cyl(0.55, 0.55, 0.05, 10), mat(0xc9a14a)); brim.position.y = 2.6; g.add(brim);
    g.rotation.y = -0.6;
    return g;
  }

  private coop() {
    const g = new THREE.Group(); g.position.set(27, 0, 26);
    bx(g, 3, 1.8, 2.2, 0xd9a35a, 0, 1.3, 0);
    for (const [x, z] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) bx(g, 0.15, 0.6, 0.15, 0x7a5532, x, 0.3, z);
    const roof = new THREE.Mesh(prism(3.4, 1.1, 2.8), mat(0xb3392b)); roof.position.y = 2.2; g.add(roof);
    bx(g, 0.1, 0.8, 0.6, 0x4a2e14, -1.52, 1.0, 0);
    const ramp = bx(g, 0.5, 0.06, 1.3, 0xa77a45, -1.9, 0.35, 0); ramp.rotation.z = -0.6; ramp.rotation.y = Math.PI / 2;
    // galinhas
    for (let i = 0; i < 9; i++) this.makeChicken(i);
    return g;
  }

  private flowerBeds() {
    const g = new THREE.Group();
    const r = rng(41);
    const P: THREE.BufferGeometry[] = [];
    const cols = [0xff6b9a, 0xffd23f, 0xffffff, 0xb48cf0, 0xff8a3d];
    for (let b = 0; b < 2; b++) {
      const x0 = b === 0 ? -21.5 : -16;
      P.push(part(box(3.8, 0.35, 1), 0x8a5a30, [x0 + 1.9, 0.17, 6.6]));
      P.push(part(box(3.6, 0.1, 0.8), 0x4e301b, [x0 + 1.9, 0.36, 6.6]));
      for (let k = 0; k < 16; k++) {
        const x = x0 + 0.2 + r() * 3.4, z = 6.25 + r() * 0.7;
        P.push(part(cyl(0.015, 0.02, 0.4, 3), 0x5f9a3a, [x, 0.55, z]));
        P.push(part(ico(0.1, 0), cols[k % cols.length], [x, 0.78, z]));
      }
    }
    g.add(new THREE.Mesh(merge(P), windMat(0.15)));
    return g;
  }

  private pasture() {
    const g = new THREE.Group();
    const P: THREE.BufferGeometry[] = [];
    const [x1, z1, x2, z2] = [36.5, 0.5, 62.5, 30.5];
    const run = (ax: number, az: number, bx2: number, bz: number) => {
      const len = Math.hypot(bx2 - ax, bz - az), n = Math.round(len / 2.6), ang = Math.atan2(bz - az, bx2 - ax);
      for (let i = 0; i <= n; i++) P.push(part(box(0.16, 1.2, 0.16), 0xe8e2d4, [ax + (bx2 - ax) * (i / n), 0.6, az + (bz - az) * (i / n)]));
      for (const y of [0.5, 0.95]) P.push(part(box(len, 0.1, 0.06), 0xf2efe6, [(ax + bx2) / 2, y, (az + bz) / 2], [0, -ang, 0]));
    };
    run(x1, z1, x2, z1); run(x2, z1, x2, z2); run(x2, z2, x1, z2); run(x1, z2, x1, z1);
    P.push(part(box(3, 0.6, 0.9), 0x8a8f96, [45, 0.3, 4]));
    P.push(part(box(2.8, 0.05, 0.7), 0x4f9fd8, [45, 0.58, 4]));
    for (let i = 0; i < 3; i++) P.push(part(cyl(0.6, 0.6, 1.2, 10), 0xe2c25a, [57 + (i % 2) * 1.3, 0.6, 26 - i * 1.4], [Math.PI / 2, 0, 0]));
    g.add(new THREE.Mesh(merge(P), mat(0xffffff, { vertexColors: true })));
    for (let i = 0; i < 7; i++) this.makeCow(i);
    return g;
  }

  private picnic() {
    const g = new THREE.Group(); g.position.set(-46, 0, 12);
    bx(g, 2.4, 0.1, 1, 0x9a6a3c, 0, 0.8, 0);
    for (const z of [-0.85, 0.85]) bx(g, 2.4, 0.08, 0.35, 0x9a6a3c, 0, 0.45, z);
    for (const x of [-1, 1]) bx(g, 0.1, 0.8, 1.9, 0x7a5532, x, 0.4, 0);
    bx(g, 0.07, 2.6, 0.07, 0xdddddd, 0, 1.3, 0);
    const um = new THREE.Mesh(cone(1.7, 0.7, 8), mat(0xe0473a)); um.position.y = 2.6; g.add(um);
    const um2 = new THREE.Mesh(cone(1.72, 0.7, 8, true), mat(0xf7f1e3)); um2.position.y = 2.59; um2.rotation.y = Math.PI / 8; um2.scale.set(1, 1, 1); g.add(um2);
    const basket = new THREE.Mesh(cyl(0.22, 0.18, 0.25, 8), mat(0xc9a14a)); basket.position.set(0.5, 0.97, 0); g.add(basket);
    return g;
  }

  private hives() {
    const g = new THREE.Group(); g.position.set(-25, 0, 0);
    for (let i = 0; i < 3; i++) {
      const h = new THREE.Group(); h.position.set(i * 1.5 - 1.5, 0, (i % 2) * 0.6);
      bx(h, 0.9, 0.25, 0.9, 0x7a5532, 0, 0.12, 0);
      bx(h, 0.8, 0.35, 0.8, 0xf2e6c8, 0, 0.42, 0);
      bx(h, 0.8, 0.35, 0.8, 0xe8b830, 0, 0.78, 0);
      bx(h, 0.8, 0.35, 0.8, 0xf2e6c8, 0, 1.14, 0);
      bx(h, 1.0, 0.1, 1.0, 0x9a6a3c, 0, 1.37, 0);
      g.add(h);
    }
    return g;
  }

  private orchard() {
    const g = new THREE.Group();
    const r = rng(61);
    const tree = merge([
      part(cyl(0.2, 0.28, 1.8, 6), 0x7a5532, [0, 0.9, 0]),
      part(ico(1.5, 1), 0x4f9a3c, [0, 2.6, 0], [0, 0, 0], [1, 0.85, 1]),
    ]);
    shade(tree, 0.55);
    const apples = merge(Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2, y = 2.2 + (i % 3) * 0.45;
      return part(ico(0.12, 0), 0xe23a3a, [Math.cos(a) * 1.25, y, Math.sin(a) * 1.25]);
    }));
    const tm = windMat(0.006), am = mat(0xffffff, { vertexColors: true });
    for (let i = 0; i < 6; i++) {
      const x = -26 + (i % 3) * 6.5, z = 21.5 + Math.floor(i / 3) * 5.5;
      const t = new THREE.Mesh(tree, tm); t.position.set(x, 0, z); t.rotation.y = r() * 6; g.add(t);
      const a = new THREE.Mesh(apples, am); a.position.copy(t.position); a.rotation.y = t.rotation.y; g.add(a);
      colliders.circles.push({ x, z, r: 0.4, on: () => g.visible });
    }
    return g;
  }

  private bunting() {
    const g = new THREE.Group();
    const cols = [0xe0473a, 0xffd23f, 0x3d8fd6, 0x5fae45, 0xff8fbf];
    for (const z of [-3, 22]) {
      const P: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 14; i++) {
        const t = i / 13; const x = -3.8 + t * 7.6; const y = 3.9 - Math.sin(t * Math.PI) * 0.7;
        P.push(part(cone(0.16, 0.35, 3), cols[i % cols.length], [x, y - 0.18, z], [Math.PI, 0, 0], [1, 1, 0.15]));
      }
      g.add(new THREE.Mesh(merge(P), windMat(0.12, { side: THREE.DoubleSide })));
    }
    return g;
  }

  private fountain() {
    const g = new THREE.Group(); g.position.set(0, 0, 5.5);
    const base = new THREE.Mesh(cyl(1.6, 1.75, 0.6, 14), mat(0xbdb6aa)); base.position.y = 0.3; g.add(base);
    const water = new THREE.Mesh(cyl(1.4, 1.4, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x4fa3d8, roughness: 0.1, metalness: 0.2 })); water.position.y = 0.58; g.add(water);
    const col = new THREE.Mesh(cyl(0.2, 0.3, 1.4, 8), mat(0xcfc8bc)); col.position.y = 1.1; g.add(col);
    const bowl = new THREE.Mesh(cyl(0.7, 0.3, 0.3, 12), mat(0xcfc8bc)); bowl.position.y = 1.8; g.add(bowl);
    return g;
  }

  private greenhouse() {
    const g = new THREE.Group(); g.position.set(-50, 0, 2);
    const glass = new THREE.MeshStandardMaterial({ color: 0xcfeefa, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    bx(g, 8, 0.15, 6, 0x9b9a95, 0, 0.07, 0);
    const walls = new THREE.Mesh(box(8, 3, 6), glass); walls.position.y = 1.6; walls.castShadow = false; g.add(walls);
    const roof = new THREE.Mesh(prism(8, 1.8, 6), glass); roof.position.y = 3.1; g.add(roof);
    for (const x of [-4, -2, 0, 2, 4]) { bx(g, 0.08, 3, 0.08, 0xf2efe6, x, 1.6, -3); bx(g, 0.08, 3, 0.08, 0xf2efe6, x, 1.6, 3); }
    for (const z of [-3, 3]) bx(g, 8, 0.08, 0.08, 0xf2efe6, 0, 3.1, z);
    bx(g, 8, 0.08, 0.08, 0xf2efe6, 0, 4.9, 0);
    for (const z of [-1.6, 1.6]) {
      bx(g, 6.5, 0.6, 1.2, 0x8a5a30, 0, 0.3, z);
      for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(ico(0.25, 0), mat(i % 2 ? 0x9b6fd6 : 0xe23a3a)); p.position.set(-3 + i * 0.75, 0.8, z); g.add(p); }
    }
    return g;
  }

  private solar() {
    const g = new THREE.Group(); g.position.set(18, 6, 12);
    const panel = new THREE.MeshStandardMaterial({ color: 0x1f3a6b, roughness: 0.25, metalness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Group();
      p.position.set(-4.5 + i * 3, 2.15, 2.75);
      p.rotation.x = 0.65;
      bx(p, 2.6, 0.1, 3.4, 0xd8dde3, 0, 0.05, 0);
      bx(p, 2.4, 0.08, 3.2, panel, 0, 0.12, 0);
      p.position.addScaledVector(new THREE.Vector3(0, Math.cos(0.65), Math.sin(0.65)), 0.15);
      g.add(p);
    }
    return g;
  }

  private turbine() {
    const g = new THREE.Group(); g.position.set(64, 0, -46);
    const t = new THREE.Mesh(cyl(0.35, 0.8, 26, 10), mat(0xf2f4f6)); t.position.y = 13; g.add(t);
    bx(g, 1.2, 1.2, 3, 0xf2f4f6, 0, 26.4, 0.4);
    const R = this.turbineRotor; R.position.set(0, 26.4, -1.3);
    const hub = new THREE.Mesh(cone(0.6, 1.2, 10), mat(0xf2f4f6)); hub.rotation.x = -Math.PI / 2; R.add(hub);
    for (let k = 0; k < 3; k++) {
      const arm = new THREE.Group(); arm.rotation.z = (k / 3) * Math.PI * 2;
      const b = bx(arm, 0.8, 11, 0.12, 0xf7f8fa, 0, 5.8, 0); b.scale.x = 0.8;
      arm.add(b); R.add(arm);
    }
    g.add(R);
    return g;
  }

  private makeCow(i: number) {
    const g = new THREE.Group();
    const W = 0xf4f1ea, B = 0x2b2622;
    const body = new THREE.Group(); body.position.y = 1.05; g.add(body);
    bx(body, 0.85, 0.85, 1.7, i % 3 === 2 ? 0x8a5a3a : W, 0, 0, 0);
    if (i % 3 !== 2) { bx(body, 0.87, 0.5, 0.5, B, 0, 0.12, 0.3); bx(body, 0.87, 0.4, 0.4, B, 0, -0.1, -0.45); }
    bx(body, 0.4, 0.2, 0.3, 0xf2a6b4, 0, -0.45, 0.45);
    const head = new THREE.Group(); head.position.set(0, 1.3, -0.95); g.add(head);
    bx(head, 0.5, 0.5, 0.55, i % 3 === 2 ? 0x8a5a3a : W, 0, 0, -0.15);
    bx(head, 0.52, 0.28, 0.25, 0xf2a6b4, 0, -0.1, -0.5);
    for (const x of [-0.3, 0.3]) { bx(head, 0.12, 0.1, 0.2, B, x, 0.22, -0.1); bx(head, 0.2, 0.06, 0.12, B, x * 1.3, 0.12, 0); }
    const legs: THREE.Object3D[] = [];
    for (const [x, z] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) {
      const l = new THREE.Group(); l.position.set(x, 0.75, z);
      bx(l, 0.18, 0.75, 0.18, W, 0, -0.37, 0); bx(l, 0.2, 0.15, 0.2, B, 0, -0.68, 0);
      g.add(l); legs.push(l);
    }
    bx(g, 0.06, 0.7, 0.06, W, 0, 0.95, 0.88);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    const a = PASTURE;
    g.position.set(a[0] + Math.random() * (a[2] - a[0]), 0, a[1] + Math.random() * (a[3] - a[1]));
    g.visible = false;
    this.scene.add(g);
    this.animals.push({ g, legs, head, kind: 'cow', target: g.position.clone(), wait: Math.random() * 3, walk: 0, area: a });
  }

  private makeChicken(i: number) {
    const g = new THREE.Group();
    const c = i % 4 === 3 ? 0x9a5a2a : 0xfaf7f0;
    const body = new THREE.Mesh(ico(0.2, 0), mat(c)); body.scale.set(0.9, 0.85, 1.2); body.position.y = 0.32; g.add(body);
    const tail = new THREE.Mesh(cone(0.1, 0.25, 4), mat(c)); tail.position.set(0, 0.45, 0.22); tail.rotation.x = 0.6; g.add(tail);
    const head = new THREE.Group(); head.position.set(0, 0.5, -0.18); g.add(head);
    const hm = new THREE.Mesh(ico(0.1, 0), mat(c)); head.add(hm);
    const beak = new THREE.Mesh(cone(0.04, 0.1, 4), mat(0xf2a32c)); beak.rotation.x = -Math.PI / 2; beak.position.z = -0.11; head.add(beak);
    bx(head, 0.03, 0.08, 0.1, 0xe0302a, 0, 0.1, 0);
    const legs: THREE.Object3D[] = [];
    for (const x of [-0.07, 0.07]) { const l = new THREE.Group(); l.position.set(x, 0.18, 0); bx(l, 0.03, 0.18, 0.03, 0xf2a32c, 0, -0.09, 0); g.add(l); legs.push(l); }
    const a = COOP_AREA;
    g.position.set(a[0] + Math.random() * (a[2] - a[0]), 0, a[1] + Math.random() * (a[3] - a[1]));
    g.visible = false;
    this.scene.add(g);
    this.animals.push({ g, legs, head, kind: 'chicken', target: g.position.clone(), wait: Math.random() * 2, walk: 0, area: a });
  }

  // -------------------------------------------------------------- atualização
  update(dt: number, time: number, camPos: THREE.Vector3) {
    const s = game.s;
    for (const d of this.decos) {
      const want = d.cond(s);
      if (want && !d.shown) {
        d.shown = true;
        d.g.visible = true;
        if (this.init) {
          d.anim = 0.001;
          if (d.fx) this.fx.spawn(d.fx.x, d.fx.y + 1.5, d.fx.z, 0xfff2a0, 50, 4, 5, 3, 1.6);
          this.onUnlock(d.name);
        }
      } else if (!want && d.shown) { d.shown = false; d.g.visible = false; }
      if (d.anim > 0) {
        d.anim = Math.min(1, d.anim + dt * 1.6);
        const k = d.anim; const e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
        d.g.scale.setScalar(Math.max(0.001, e));
        if (k >= 1) { d.anim = 0; d.g.scale.setScalar(1); }
      }
    }
    this.init = true;

    // animais
    const nChick = s.level >= 2 ? Math.min(9, s.level + 1) : 0;
    const nCow = s.level >= 4 ? Math.min(7, s.level - 2) : 0;
    let ci = 0, wi = 0;
    for (const a of this.animals) {
      const idx = a.kind === 'cow' ? wi++ : ci++;
      a.g.visible = idx < (a.kind === 'cow' ? nCow : nChick);
      if (!a.g.visible) continue;
      if (camPos.distanceToSquared(a.g.position) > 140 * 140) continue;
      const sp = a.kind === 'cow' ? 1.1 : 1.6;
      if (a.wait > 0) {
        a.wait -= dt;
        const graze = a.kind === 'cow' ? 0.5 + Math.sin(time * 1.3 + idx) * 0.1 : (Math.sin(time * 9 + idx * 3) > 0.6 ? 0.9 : 0);
        a.head.rotation.x = THREE.MathUtils.lerp(a.head.rotation.x, graze, dt * 5);
        a.walk *= 0.9;
        if (a.wait <= 0) {
          const ar = a.area;
          a.target.set(ar[0] + Math.random() * (ar[2] - ar[0]), 0, ar[1] + Math.random() * (ar[3] - ar[1]));
        }
      } else {
        const dx = a.target.x - a.g.position.x, dz = a.target.z - a.g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3) { a.wait = (a.kind === 'cow' ? 3 : 1) + Math.random() * 4; }
        else {
          const yaw = Math.atan2(-dx, -dz);
          let dy = yaw - a.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          a.g.rotation.y += dy * Math.min(1, dt * 4);
          a.g.position.x += (dx / d) * sp * dt; a.g.position.z += (dz / d) * sp * dt;
          a.walk += dt * (a.kind === 'cow' ? 6 : 14);
          a.head.rotation.x = THREE.MathUtils.lerp(a.head.rotation.x, 0, dt * 5);
        }
      }
      const sw = Math.sin(a.walk) * (a.wait > 0 ? 0 : 0.5);
      a.legs.forEach((l, k) => { l.rotation.x = k % 2 === (k < 2 ? 0 : 1) ? sw : -sw; });
      if (a.kind === 'chicken' && a.wait <= 0) a.g.position.y = Math.abs(Math.sin(a.walk)) * 0.03;
    }

    // turbina, chafariz, abelhas
    this.turbineRotor.rotation.z += dt * 1.1;
    this.fountainT -= dt;
    if (this.fountainT <= 0 && this.isShown('Chafariz') && camPos.distanceToSquared(new THREE.Vector3(0, 0, 5.5)) < 3600) {
      this.fountainT = 0.06;
      this.fx.spawn(0, 2.1, 5.5, 0x9fd8ff, 2, 0.35, 3.2, 7, 0.9);
    }
    this.beeT -= dt;
    if (this.beeT <= 0 && this.isShown('Apiário')) {
      this.beeT = 0.25;
      this.fx.spawn(-26 + Math.random() * 3, 1.3, Math.random() * 0.6, 0xffc400, 1, 2.5, 0.6, -0.2, 1.6);
    }
  }

  /** Nomes das decorações já desbloqueadas e a próxima. */
  next(): string | null {
    const d = this.decos.find((x) => !x.shown);
    return d ? d.name : null;
  }
}

export const hasRobots = () => lv('robots') > 0;
