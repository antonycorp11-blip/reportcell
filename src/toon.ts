import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Rampa de 3 tons para o cel-shading. */
const grad = (() => {
  const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

export const toon = (opts: THREE.MeshToonMaterialParameters = {}) => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, ...opts });
export const TOON = toon();
export const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1c140c, side: THREE.BackSide });

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
type V3 = [number, number, number];

/** Peça indexada (suave) com cor por vértice. */
export function tp(g: THREE.BufferGeometry, color: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scl: V3 | number = 1): THREE.BufferGeometry {
  let gg = g.clone();
  if (!gg.index) gg = toIndexed(gg);
  for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
  const s = typeof scl === 'number' ? [scl, scl, scl] : scl;
  _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(s[0], s[1], s[2]));
  gg.applyMatrix4(_m);
  const n = gg.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  gg.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return gg;
}

function toIndexed(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count;
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export function tmerge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  g.computeBoundingSphere();
  for (const p of parts) p.dispose();
  return g;
}

/** Casco invertido para o contorno: empurra os vértices ao longo da normal. */
export function hull(g: THREE.BufferGeometry, w = 0.035): THREE.BufferGeometry {
  const o = new THREE.BufferGeometry();
  const pos = (g.attributes.position as THREE.BufferAttribute).clone();
  const nor = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * w, pos.getY(i) + nor.getY(i) * w, pos.getZ(i) + nor.getZ(i) * w);
  o.setAttribute('position', pos);
  o.setIndex(g.index!.clone());
  o.computeBoundingSphere();
  return o;
}

// primitivas suaves
export const sph = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
export const cap = (r: number, len: number, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg);
export const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
export const cone = (r: number, h: number, seg = 10) => new THREE.ConeGeometry(r, h, seg, 1);
export const tor = (r: number, t: number, arc = Math.PI * 2, rs = 6, ts = 16) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const rbox = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d, 1, 1, 1);

/** Calota de esfera voltada para -z (para pintar rostos). */
export function faceCap(r: number, center: V3, wAng = 2.1, hAng = 1.7, scl: V3 = [1, 1, 1], tilt = 0): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r * 1.015, 20, 14, Math.PI * 1.5 - wAng / 2, wAng, Math.PI / 2 - hAng / 2 + tilt, hAng);
  _m.compose(_p.set(...center), _q.identity(), _s.set(...scl));
  g.applyMatrix4(_m);
  return g;
}

const faceCache = new Map<string, THREE.Texture>();
export function faceTex(key: string, draw: (x: CanvasRenderingContext2D, S: number) => void): THREE.Texture {
  let t = faceCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.lineCap = 'round'; x.lineJoin = 'round';
  draw(x, 256);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faceCache.set(key, t);
  return t;
}

// ---------------------------------------------------------------- traços de rosto
export function eye(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, o: { px?: number; py?: number; pr?: number; iris?: string; lid?: number; lidAng?: number; glow?: string; white?: string } = {}) {
  x.save();
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  x.fillStyle = o.white ?? '#fff'; x.fill();
  x.lineWidth = 7; x.strokeStyle = '#1c140c'; x.stroke();
  x.clip();
  const pr = o.pr ?? rx * 0.55;
  const px = cx + (o.px ?? 0) * rx, py = cy + (o.py ?? 0) * ry;
  if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = 18; }
  if (o.iris) { x.fillStyle = o.iris; x.beginPath(); x.arc(px, py, pr * 1.35, 0, Math.PI * 2); x.fill(); }
  x.shadowBlur = 0;
  x.fillStyle = '#120c08'; x.beginPath(); x.arc(px, py, pr * (o.iris ? 0.7 : 1), 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.32, 0, Math.PI * 2); x.fill();
  if (o.lid) {
    x.fillStyle = '#1c140c';
    x.translate(cx, cy); x.rotate(o.lidAng ?? 0);
    x.fillRect(-rx * 1.3, -ry * 1.3, rx * 2.6, ry * 2.6 * o.lid * 0.5);
  }
  x.restore();
}
export function brow(x: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w = 12, col = '#1c140c') {
  x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
}
export function mouth(x: CanvasRenderingContext2D, pts: [number, number][], fill = '#3a0f0f', teeth = 0, tongue = false) {
  x.beginPath();
  pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
  x.closePath();
  x.fillStyle = fill; x.fill();
  x.save(); x.clip();
  if (tongue) { x.fillStyle = '#e0556a'; x.beginPath(); x.ellipse((pts[0][0] + pts[Math.floor(pts.length / 2)][0]) / 2, Math.max(...pts.map((p) => p[1])), 30, 18, 0, 0, Math.PI * 2); x.fill(); }
  if (teeth) {
    const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0])), minY = Math.min(...pts.map((p) => p[1]));
    x.fillStyle = '#fffbe8';
    const n = teeth, w = (maxX - minX) / n;
    for (let i = 0; i < n; i++) { x.beginPath(); x.moveTo(minX + i * w, minY - 2); x.lineTo(minX + (i + 1) * w, minY - 2); x.lineTo(minX + (i + 0.5) * w, minY + w * 0.9); x.fill(); }
  }
  x.restore();
  x.lineWidth = 7; x.strokeStyle = '#1c140c'; x.stroke();
}
export function blush(x: CanvasRenderingContext2D, cx: number, cy: number, col = 'rgba(255,90,90,0.35)') {
  x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, 20, 11, 0, 0, Math.PI * 2); x.fill();
}

/** Aplica "listras" de cor por altura (ex.: grãos do milho). */
export function bands(g: THREE.BufferGeometry, y0: number, y1: number, step: number, k = 0.8) {
  const p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < y0 || y > y1) continue;
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const on = (Math.floor(y / step) + Math.floor(a * 3)) % 2 === 0;
    if (on) c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
}
