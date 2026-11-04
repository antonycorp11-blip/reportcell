import * as THREE from 'three';
import { tp, tmerge, hull, sph, cap, cyl, cone, tor, faceCap, faceTex, eye, brow, mouth, bands, TOON, OUTLINE } from './toon';

type G = THREE.BufferGeometry;
export type ZKindM = 'walker' | 'runner' | 'brute' | 'digger' | 'crow' | 'colossus';

export interface ZParts {
  root: THREE.Group; body: THREE.Group; torso: THREE.Group; head: THREE.Group;
  arms: THREE.Group[]; legs: THREE.Group[];
}

const K = '#1c140c';
export const faceMats: THREE.MeshBasicMaterial[] = [];
export const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });

function zFace(key: string, glow: string, v: number) {
  return faceTex('z-' + key, (x) => {
    // olheiras
    x.fillStyle = 'rgba(40,20,40,0.35)';
    x.beginPath(); x.ellipse(88, 118, 46, 44, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(170, 122, 40, 38, 0, 0, Math.PI * 2); x.fill();
    eye(x, 88, 114, 36, 38, { px: v ? 0.3 : -0.2, py: 0.2, pr: 8, iris: glow, glow, white: '#f3f0c8' });
    eye(x, 170, 120, 26, 24, { px: 0.1, py: -0.1, pr: 7, iris: glow, glow, white: '#f3f0c8', lid: 0.35, lidAng: -0.2 });
    brow(x, 50, 74, 120, 64, 9, '#2a2a1a');
    // boca aberta com dentes tortos
    mouth(x, [[78, 172], [178, 168], [168, 210], [128, 222], [90, 210]], '#2a0a0a', 7);
    // pontos de costura
    x.strokeStyle = K; x.lineWidth = 4;
    x.beginPath(); x.moveTo(196, 150); x.lineTo(236, 186); x.stroke();
    for (let i = 0; i < 4; i++) { const t = i / 3; const px = 196 + 40 * t, py = 150 + 36 * t; x.beginPath(); x.moveTo(px - 7, py + 7); x.lineTo(px + 7, py - 7); x.stroke(); }
  });
}

function crowFace() {
  return faceTex('z-crow', (x) => {
    eye(x, 70, 128, 30, 32, { px: 0.3, pr: 9, iris: '#ff3a2a', glow: '#ff3a2a', white: '#f3f0c8' });
    eye(x, 186, 128, 30, 32, { px: -0.3, pr: 9, iris: '#ff3a2a', glow: '#ff3a2a', white: '#f3f0c8' });
    brow(x, 36, 92, 100, 108, 12); brow(x, 220, 92, 156, 108, 12);
  });
}

const cache = new Map<string, { torso: G; head: G; arm: G; leg: G; face: G; tex: THREE.Texture; glow?: G; scale: number; hipY: number; shoulder: [number, number, number]; neck: number; legX: number }>();

function build(kind: ZKindM, v: number) {
  const key = kind + v;
  const c = cache.get(key);
  if (c) return c;
  const skin = kind === 'brute' ? 0x8db56a : kind === 'colossus' ? 0x7a9a5a : v ? 0x9cc47a : 0xa3bf86;
  const T: G[] = [], H: G[] = [], A: G[] = [], L: G[] = [];
  let scale = 1, hipY = 0.72, shoulder: [number, number, number] = [0.3, 0.5, 0], neck = 0.66, legX = 0.12;
  let glow: G | undefined;
  let headR = 0.32;
  const shirt = { walker: v ? 0xb8483a : 0x4e7fb0, runner: v ? 0xd8452a : 0x3a9a6a, brute: 0xd8d2bf, digger: 0x7a5a3a, crow: 0, colossus: 0x5a3a4a }[kind];
  const pants = { walker: 0x3e5f8a, runner: 0x5a5a62, brute: 0x3a3a44, digger: 0x5a4a32, crow: 0, colossus: 0x3a2a2a }[kind];
  // pernas (coxa+canela+sapato)
  L.push(tp(cap(0.1, 0.38, 10), pants, [0, -0.3, 0]));
  L.push(tp(sph(0.12, 10, 8), kind === 'runner' ? 0xf2f2f2 : 0x4a3222, [0, -0.66, -0.06], [0, 0, 0], [1, 0.6, 1.5]));
  if (kind === 'walker') { T.push(tp(cap(0.26, 0.3, 14), shirt, [0, 0.28, 0], [0, 0, 0], [1, 1, 0.82])); bands(T[0], -0.2, 0.8, 0.1, 0.78); T.push(tp(sph(0.24, 12, 8), 0x3e5f8a, [0, 0.12, -0.08], [0, 0, 0], [1, 0.9, 0.7])); for (const sx of [-1, 1]) T.push(tp(cap(0.03, 0.4, 6), 0x3e5f8a, [sx * 0.12, 0.42, -0.14], [0.15, 0, 0])); }
  if (kind === 'runner') { scale = 0.95; T.push(tp(cap(0.22, 0.32, 14), shirt, [0, 0.28, 0], [0, 0, 0], [1, 1, 0.8])); T.push(tp(sph(0.24, 12, 8), shirt, [0, 0.62, 0.12], [0, 0, 0], [1, 0.8, 0.9])); for (const sx of [-1, 1]) T.push(tp(cap(0.015, 0.2, 4), 0xf2f2f2, [sx * 0.06, 0.4, -0.2])); }
  if (kind === 'brute') { scale = 1.5; T.push(tp(sph(0.42, 16, 12), skin, [0, 0.25, -0.05], [0, 0, 0], [1, 1, 0.95])); T.push(tp(cap(0.36, 0.25, 14), shirt, [0, 0.4, 0.02])); headR = 0.26; shoulder = [0.42, 0.55, 0]; neck = 0.78; legX = 0.17; }
  if (kind === 'digger') { T.push(tp(cap(0.25, 0.3, 14), shirt, [0, 0.28, 0], [0, 0, 0], [1, 1, 0.82])); T.push(tp(cyl(0.27, 0.27, 0.08, 14), 0x3a2a1a, [0, 0.08, 0])); }
  if (kind === 'colossus') { scale = 2.6; T.push(tp(sph(0.48, 16, 12), shirt, [0, 0.32, 0.04], [0, 0, 0], [1.1, 1.05, 0.9])); for (let i = 0; i < 5; i++) T.push(tp(cone(0.07, 0.3, 8), 0xe8e0c8, [(i - 2) * 0.14, 0.62 - Math.abs(i - 2) * 0.05, 0.38], [-0.6, 0, 0])); headR = 0.24; shoulder = [0.5, 0.6, 0]; neck = 0.86; legX = 0.2; glow = tmerge([tp(cap(0.025, 0.4, 4), 0x9dff4a, [0.2, 0.3, -0.42], [0, 0, 0.5]), tp(cap(0.025, 0.3, 4), 0x9dff4a, [-0.18, 0.4, -0.42], [0, 0, -0.4])]); }
  // braço (manga + antebraço + mão), pivô no ombro, pendurado para baixo
  const sleeve = kind === 'brute' || kind === 'colossus' ? skin : shirt;
  const armR = kind === 'brute' ? 0.12 : kind === 'colossus' ? 0.13 : 0.08;
  A.push(tp(cap(armR, 0.22, 8), sleeve, [0, -0.18, 0]));
  A.push(tp(cap(armR * 0.85, 0.24, 8), skin, [0, -0.48, -0.04], [0.25, 0, 0]));
  A.push(tp(sph(armR * 1.25, 10, 8), skin, [0, -0.68, -0.1]));
  for (let i = 0; i < 3; i++) A.push(tp(cap(0.022, 0.06, 4), skin, [(i - 1) * 0.04, -0.78, -0.14], [0.4, 0, 0]));
  // cabeça (centro acima do pescoço)
  H.push(tp(sph(headR, 16, 12), skin, [0, headR * 0.9, 0], [0, 0, 0], [1, 1.04, 0.96]));
  for (const sx of [-1, 1]) H.push(tp(sph(headR * 0.22, 8, 6), skin, [sx * headR * 0.98, headR * 0.9, 0.02], [0, 0, 0], [0.5, 1, 1]));
  if (kind === 'walker' && v === 0) { H.push(tp(cyl(0.5, 0.52, 0.04, 16), 0xd8b45a, [0, headR * 1.62, 0])); H.push(tp(cyl(0.25, 0.3, 0.2, 14), 0xd8b45a, [0, headR * 1.78, 0])); H.push(tp(cyl(0.305, 0.305, 0.05, 14), 0x8a3a2a, [0, headR * 1.7, 0])); }
  if (kind === 'walker' && v === 1) { for (let i = 0; i < 5; i++) H.push(tp(sph(0.08, 8, 6), 0xf2a0b0, [(i - 2) * 0.07, headR * 1.72, 0.05 + (i % 2) * 0.04])); }
  if (kind === 'runner') { H.push(tp(sph(headR * 1.12, 14, 10), shirt, [0, headR * 0.98, 0.07], [0, 0, 0], [1, 1, 1])); }
  if (kind === 'brute') { for (let i = 0; i < 4; i++) H.push(tp(cap(0.012, 0.05, 4), 0x1c140c, [-0.08 + i * 0.05, headR * 1.85, -0.05], [0, 0, 1.57])); }
  if (kind === 'digger') { H.push(tp(sph(headR * 1.12, 14, 8), 0xf2c230, [0, headR * 1.05, 0.02], [0, 0, 0], [1, 0.75, 1])); H.push(tp(cyl(headR * 1.25, headR * 1.25, 0.03, 16), 0xf2c230, [0, headR * 1.05, 0.02])); glow = tmerge([tp(cyl(0.07, 0.07, 0.06, 10), 0xfff6a0, [0, headR * 1.45, -headR * 0.95], [Math.PI / 2 - 0.3, 0, 0])]); }
  if (kind === 'colossus') { for (let i = 0; i < 3; i++) H.push(tp(cone(0.05, 0.18, 6), 0xe8e0c8, [(i - 1) * 0.1, headR * 1.85, 0], [0, 0, (i - 1) * -0.4])); }
  // cabelo ralo
  if (kind === 'walker' || kind === 'digger') for (let i = 0; i < 4; i++) H.push(tp(cap(0.03, 0.08, 4), 0x4a3a2a, [(i - 1.5) * 0.07, headR * 1.8, 0.1], [-0.5, 0, (i - 1.5) * 0.3]));
  const face = faceCap(headR, [0, headR * 0.9, 0], 2.15, 1.75, [1, 1.04, 0.96]);
  const g = {
    torso: tmerge(T), head: tmerge(H), arm: tmerge(A), leg: tmerge(L), face, tex: zFace(kind + (kind === 'walker' ? v : 0), kind === 'colossus' ? '#9dff4a' : '#ffb02a', v), glow,
    scale, hipY, shoulder, neck, legX,
  };
  cache.set(key, g);
  return g;
}

function crowBuild() {
  const key = 'crow';
  const c = cache.get(key);
  if (c) return c;
  const B: G[] = [], H: G[] = [], W: G[] = [];
  B.push(tp(sph(0.28, 14, 10), 0x2a2433, [0, 0, 0], [0, 0, 0], [0.85, 0.8, 1.3]));
  B.push(tp(cone(0.18, 0.4, 8), 0x2a2433, [0, 0.02, 0.45], [-Math.PI / 2 - 0.2, 0, 0], [1, 1, 0.4]));
  for (let i = 0; i < 3; i++) B.push(tp(cap(0.02, 0.12, 4), 0xe8e0c8, [(i - 1) * 0.06, 0.18, 0.05], [0, 0, 0]));
  H.push(tp(sph(0.2, 14, 10), 0x332a3d, [0, 0.12, 0]));
  H.push(tp(cone(0.07, 0.28, 8), 0x8a8a5a, [0, 0.07, -0.28], [-Math.PI / 2, 0, 0]));
  W.push(tp(sph(0.3, 10, 6), 0x2a2433, [0.32, 0, 0], [0, 0, 0], [1.2, 0.12, 0.6]));
  for (let i = 0; i < 4; i++) W.push(tp(cap(0.03, 0.14, 4), 0x3a3245, [0.25 + i * 0.12, 0, 0.22], [Math.PI / 2, 0, 0]));
  W.push(tp(cap(0.015, 0.4, 4), 0xe8e0c8, [0.35, 0.02, -0.05], [0, 0, Math.PI / 2]));
  const g = { torso: tmerge(B), head: tmerge(H), arm: tmerge(W), leg: tmerge([tp(sph(0.01, 4, 3), 0, [0, 0, 0])]), face: faceCap(0.2, [0, 0.12, 0], 2.2, 1.2), tex: crowFace(), glow: undefined, scale: 1, hipY: 3.4, shoulder: [0.12, 0.05, 0] as [number, number, number], neck: 0.1, legX: 0 };
  g.head.translate(0, 0, -0.32);
  g.face.translate(0, 0, -0.32);
  cache.set(key, g);
  return g;
}

const hulls = new WeakMap<G, G>();
const hullOf = (g: G, w: number) => { let h = hulls.get(g); if (!h) { h = hull(g, w); hulls.set(g, h); } return h; };
const faceMatCache = new Map<THREE.Texture, THREE.MeshBasicMaterial>();

function mesh(g: G, outline: boolean, w = 0.022): THREE.Object3D {
  const m = new THREE.Mesh(g, TOON);
  m.castShadow = true;
  if (!outline) return m;
  const grp = new THREE.Group();
  grp.add(m, new THREE.Mesh(hullOf(g, w), OUTLINE));
  return grp;
}

export function buildZombie(kind: ZKindM, outline: boolean): ZParts {
  const v = Math.random() < 0.5 ? 0 : 1;
  const d = kind === 'crow' ? crowBuild() : build(kind, v);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  body.scale.setScalar(d.scale);
  const torso = new THREE.Group(); torso.position.y = d.hipY; body.add(torso);
  torso.add(mesh(d.torso, outline));
  const head = new THREE.Group(); head.position.set(0, d.neck, kind === 'crow' ? 0 : -0.04); torso.add(head);
  head.add(mesh(d.head, outline));
  let fm = faceMatCache.get(d.tex);
  if (!fm) { fm = new THREE.MeshBasicMaterial({ map: d.tex, transparent: true, alphaTest: 0.3, depthWrite: false }); faceMatCache.set(d.tex, fm); faceMats.push(fm); }
  head.add(new THREE.Mesh(d.face, fm));
  if (d.glow) { const gm = new THREE.Mesh(d.glow, glowMat); (kind === 'colossus' ? torso : head).add(gm); }
  const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(sx * d.shoulder[0], d.shoulder[1], d.shoulder[2]);
    const am = mesh(d.arm, outline);
    if (kind === 'crow') am.scale.x = sx;
    a.add(am); torso.add(a); arms.push(a);
    if (kind !== 'crow') {
      const l = new THREE.Group(); l.position.set(sx * d.legX, d.hipY, 0);
      l.add(mesh(d.leg, outline)); body.add(l); legs.push(l);
    }
  }
  if (kind === 'crow') torso.rotation.x = 0;
  else torso.rotation.x = kind === 'runner' ? 0.45 : 0.25;
  return { root, body, torso, head, arms, legs };
}
