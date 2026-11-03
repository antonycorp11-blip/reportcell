import * as THREE from 'three';
import { dotTexture } from './gfx';

const MAX = 1400;

export class FX {
  points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private next = 0;
  private c = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.PointsMaterial({ size: 0.28, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
  }

  spawn(x: number, y: number, z: number, color: number, n: number, spread = 1, up = 3, gravity = 9, life = 0.8) {
    this.c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.next; this.next = (this.next + 1) % MAX;
      this.pos[i * 3] = x + (Math.random() - 0.5) * spread * 0.6;
      this.pos[i * 3 + 1] = y + Math.random() * 0.2;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread * 0.6;
      this.vel[i * 3] = (Math.random() - 0.5) * spread * 2;
      this.vel[i * 3 + 1] = up * (0.5 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * spread * 2;
      const v = 0.85 + Math.random() * 0.3;
      this.col[i * 3] = this.c.r * v; this.col[i * 3 + 1] = this.c.g * v; this.col[i * 3 + 2] = this.c.b * v;
      this.life[i] = life * (0.6 + Math.random() * 0.6);
      this.grav[i] = gravity;
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; }
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}
