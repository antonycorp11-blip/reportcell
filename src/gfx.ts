import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const uTime = { value: 0 };

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

type V3 = [number, number, number];

/** Prepara um pedaço de geometria (não indexada, com cor por vértice e transformação). */
export function part(g: THREE.BufferGeometry, color: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scl: V3 | number = 1): THREE.BufferGeometry {
  const gg = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
  const s = typeof scl === 'number' ? [scl, scl, scl] : scl;
  _m.compose(_p.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(s[0], s[1], s[2]));
  gg.applyMatrix4(_m);
  const n = gg.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  gg.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return gg;
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  g.computeBoundingSphere();
  g.computeBoundingBox();
  for (const p of parts) p.dispose();
  return g;
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cone = (r: number, h: number, seg = 3, open = false) => new THREE.ConeGeometry(r, h, seg, 1, open);
export const cyl = (rt: number, rb: number, h: number, seg = 6, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
export const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);

/** Material com balanço de vento no vertex shader. */
export function windMat(k = 0.08, opts: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float hh = max(position.y, 0.0);
      vec3 wp = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #ifdef USE_INSTANCING
        wp += (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #endif
      float sw = sin(uTime * 1.7 + wp.x * 0.31 + wp.z * 0.23) + 0.45 * sin(uTime * 3.3 + wp.z * 0.71 + wp.x * 0.13);
      transformed.x += sw * ${k.toFixed(4)} * hh * hh;
      transformed.z += cos(uTime * 1.4 + wp.x * 0.27) * ${(k * 0.6).toFixed(4)} * hh * hh;`,
    );
  };
  m.customProgramCacheKey = () => 'wind' + k;
  return m;
}

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: number, opts: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }); matCache.set(key, m); }
  return m;
}
export const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** Cria um mesh de caixa simples posicionado. */
export function bx(parent: THREE.Object3D, w: number, h: number, d: number, color: number | THREE.Material, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(box(w, h, d), typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x: number, z: number) {
  return noise(x, z) * 0.55 + noise(x * 2.1, z * 2.1) * 0.28 + noise(x * 4.3, z * 4.3) * 0.17;
}

/** Altura do terreno: plano na área da fazenda, colinas ao redor. */
export function heightAt(x: number, z: number): number {
  const dx = Math.max(0, Math.abs(x) - 95);
  const dz = Math.max(0, z - 65, -100 - z);
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= 0) return 0;
  const k = Math.min(1, d / 70);
  const sm = k * k * (3 - 2 * k);
  return sm * (6 + fbm(x * 0.012, z * 0.012) * 42 + d * 0.08);
}

export function signTexture(lines: string[], bg = '#f3dfb4', fg = '#4a2e14'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = bg; x.fillRect(0, 0, 256, 128);
  x.fillStyle = 'rgba(120,70,30,0.15)';
  for (let i = 0; i < 4; i++) x.fillRect(0, i * 32 + 30, 256, 2);
  x.strokeStyle = '#7a4a22'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 120);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((l, i) => {
    x.font = `bold ${i === 0 ? 34 : 28}px Fredoka, Arial, sans-serif`;
    x.fillText(l, 128, 64 + (i - (n - 1) / 2) * 38);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Sign extends THREE.Group {
  private board: THREE.Mesh;
  private faceMat: THREE.MeshLambertMaterial;
  private key = '';
  constructor(lines: string[]) {
    super();
    bx(this, 0.16, 1.7, 0.16, 0x6b4425, 0, 0.85, 0);
    this.faceMat = new THREE.MeshLambertMaterial({ map: signTexture(lines) });
    const wood = mat(0x8a5a30);
    this.board = new THREE.Mesh(box(2.2, 1.1, 0.12), [wood, wood, wood, wood, this.faceMat, this.faceMat]);
    this.board.position.y = 1.9;
    this.board.castShadow = true;
    this.add(this.board);
    this.key = lines.join('|');
  }
  setText(lines: string[]) {
    const k = lines.join('|');
    if (k === this.key) return;
    this.key = k;
    this.faceMat.map?.dispose();
    this.faceMat.map = signTexture(lines);
    this.faceMat.needsUpdate = true;
  }
}

let dotTex: THREE.Texture | null = null;
export function dotTexture(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

/** Prisma triangular (telhado) ao longo do eixo X, base em y=0. */
export function prism(w: number, h: number, d: number): THREE.BufferGeometry {
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const A = [x0, 0, z0], B = [x0, 0, z1], C = [x0, h, 0], D = [x1, 0, z0], E = [x1, 0, z1], F = [x1, h, 0];
  const tris = [B, E, F, B, F, C, D, A, C, D, C, F, A, B, C, E, D, F, A, D, E, A, E, B];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}
