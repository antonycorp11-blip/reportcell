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
export function injectWind<M extends THREE.Material>(m: M, k: number, key: string): M {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    if (sh.fragmentShader.includes('#include <normal_fragment_begin>')) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  #ifdef DOUBLE_SIDED\n  normal = normalize(vNormal);\n  #endif');
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
  m.customProgramCacheKey = () => key + k;
  return m;
}

/** Rampa de 3 tons (cel-shading) usada em todo o cenário. */
export const GRAD = (() => {
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
type MatOpts = THREE.MeshToonMaterialParameters & { flatShading?: boolean };
const clean = (o: MatOpts) => { const { flatShading, ...r } = o; void flatShading; return r; };

export function windMat(k = 0.08, opts: MatOpts = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD, ...clean(opts) });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
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

const matCache = new Map<string, THREE.MeshToonMaterial>();
export function mat(color: number, opts: MatOpts = {}): THREE.MeshToonMaterial {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...clean(opts) }); matCache.set(key, m); }
  return m;
}
export const vcMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD });

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

/** Escurece a base e clareia o topo (oclusão falsa) usando a altura dos vértices. */
export function shade(g: THREE.BufferGeometry, min = 0.55, h?: number): THREE.BufferGeometry {
  g.computeBoundingBox();
  const top = h ?? g.boundingBox!.max.y;
  const pos = g.attributes.position, col = g.attributes.color;
  if (!col) return g;
  for (let i = 0; i < pos.count; i++) {
    const k = min + (1 - min) * Math.min(1, Math.max(0, pos.getY(i) / top));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  col.needsUpdate = true;
  return g;
}

/** Tufo de folhas de grama (triângulos finos com normais para cima = visual macio). */
export function blades(r: () => number, n: number, spread: number, hMin: number, hMax: number, cols: number[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * 2 * spread, z = (r() - 0.5) * 2 * spread;
    const h = hMin + r() * (hMax - hMin), w = 0.035 + r() * 0.035, a = r() * Math.PI;
    const bend = (r() - 0.5) * 0.35;
    const dx = Math.cos(a) * w, dz = Math.sin(a) * w;
    pos.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x + bend, h, z + bend * 0.5);
    for (let k = 0; k < 3; k++) nor.push(0, 1, 0);
    c.set(cols[i % cols.length]);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r * 1.08, c.g * 1.08, c.b * 1.0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** UV planar a partir de x/z do mundo. */
export function planarUV(g: THREE.BufferGeometry, scale: number) {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / scale; uv[i * 2 + 1] = p.getZ(i) / scale; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Textura procedural de ruído (detalhe para grama/terra). */
export function noiseTexture(kind: 'grass' | 'dirt', size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const img = x.createImageData(size, size);
  const r = rng(kind === 'grass' ? 101 : 202);
  for (let i = 0; i < size * size; i++) {
    const px = i % size, py = (i / size) | 0;
    const n = fbm(px / 18, py / 18);
    let v = kind === 'grass' ? 0.8 + n * 0.25 + (r() - 0.5) * 0.12 : 0.78 + n * 0.28 + (r() - 0.5) * 0.1;
    if (kind === 'dirt' && r() < 0.015) v *= 0.7;
    if (kind === 'grass' && r() < 0.02) v *= 1.12;
    const b = Math.max(0, Math.min(255, v * 255));
    img.data[i * 4] = b; img.data[i * 4 + 1] = b; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // estrias/pedrinhas
  if (kind === 'dirt') {
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(${r() < 0.5 ? '255,250,235' : '60,40,20'},${0.12 + r() * 0.15})`;
      x.beginPath(); x.ellipse(r() * size, r() * size, 1 + r() * 3, 1 + r() * 2.5, r() * 3, 0, Math.PI * 2); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- contornos
export const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x1c140c, side: THREE.BackSide });

/** Adiciona contorno (casco invertido escalado) a todos os meshes sólidos de um objeto. */
export function addOutlines(root: THREE.Object3D, w = 0.045, maxSize = 16) {
  const list: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || m.userData.noOutline || m.userData.isOutline) return;
    const mt = m.material as THREE.Material;
    if (Array.isArray(m.material) || mt.transparent || (mt as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;
    list.push(m);
  });
  for (const m of list) {
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox!;
    const size = bb.getSize(new THREE.Vector3());
    if (Math.max(size.x, size.y, size.z) > maxSize || Math.min(size.x, size.y, size.z) < 0.03) continue;
    const c = bb.getCenter(new THREE.Vector3());
    const o = new THREE.Mesh(g, OUTLINE_MAT);
    const sx = 1 + (2 * w) / Math.max(size.x, 0.05), sy = 1 + (2 * w) / Math.max(size.y, 0.05), sz = 1 + (2 * w) / Math.max(size.z, 0.05);
    o.scale.set(sx, sy, sz);
    o.position.set(c.x * (1 - sx), c.y * (1 - sy), c.z * (1 - sz));
    o.userData.isOutline = true;
    o.raycast = () => { /* */ };
    m.add(o);
  }
}

/** Geometria escalada a partir do centro (contorno para instâncias). */
export function scaledOutline(g: THREE.BufferGeometry, k = 1.06): THREE.BufferGeometry {
  const o = g.clone();
  o.computeBoundingBox();
  const c = o.boundingBox!.getCenter(new THREE.Vector3());
  o.translate(-c.x, -c.y, -c.z); o.scale(k, k, k); o.translate(c.x, c.y, c.z);
  return o;
}
