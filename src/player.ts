import * as THREE from 'three';
import { bx, mat, cyl, ico } from './gfx';
import { resolve } from './physics';

export class Player {
  pos = new THREE.Vector3(0, 0, 10);
  yaw = 0;
  pitch = -0.32;
  private bob = 0;
  private swing = 0;
  speedNow = 0;
  /** Grupo da ferramenta na mão (renderizado numa cena própria por cima). */
  view = new THREE.Group();
  private holder = new THREE.Group();
  private tools: THREE.Group[] = [];
  private tool = 0;

  constructor(public camera: THREE.PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
    this.view.add(this.holder);
    this.holder.position.set(0.42, -0.42, -0.78);
    this.holder.scale.setScalar(0.72);
    this.tools = [this.hoe(), this.bag(), this.can(), this.sickle(), this.shovel(), this.wand()];
    for (const t of this.tools) { t.visible = false; this.holder.add(t); }
    this.setTool(0);
  }

  private hoe() {
    const g = new THREE.Group();
    const h = bx(g, 0.05, 0.05, 1.1, 0x8a5a30, 0, 0, -0.1); h.castShadow = false;
    bx(g, 0.26, 0.18, 0.03, 0x9aa0a8, 0, -0.08, -0.62);
    g.rotation.set(0.5, 0.15, 0);
    return g;
  }
  private bag() {
    const g = new THREE.Group();
    const s = new THREE.Mesh(ico(0.2, 1), mat(0xd9c08a)); s.scale.set(1, 1.2, 0.9); g.add(s);
    const top = new THREE.Mesh(cyl(0.08, 0.12, 0.1, 6), mat(0xb39a66)); top.position.y = 0.24; g.add(top);
    for (let i = 0; i < 6; i++) { const seed = new THREE.Mesh(ico(0.025, 0), mat(0x7fc25a)); seed.position.set((Math.random() - 0.5) * 0.12, 0.3, (Math.random() - 0.5) * 0.12); g.add(seed); }
    g.position.set(0, 0.05, 0);
    return g;
  }
  private can() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(cyl(0.14, 0.16, 0.3, 10), mat(0x4f9a6a)); g.add(body);
    const sp = new THREE.Mesh(cyl(0.025, 0.04, 0.45, 6), mat(0x4f9a6a)); sp.position.set(0, 0.08, -0.26); sp.rotation.x = -1.0; g.add(sp);
    const rose = new THREE.Mesh(cyl(0.06, 0.03, 0.06, 8), mat(0x3a7a52)); rose.position.set(0, 0.2, -0.45); rose.rotation.x = -1.0; g.add(rose);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 4, 10, Math.PI), mat(0x3a7a52)); hd.position.set(0, 0.15, 0.04); hd.rotation.y = Math.PI / 2; g.add(hd);
    g.rotation.y = 0.3;
    return g;
  }
  private sickle() {
    const g = new THREE.Group();
    bx(g, 0.05, 0.3, 0.05, 0x8a5a30, 0, -0.1, 0);
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 4, 14, Math.PI * 1.1), mat(0xc9ced6)); b.position.set(0.0, 0.18, -0.12); b.rotation.set(0, Math.PI / 2, 0.2); g.add(b);
    g.rotation.set(0.2, 0, -0.3);
    return g;
  }
  private shovel() {
    const g = new THREE.Group();
    bx(g, 0.05, 0.05, 1.0, 0x6b4425, 0, 0, -0.05);
    bx(g, 0.2, 0.05, 0.08, 0x6b4425, 0, 0, 0.45);
    const blade = bx(g, 0.26, 0.03, 0.34, 0x8a9098, 0, 0, -0.68); blade.rotation.x = 0.1;
    bx(g, 0.04, 0.02, 0.3, 0xb53a2a, 0.08, 0.02, -0.68);
    g.rotation.set(0.7, 0.2, -0.3);
    return g;
  }
  private wand() {
    const g = new THREE.Group();
    bx(g, 0.04, 0.5, 0.04, 0x8a5a30, 0, -0.05, 0);
    const gem = new THREE.Mesh(ico(0.09, 0), new THREE.MeshBasicMaterial({ color: 0xffe066 })); gem.position.y = 0.26; g.add(gem);
    g.rotation.set(0.3, 0, -0.2);
    return g;
  }

  setTool(i: number) {
    this.tool = i;
    this.tools.forEach((t, k) => { t.visible = k === i; });
    this.swing = -0.6; // animação de troca
  }
  showTool(v: boolean) { this.holder.visible = v; }

  look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch = Math.max(-1.45, Math.min(1.25, this.pitch - dy));
  }

  private step = 0;
  use(step = 0) { this.swing = 1; this.step = step; }

  /** Troca o modelo da arma na mão. */
  setWeapon(id: string) {
    const g = this.tools[4];
    g.clear();
    const add = (w: number, h: number, d: number, c: number, x: number, y: number, z: number, rx = 0, rz = 0) => { const m = bx(g, w, h, d, c, x, y, z); m.rotation.x = rx; m.rotation.z = rz; m.castShadow = false; return m; };
    if (id === 'axe') {
      add(0.06, 0.06, 1.05, 0x6b4425, 0, 0, -0.05);
      add(0.05, 0.36, 0.3, 0x9aa4ae, 0, 0.12, -0.55); add(0.06, 0.38, 0.06, 0xe8eef2, 0, 0.12, -0.72);
      add(0.07, 0.1, 0.12, 0xb3392b, 0, -0.02, -0.42);
      g.rotation.set(0.6, 0.15, -0.25);
    } else if (id === 'scythe') {
      add(0.05, 0.05, 0.9, 0x4a3a2a, 0, 0, 0);
      for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 4, 14, Math.PI), mat(0xd8dde3)); b.position.set(s * 0.03, 0.15, -0.45 * (s > 0 ? 1 : -0.1)); b.rotation.set(0, Math.PI / 2, s * 0.6); g.add(b); }
      g.rotation.set(0.4, 0, -0.4);
    } else if (id === 'gun') {
      add(0.12, 0.14, 0.5, 0x4a5a3a, 0, 0, -0.15);
      add(0.05, 0.05, 0.55, 0x2a2a2a, 0.03, 0.05, -0.6); add(0.05, 0.05, 0.55, 0x2a2a2a, -0.03, 0.05, -0.6);
      add(0.1, 0.18, 0.28, 0x8a5a30, 0, -0.08, 0.2, 0.3);
      add(0.04, 0.12, 0.04, 0x2a2a2a, 0, -0.1, -0.05);
      add(0.06, 0.06, 0.06, 0x9dff7a, 0, 0.1, -0.2);
      g.rotation.set(0.05, 0.05, 0);
    } else if (id === 'flame') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 10), mat(0xc8241a)); t.rotation.x = Math.PI / 2; t.position.set(0, -0.05, 0); g.add(t);
      add(0.05, 0.05, 0.5, 0x3a3a3a, 0, 0.05, -0.4); add(0.09, 0.09, 0.08, 0xffa02a, 0, 0.05, -0.66);
      add(0.08, 0.06, 0.12, 0x3d8a2a, 0, 0.12, 0.05);
      g.rotation.set(0.05, 0.05, 0);
    } else {
      add(0.05, 0.05, 1.0, 0x6b4425, 0, 0, -0.05); add(0.2, 0.05, 0.08, 0x6b4425, 0, 0, 0.45);
      const b = add(0.26, 0.03, 0.34, 0x8a9098, 0, 0, -0.68); b.rotation.x = 0.1;
      add(0.04, 0.02, 0.3, 0xb53a2a, 0.08, 0.02, -0.68);
      g.rotation.set(0.7, 0.2, -0.3);
    }
    this.weaponId = id;
  }
  private weaponId = 'pa';

  forward(out: THREE.Vector3) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt: number, mx: number, my: number, speed: number) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let vx = fx * my + rx * mx, vz = fz * my + rz * mx;
    const l = Math.hypot(vx, vz);
    if (l > 1) { vx /= l; vz /= l; }
    this.speedNow = Math.min(1, l) * speed;
    this.pos.x += vx * speed * dt;
    this.pos.z += vz * speed * dt;
    resolve(this.pos, 0.4);
    this.bob += dt * this.speedNow * 2.2;
    const by = Math.sin(this.bob * 2) * 0.045 * Math.min(1, this.speedNow / 3);
    this.camera.position.set(this.pos.x, 1.7 + by, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.syncView(dt);
  }

  syncView(dt: number) {
    this.view.position.copy(this.camera.position);
    this.view.quaternion.copy(this.camera.quaternion);
    this.swing += (0 - this.swing) * Math.min(1, dt * 9);
    const sw = this.swing;
    const bx2 = Math.sin(this.bob) * 0.02, by2 = Math.abs(Math.cos(this.bob)) * 0.02;
    this.holder.position.set(0.46 + bx2, -0.44 + by2 - Math.max(0, -sw) * 0.3, -0.78 + Math.max(0, sw) * 0.08);
    if (this.tool === 2) this.holder.rotation.set(0, 0, sw * 0.7);
    else if (this.tool === 1) this.holder.rotation.set(sw * 0.5, 0, sw * 0.5);
    else if (this.tool === 4) {
      const ranged = this.weaponId === 'gun' || this.weaponId === 'flame';
      if (ranged) { this.holder.rotation.set(-Math.max(0, sw) * 0.35, 0, 0); this.holder.position.z += Math.max(0, sw) * 0.18; this.holder.position.x -= 0.2; }
      else if (this.step === 3) this.holder.rotation.set(-0.3 * sw, sw * Math.PI * 2, sw * 0.6);
      else { const dir = this.step === 2 ? -1 : 1; this.holder.rotation.set(-Math.max(0, sw) * 0.6, dir * (sw - 0.5) * 1.6 * (sw > 0.05 ? 1 : 0), dir * sw * 1.2); }
    }
    else this.holder.rotation.set(-Math.max(0, sw) * 1.1, 0, 0);
  }
}
