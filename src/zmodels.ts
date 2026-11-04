import * as THREE from 'three';
import { tp, tmerge, hull, sph, cap, cyl, cone, tor, rbox, faceCap, faceTex, eye, brow, mouth, TOON, OUTLINE } from './toon';

type G = THREE.BufferGeometry;
type V3 = [number, number, number];
export type ZKindM = 'walker' | 'runner' | 'brute' | 'digger' | 'crow' | 'colossus' | 'bloater' | 'spitter' | 'shield' | 'leaper' | 'screamer' | 'mother' | 'crawler';

export interface ZParts {
  root: THREE.Group; body: THREE.Group; torso: THREE.Group; head: THREE.Group;
  arms: THREE.Group[]; legs: THREE.Group[];
  /** Pose de braço em repouso (rad) — cada tipo tem sua postura. */
  reach: number;
  /** Peça removível (escudo). */
  extra?: THREE.Object3D;
}

const K = '#1c140c';
export const faceMats: THREE.MeshBasicMaterial[] = [];
export const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
export const acidMat = new THREE.MeshBasicMaterial({ color: 0x9dff4a });

// ------------------------------------------------------------------ rostos: cada tipo tem expressão própria
type FaceFn = (x: CanvasRenderingContext2D, glow: string) => void;
const W = '#f3f0c8';
const FACES: Record<string, FaceFn> = {
  // olho esbugalhado gigante + olho caído, boca torta pendurada
  walker: (x, g) => {
    x.fillStyle = 'rgba(40,20,40,0.35)'; x.beginPath(); x.ellipse(84, 112, 58, 56, 0, 0, 7); x.fill();
    eye(x, 84, 110, 50, 52, { px: 0.35, py: 0.3, pr: 9, iris: g, glow: g, white: W });
    eye(x, 182, 128, 22, 18, { px: -0.2, pr: 6, iris: g, glow: g, white: W, lid: 0.6, lidAng: 0.3 });
    brow(x, 150, 96, 214, 112, 9);
    mouth(x, [[70, 178], [150, 168], [196, 186], [168, 226], [110, 236], [80, 214]], '#2a0a0a', 4, true);
    x.strokeStyle = K; x.lineWidth = 4; x.beginPath(); x.moveTo(200, 150); x.lineTo(240, 190); x.stroke();
    for (let i = 0; i < 4; i++) { const t = i / 3, px = 200 + 40 * t, py = 150 + 40 * t; x.beginPath(); x.moveTo(px - 7, py + 7); x.lineTo(px + 7, py - 7); x.stroke(); }
  },
  // grito: olhinhos pequenos, bocão aberto
  runner: (x, g) => {
    eye(x, 84, 96, 20, 24, { pr: 5, iris: g, glow: g, white: W });
    eye(x, 172, 96, 20, 24, { pr: 5, iris: g, glow: g, white: W });
    brow(x, 56, 58, 110, 76, 10); brow(x, 200, 58, 146, 76, 10);
    mouth(x, [[60, 140], [196, 140], [184, 222], [128, 248], [72, 222]], '#1a0505', 7, true);
  },
  // olhinhos bravos sob monocelha, queixo com presas
  brute: (x, g) => {
    eye(x, 96, 112, 18, 14, { pr: 6, iris: g, glow: g, white: W });
    eye(x, 160, 112, 18, 14, { pr: 6, iris: g, glow: g, white: W });
    x.fillStyle = K; x.beginPath(); x.moveTo(56, 84); x.lineTo(128, 104); x.lineTo(200, 84); x.lineTo(200, 96); x.lineTo(128, 114); x.lineTo(56, 96); x.fill();
    mouth(x, [[64, 176], [192, 176], [180, 214], [76, 214]], '#2a0a0a');
    x.fillStyle = '#fffbe8';
    for (const px of [78, 170]) { x.beginPath(); x.moveTo(px, 214); x.lineTo(px + 10, 214); x.lineTo(px + 5, 160); x.fill(); x.strokeStyle = K; x.lineWidth = 4; x.stroke(); }
  },
  // olhos semicerrados, dentuço sorridente
  digger: (x, g) => {
    eye(x, 88, 120, 28, 26, { px: 0.2, pr: 7, iris: g, glow: g, white: W, lid: 0.7 });
    eye(x, 168, 120, 28, 26, { px: 0.2, pr: 7, iris: g, glow: g, white: W, lid: 0.7 });
    mouth(x, [[70, 170], [128, 190], [186, 170], [168, 208], [88, 208]], '#2a0a0a');
    x.fillStyle = '#fffbe8'; x.fillRect(110, 176, 16, 24); x.fillRect(130, 176, 16, 24); x.strokeStyle = K; x.lineWidth = 4; x.strokeRect(110, 176, 16, 24); x.strokeRect(130, 176, 16, 24);
  },
  // três olhos verdes, boca serrilhada
  colossus: (x, g) => {
    eye(x, 72, 122, 24, 26, { pr: 7, iris: g, glow: g, white: '#1a2a10' });
    eye(x, 128, 92, 30, 32, { pr: 9, iris: g, glow: g, white: '#1a2a10' });
    eye(x, 184, 122, 24, 26, { pr: 7, iris: g, glow: g, white: '#1a2a10' });
    mouth(x, [[56, 170], [200, 170], [184, 224], [72, 224]], '#1a0505', 9);
  },
  // sonolento, bochechas estufadas, babando
  bloater: (x, g) => {
    eye(x, 90, 112, 24, 22, { py: 0.3, pr: 6, iris: g, glow: g, white: W, lid: 1.0 });
    eye(x, 166, 112, 24, 22, { py: 0.3, pr: 6, iris: g, glow: g, white: W, lid: 1.0 });
    x.fillStyle = 'rgba(160,220,60,0.5)'; x.beginPath(); x.ellipse(60, 160, 30, 22, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(196, 160, 30, 22, 0, 0, 7); x.fill();
    mouth(x, [[104, 176], [152, 176], [146, 200], [110, 200]], '#2a0a0a');
    x.fillStyle = '#b8ff5a'; x.beginPath(); x.ellipse(140, 218, 7, 16, 0, 0, 7); x.fill();
  },
  // boca em biquinho ("ó"), bochecha de sapo
  spitter: (x, g) => {
    eye(x, 80, 100, 30, 34, { px: 0.3, pr: 8, iris: g, glow: g, white: W });
    eye(x, 176, 100, 30, 34, { px: -0.3, pr: 8, iris: g, glow: g, white: W });
    brow(x, 48, 58, 108, 70, 10); brow(x, 208, 58, 148, 70, 10);
    x.fillStyle = '#2a0a0a'; x.beginPath(); x.ellipse(128, 186, 24, 28, 0, 0, 7); x.fill();
    x.lineWidth = 9; x.strokeStyle = '#6a9a4a'; x.stroke(); x.lineWidth = 5; x.strokeStyle = K; x.stroke();
    x.fillStyle = '#9dff4a'; x.beginPath(); x.arc(128, 192, 10, 0, 7); x.fill();
  },
  // olhos de fenda furiosos, dentes cerrados
  shield: (x, g) => {
    eye(x, 88, 128, 30, 14, { pr: 6, iris: g, glow: g, white: W });
    eye(x, 168, 128, 30, 14, { pr: 6, iris: g, glow: g, white: W });
    brow(x, 50, 96, 120, 120, 12); brow(x, 206, 96, 136, 120, 12);
    x.fillStyle = '#fffbe8'; x.fillRect(80, 176, 96, 30); x.strokeStyle = K; x.lineWidth = 6; x.strokeRect(80, 176, 96, 30);
    x.lineWidth = 3; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(80 + i * 16, 176); x.lineTo(80 + i * 16, 206); x.stroke(); } x.beginPath(); x.moveTo(80, 191); x.lineTo(176, 191); x.stroke();
  },
  // olhos de sapo bem separados, sorrisão fino
  leaper: (x, g) => {
    eye(x, 52, 92, 34, 38, { px: -0.2, py: -0.1, pr: 8, iris: g, glow: g, white: W });
    eye(x, 204, 92, 34, 38, { px: 0.2, py: -0.1, pr: 8, iris: g, glow: g, white: W });
    x.strokeStyle = K; x.lineWidth = 8; x.beginPath(); x.moveTo(36, 160); x.quadraticCurveTo(128, 236, 220, 160); x.stroke();
    x.fillStyle = '#fffbe8'; for (const px of [92, 164]) { x.beginPath(); x.moveTo(px - 8, 186); x.lineTo(px + 8, 186); x.lineTo(px, 206); x.fill(); }
  },
  // órbitas vazias brilhando, boca vertical enorme
  screamer: (x, g) => {
    for (const cx of [86, 170]) { x.fillStyle = '#120808'; x.beginPath(); x.ellipse(cx, 92, 28, 36, 0, 0, 7); x.fill(); x.shadowColor = g; x.shadowBlur = 16; x.fillStyle = g; x.beginPath(); x.arc(cx, 96, 7, 0, 7); x.fill(); x.shadowBlur = 0; }
    mouth(x, [[96, 140], [160, 140], [176, 200], [150, 252], [106, 252], [80, 200]], '#0a0202', 0, true);
    x.strokeStyle = K; x.lineWidth = 4; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(84 + i * 22, 136); x.lineTo(90 + i * 22, 150); x.stroke(); }
  },
  // quatro olhos tristes, boca caída
  mother: (x, g) => {
    for (const [cx, cy, r] of [[70, 110, 22], [186, 110, 22], [110, 76, 16], [148, 76, 16]] as const) eye(x, cx, cy, r, r, { py: 0.3, pr: 6, iris: g, glow: g, white: W });
    brow(x, 44, 80, 92, 72, 8); brow(x, 212, 80, 164, 72, 8);
    mouth(x, [[76, 196], [128, 172], [180, 196], [168, 214], [88, 214]], '#2a0a0a', 6);
  },
  // olho único enorme
  crawler: (x, g) => {
    eye(x, 128, 110, 56, 54, { py: 0.1, pr: 12, iris: g, glow: g, white: W });
    mouth(x, [[86, 186], [170, 186], [156, 214], [100, 214]], '#2a0a0a', 6);
  },
  crow: (x) => {
    eye(x, 70, 128, 30, 32, { px: 0.3, pr: 9, iris: '#ff3a2a', glow: '#ff3a2a', white: W });
    eye(x, 186, 128, 30, 32, { px: -0.3, pr: 9, iris: '#ff3a2a', glow: '#ff3a2a', white: W });
    brow(x, 36, 92, 100, 108, 12); brow(x, 220, 92, 156, 108, 12);
  },
};
const zFace = (kind: string) => faceTex('z2-' + kind, (x) => FACES[kind](x, kind === 'colossus' || kind === 'spitter' || kind === 'bloater' ? '#9dff4a' : '#ffb02a'));

interface Model {
  torso: G; head: G; arm: G; armR?: G; leg: G; face: G; tex: THREE.Texture; glow?: G; acid?: G; extra?: G;
  scale: number; hipY: number; shoulder: V3; neck: V3; legX: number; lean: number; reach: number; headTilt: number;
}
const cache = new Map<string, Model>();

/** Braço pendurado a partir do ombro (pivô na origem). */
function arm(len: number, r: number, hand: number, sleeve: number, skin: number, sleeveLen = 0.45, claws = 3): G[] {
  const A: G[] = [];
  const up = len * sleeveLen, lo = len - up;
  A.push(tp(cap(r, up, 8), sleeve, [0, -up / 2, 0]));
  A.push(tp(cap(r * 0.8, lo, 8), skin, [0, -up - lo / 2, -0.03], [0.2, 0, 0]));
  A.push(tp(sph(hand, 10, 8), skin, [0, -len - hand * 0.4, -0.06], [0, 0, 0], [1, 0.8, 1.1]));
  for (let i = 0; i < claws; i++) A.push(tp(cone(hand * 0.22, hand * 0.8, 5), 0xe8e0c8, [(i - (claws - 1) / 2) * hand * 0.55, -len - hand * 1.15, -0.1], [Math.PI - 0.3, 0, 0]));
  return A;
}
/** Perna com pivô no quadril. */
function leg(len: number, r: number, pants: number, shoe: number, shoeK = 1): G[] {
  return [
    tp(cap(r, len * 0.8, 8), pants, [0, -len * 0.45, 0]),
    tp(sph(r * 1.3, 10, 8), shoe, [0, -len + r * 0.2, -r * 0.5], [0, 0, 0], [1, 0.65, 1.5 * shoeK]),
  ];
}
/** Cabeça base (centro em y = r*0.9). */
function headBase(H: G[], r: number, skin: number, sclY = 1.04, ears = true) {
  H.push(tp(sph(r, 16, 12), skin, [0, r * 0.9, 0], [0, 0, 0], [1, sclY, 0.96]));
  if (ears) for (const sx of [-1, 1]) H.push(tp(sph(r * 0.22, 8, 6), skin, [sx * r * 0.98, r * 0.9, 0.02], [0, 0, 0], [0.5, 1, 1]));
}
const hair = (H: G[], r: number, col: number, n = 5, spread = 0.07) => { for (let i = 0; i < n; i++) H.push(tp(cap(0.03, 0.1, 4), col, [(i - (n - 1) / 2) * spread, r * 1.8, 0.08], [-0.5, 0, (i - (n - 1) / 2) * 0.35])); };

function build(kind: ZKindM): Model {
  const c = cache.get(kind);
  if (c) return c;
  const T: G[] = [], H: G[] = [];
  let A: G[] = [], L: G[] = [], AR: G[] | null = null;
  let glow: G | undefined, acid: G | undefined, extra: G | undefined;
  let scale = 1, hipY = 0.72, shoulder: V3 = [0.3, 0.5, 0], neck: V3 = [0, 0.66, -0.04], legX = 0.12, lean = 0.25, reach = 1.4, headTilt = 0.15;
  let headR = 0.32, fw = 2.15, fh = 1.75;
  switch (kind) {
    case 'walker': { // magrelo alto, braços compridos arrastando, cabeça pendendo
      const skin = 0xa3bf86, shirt = 0x4e7fb0;
      hipY = 0.92; lean = 0.42; reach = 0.55; headTilt = 0.45; neck = [0, 0.78, -0.06]; shoulder = [0.24, 0.66, 0];
      T.push(tp(cap(0.18, 0.5, 12), shirt, [0, 0.36, 0], [0, 0, 0], [1.15, 1, 0.75]));
      T.push(tp(cone(0.26, 0.22, 10), shirt, [0, 0.06, 0], [Math.PI, 0, 0], [1, 1, 0.75])); // camisa rasgada
      T.push(tp(cap(0.04, 0.24, 6), skin, [0, 0.72, 0])); // pescoço fino
      T.push(tp(sph(0.06, 6, 4), 0x8a2a2a, [0.08, 0.3, -0.13])); // ferida
      headR = 0.3; headBase(H, headR, skin, 1.1);
      hair(H, headR, 0x4a3a2a, 3, 0.1);
      A = arm(0.95, 0.065, 0.11, shirt, skin, 0.3);
      L = leg(0.92, 0.075, 0x3e5f8a, 0x4a3222);
      break;
    }
    case 'runner': { // baixinho curvado gritando, capuz
      const skin = 0xb8c98a, shirt = 0xd8452a;
      scale = 0.9; hipY = 0.62; lean = 0.85; reach = 1.9; headTilt = -0.5; neck = [0, 0.6, -0.12];
      T.push(tp(cap(0.21, 0.3, 12), shirt, [0, 0.28, 0], [0, 0, 0], [1, 1, 0.85]));
      T.push(tp(sph(0.25, 12, 8), shirt, [0, 0.6, 0.12], [0, 0, 0], [1, 0.8, 0.9])); // capuz caído
      for (const sx of [-1, 1]) T.push(tp(cap(0.015, 0.2, 4), 0xf2f2f2, [sx * 0.06, 0.4, -0.2]));
      headR = 0.3; headBase(H, headR, skin);
      H.push(tp(sph(headR * 1.12, 14, 10), shirt, [0, headR * 1.0, 0.1], [0, 0, 0], [1, 1, 1]));
      fh = 1.95;
      A = arm(0.6, 0.06, 0.09, shirt, skin, 0.5, 4);
      L = leg(0.62, 0.075, 0x5a5a62, 0xf2f2f2, 1.2);
      break;
    }
    case 'brute': { // torso gigante, cabeça minúscula, perninhas, punhos enormes
      const skin = 0x7fa85a;
      scale = 1.5; hipY = 0.5; lean = 0.3; reach = 0.7; headTilt = 0; neck = [0, 0.88, -0.2]; shoulder = [0.5, 0.7, 0]; legX = 0.2;
      T.push(tp(sph(0.5, 16, 12), skin, [0, 0.45, -0.02], [0, 0, 0], [1.15, 1, 0.9]));
      T.push(tp(cap(0.42, 0.12, 14), 0x5a7aa0, [0, 0.2, 0], [0, 0, 0], [1.05, 1, 0.95])); // macacão
      for (const sx of [-1, 1]) T.push(tp(rbox(0.08, 0.5, 0.04), 0x5a7aa0, [sx * 0.2, 0.62, -0.44], [0.3, 0, 0]));
      T.push(tp(sph(0.06, 6, 4), 0xd8b45a, [0.2, 0.42, -0.46])); T.push(tp(sph(0.06, 6, 4), 0xd8b45a, [-0.2, 0.42, -0.46]));
      headR = 0.2; headBase(H, headR, skin, 0.9, false);
      for (let i = 0; i < 4; i++) H.push(tp(cap(0.012, 0.05, 4), K_, [-0.08 + i * 0.05, headR * 1.75, -0.05], [0, 0, 1.57]));
      A = arm(0.62, 0.15, 0.26, skin, skin, 0.5, 4);
      L = leg(0.5, 0.11, 0x5a7aa0, 0x3a2a1a);
      break;
    }
    case 'digger': { // mineiro curvado com picareta
      const skin = 0x9ab070, shirt = 0x7a5a3a;
      lean = 0.55; reach = 1.1; neck = [0, 0.64, -0.08];
      T.push(tp(cap(0.25, 0.28, 14), shirt, [0, 0.28, 0], [0, 0, 0], [1, 1, 0.85]));
      T.push(tp(cyl(0.27, 0.27, 0.08, 14), 0x3a2a1a, [0, 0.08, 0]));
      T.push(tp(sph(0.24, 10, 8), 0x8a6a3a, [0, 0.42, 0.22], [0, 0, 0], [1, 1.1, 0.7])); // mochila
      headR = 0.3; headBase(H, headR, skin);
      H.push(tp(sph(headR * 1.12, 14, 8), 0xf2c230, [0, headR * 1.05, 0.02], [0, 0, 0], [1, 0.75, 1]));
      H.push(tp(cyl(headR * 1.3, headR * 1.3, 0.03, 16), 0xf2c230, [0, headR * 1.05, 0.02]));
      glow = tmerge([tp(cyl(0.07, 0.07, 0.06, 10), 0xfff6a0, [0, headR * 1.45, -headR * 0.95], [Math.PI / 2 - 0.3, 0, 0])]);
      A = arm(0.62, 0.075, 0.1, shirt, skin, 0.45);
      AR = [...arm(0.62, 0.075, 0.1, shirt, skin, 0.45), tp(cap(0.03, 0.8, 6), 0x6b4425, [0, -0.7, -0.1], [Math.PI / 2, 0, 0]), tp(cone(0.05, 0.5, 6), 0x9aa4ae, [0, -0.85, -0.5], [0, 0, Math.PI / 2], [1, 1, 1]), tp(cone(0.05, 0.5, 6), 0x9aa4ae, [0, -0.55, -0.5], [0, 0, 0])];
      L = leg(0.72, 0.09, 0x5a4a32, 0x3a2a1a);
      break;
    }
    case 'colossus': { // montanha com ossos e veias brilhantes
      const skin = 0x6f8a4a;
      scale = 2.6; hipY = 0.62; lean = 0.35; reach = 0.6; headTilt = 0; neck = [0, 0.98, -0.22]; shoulder = [0.58, 0.78, 0]; legX = 0.24;
      T.push(tp(sph(0.58, 16, 12), skin, [0, 0.5, 0], [0, 0, 0], [1.15, 1, 0.95]));
      T.push(tp(sph(0.24, 10, 8), skin, [0.5, 0.86, 0], [0, 0, 0], [1, 0.8, 1])); T.push(tp(sph(0.24, 10, 8), skin, [-0.5, 0.86, 0]));
      for (let i = 0; i < 6; i++) T.push(tp(cone(0.07, 0.34, 8), 0xe8e0c8, [(i - 2.5) * 0.15, 0.95 - Math.abs(i - 2.5) * 0.06, 0.42], [-0.7, 0, 0]));
      T.push(tp(cap(0.36, 0.12, 14), 0x4a2a3a, [0, 0.12, 0], [0, 0, 0], [1.2, 1, 1]));
      glow = tmerge([tp(cap(0.03, 0.5, 4), 0, [0.25, 0.5, -0.52], [0, 0, 0.5]), tp(cap(0.03, 0.36, 4), 0, [-0.2, 0.6, -0.52], [0, 0, -0.4]), tp(cap(0.03, 0.3, 4), 0, [0.05, 0.3, -0.55], [0, 0, 1.2])]);
      headR = 0.24; headBase(H, headR, skin, 0.95, false);
      for (let i = 0; i < 3; i++) H.push(tp(cone(0.05, 0.2, 6), 0xe8e0c8, [(i - 1) * 0.1, headR * 1.85, 0], [0, 0, (i - 1) * -0.4]));
      A = arm(0.72, 0.17, 0.28, skin, skin, 0.5, 4);
      L = leg(0.62, 0.15, 0x3a2a2a, 0x2a1a12);
      break;
    }
    case 'bloater': { // barrigão verde com bolhas brilhando, cabecinha
      const skin = 0xa8c25a;
      scale = 1.15; hipY = 0.42; lean = -0.1; reach = 0.9; headTilt = 0.2; neck = [0, 0.98, 0]; shoulder = [0.5, 0.62, 0]; legX = 0.2;
      T.push(tp(sph(0.6, 18, 14), skin, [0, 0.5, -0.04], [0, 0, 0], [1, 0.95, 1]));
      T.push(tp(tor(0.44, 0.05, Math.PI * 2, 6, 20), 0x6a4a8a, [0, 0.36, -0.04], [Math.PI / 2, 0, 0], [1.25, 1.25, 1])); // camiseta curta
      for (const [x, y, z] of [[0.3, 0.6, -0.48], [-0.25, 0.75, -0.46], [0.1, 0.3, -0.56], [-0.4, 0.4, -0.38], [0.48, 0.35, -0.3]] as V3[]) T.push(tp(sph(0.05, 6, 4), 0x6a4a8a, [x, y, z], [0, 0, 0], [1.6, 1.6, 0.6]));
      acid = tmerge([[0.3, 0.6, -0.5], [-0.25, 0.75, -0.48], [0.1, 0.3, -0.58], [-0.4, 0.4, -0.4], [0.48, 0.35, -0.32], [0, 0.92, -0.3]].map(([x, y, z]) => tp(sph(0.07, 8, 6), 0, [x, y, z])));
      headR = 0.2; headBase(H, headR, skin, 1, false);
      fw = 2.3;
      A = arm(0.32, 0.07, 0.1, skin, skin, 0.5, 3);
      L = leg(0.42, 0.11, 0x4a3a5a, 0x3a2a1a);
      break;
    }
    case 'spitter': { // pescoço longo, papo de ácido brilhando
      const skin = 0x8ab89a, shirt = 0x8a7a4a;
      hipY = 0.82; lean = 0.2; reach = 1.0; headTilt = -0.25; neck = [0, 1.02, -0.2]; shoulder = [0.22, 0.52, 0];
      T.push(tp(cap(0.17, 0.4, 12), shirt, [0, 0.3, 0], [0, 0, 0], [1.1, 1, 0.8]));
      T.push(tp(cap(0.07, 0.42, 8), skin, [0, 0.78, -0.1], [-0.4, 0, 0]));
      acid = tmerge([tp(sph(0.16, 12, 8), 0, [0, 0.74, -0.2], [0, 0, 0], [1, 0.9, 1])]);
      headR = 0.3; headBase(H, headR, skin, 0.92);
      for (const sx of [-1, 1]) H.push(tp(sph(0.12, 10, 8), skin, [sx * 0.2, headR * 0.6, -0.12])); // bochechas
      hair(H, headR, 0x2a3a2a, 3, 0.12);
      A = arm(0.7, 0.06, 0.09, shirt, skin, 0.4);
      L = leg(0.82, 0.075, 0x4a4a3a, 0x3a2a1a);
      break;
    }
    case 'shield': { // balde na cabeça + porta de carro como escudo
      const skin = 0xa0b080, shirt = 0x8a4a3a;
      scale = 1.1; lean = 0.15; reach = 1.25; neck = [0, 0.66, -0.04]; shoulder = [0.34, 0.5, 0];
      T.push(tp(cap(0.27, 0.28, 14), shirt, [0, 0.28, 0], [0, 0, 0], [1.1, 1, 0.85]));
      for (const sx of [-1, 1]) T.push(tp(sph(0.14, 10, 8), 0x8a8f96, [sx * 0.34, 0.56, 0], [0, 0, 0], [1.1, 0.7, 1])); // ombreiras de panela
      headR = 0.3; headBase(H, headR, skin);
      H.push(tp(cyl(headR * 1.05, headR * 1.2, headR * 1.3, 14), 0x8a8f96, [0, headR * 1.45, 0]));
      H.push(tp(tor(headR * 1.2, 0.025, Math.PI * 2, 4, 16), 0x5a5f66, [0, headR * 0.82, 0], [Math.PI / 2, 0, 0]));
      fh = 1.2;
      A = arm(0.6, 0.085, 0.12, shirt, skin, 0.5);
      extra = tmerge([tp(rbox(0.9, 1.1, 0.07), 0x9aa4b0, [0, 0, 0]), tp(rbox(0.66, 0.36, 0.08), 0x6ad0ff, [0, 0.26, -0.005]), tp(rbox(0.9, 0.06, 0.09), 0x5a5f66, [0, -0.1, 0]), tp(rbox(0.14, 0.05, 0.1), 0x3a3a3a, [0.25, -0.22, -0.02])]);
      L = leg(0.72, 0.1, 0x3a3a44, 0x2a2a2a);
      break;
    }
    case 'leaper': { // agachado como sapo, pernas dobradas enormes
      const skin = 0x7ab0a0, shirt = 0x3a5a8a;
      hipY = 0.5; lean = 0.95; reach = 1.7; headTilt = -0.7; neck = [0, 0.5, -0.12]; shoulder = [0.24, 0.42, 0]; legX = 0.24;
      T.push(tp(cap(0.2, 0.26, 12), shirt, [0, 0.24, 0], [0, 0, 0], [1.2, 1, 0.9]));
      headR = 0.3; headBase(H, headR, skin, 0.85, false);
      for (const sx of [-1, 1]) H.push(tp(sph(0.14, 10, 8), skin, [sx * 0.22, headR * 1.45, -0.08])); // calombos dos olhos
      fw = 2.6; fh = 1.6;
      A = arm(0.82, 0.06, 0.1, skin, skin, 0.4, 3);
      L = [tp(cap(0.1, 0.38, 8), 0x2a3a5a, [0, -0.1, -0.2], [1.3, 0, 0]), tp(cap(0.08, 0.4, 8), skin, [0, -0.32, 0.05], [-0.6, 0, 0]), tp(sph(0.13, 10, 8), skin, [0, -0.48, -0.08], [0, 0, 0], [1.2, 0.5, 1.8])];
      break;
    }
    case 'screamer': { // alto e esquelético, cabelo longo, bocão vertical
      const skin = 0xc8c8b0, dress = 0x5a3a6a;
      scale = 1.05; hipY = 1.0; lean = -0.05; reach = 2.6; headTilt = -0.35; neck = [0, 0.84, 0]; shoulder = [0.22, 0.72, 0];
      T.push(tp(cap(0.15, 0.6, 10), dress, [0, 0.4, 0], [0, 0, 0], [1.1, 1, 0.8]));
      T.push(tp(cone(0.36, 0.7, 10), dress, [0, -0.15, 0], [Math.PI, 0, 0])); // vestido rasgado
      headR = 0.3; headBase(H, headR, skin, 1.2, false);
      for (let i = 0; i < 9; i++) { const a = -1.2 + (i / 8) * 2.4; H.push(tp(cap(0.04, 0.6, 4), 0x2a2a30, [Math.sin(a) * headR * 0.95, headR * 0.8, Math.cos(a) * headR * 0.75 + 0.06], [0.1, 0, -a * 0.25])); }
      H.push(tp(sph(headR * 1.04, 12, 8), 0x2a2a30, [0, headR * 1.15, 0.06], [0, 0, 0], [1, 0.8, 1]));
      fh = 2.0; fw = 1.9;
      A = arm(0.82, 0.05, 0.09, skin, skin, 0.3, 4);
      L = leg(1.0, 0.06, skin, 0x2a2a30);
      break;
    }
    case 'mother': { // grandona com bolsa de ovos brilhando nas costas
      const skin = 0x9a8aa8, dress = 0x6a4a3a;
      scale = 1.45; hipY = 0.62; lean = 0.5; reach = 1.0; neck = [0, 0.82, -0.14]; shoulder = [0.42, 0.62, 0]; legX = 0.18;
      T.push(tp(sph(0.42, 14, 10), dress, [0, 0.38, 0], [0, 0, 0], [1.1, 1.1, 0.9]));
      T.push(tp(sph(0.42, 14, 10), 0x7a6a5a, [0, 0.62, 0.38], [0, 0, 0], [1, 0.9, 0.8])); // saco
      acid = tmerge([[0.18, 0.78, 0.66], [-0.16, 0.6, 0.7], [0.05, 0.42, 0.66], [-0.24, 0.86, 0.56], [0.28, 0.5, 0.6]].map(([x, y, z]) => tp(sph(0.11, 8, 6), 0, [x, y, z])));
      headR = 0.28; headBase(H, headR, skin, 1);
      H.push(tp(sph(headR * 1.1, 12, 8), 0xd85a8a, [0, headR * 1.3, 0.12], [0, 0, 0], [1, 0.6, 1])); // lenço
      A = arm(0.62, 0.1, 0.14, dress, skin, 0.4);
      L = leg(0.62, 0.11, 0x4a3a2a, 0x2a1a12);
      break;
    }
    case 'crawler': { // sem pernas, rasteja com os braços
      const skin = 0xb0a080;
      scale = 0.75; hipY = 0.22; lean = 1.35; reach = 2.4; headTilt = -1.2; neck = [0, 0.48, -0.06]; shoulder = [0.2, 0.4, 0];
      T.push(tp(cap(0.18, 0.28, 10), skin, [0, 0.24, 0], [0, 0, 0], [1, 1, 0.8]));
      T.push(tp(cone(0.18, 0.3, 8), 0x6a5a4a, [0, -0.05, 0], [Math.PI, 0, 0]));
      headR = 0.28; headBase(H, headR, skin, 1, false);
      A = arm(0.55, 0.06, 0.1, skin, skin, 0.5, 3);
      L = [tp(sph(0.01, 4, 3), 0)];
      break;
    }
    default: break;
  }
  const face = faceCap(headR, [0, headR * 0.9, 0], fw, fh, [1, 1.04, 0.96]);
  const m: Model = { torso: tmerge(T), head: tmerge(H), arm: tmerge(A), armR: AR ? tmerge(AR) : undefined, leg: tmerge(L), face, tex: zFace(kind), glow, acid, extra, scale, hipY, shoulder, neck, legX, lean, reach, headTilt };
  cache.set(kind, m);
  return m;
}
const K_ = 0x1c140c;

function crowBuild(): Model {
  const c = cache.get('crow');
  if (c) return c;
  const B: G[] = [], H: G[] = [], Wg: G[] = [];
  B.push(tp(sph(0.28, 14, 10), 0x2a2433, [0, 0, 0], [0, 0, 0], [0.85, 0.8, 1.3]));
  B.push(tp(cone(0.18, 0.4, 8), 0x2a2433, [0, 0.02, 0.45], [-Math.PI / 2 - 0.2, 0, 0], [1, 1, 0.4]));
  for (let i = 0; i < 3; i++) B.push(tp(cap(0.02, 0.12, 4), 0xe8e0c8, [(i - 1) * 0.06, 0.18, 0.05]));
  H.push(tp(sph(0.2, 14, 10), 0x332a3d, [0, 0.12, 0]));
  H.push(tp(cone(0.07, 0.28, 8), 0x8a8a5a, [0, 0.07, -0.28], [-Math.PI / 2, 0, 0]));
  Wg.push(tp(sph(0.3, 10, 6), 0x2a2433, [0.32, 0, 0], [0, 0, 0], [1.2, 0.12, 0.6]));
  for (let i = 0; i < 4; i++) Wg.push(tp(cap(0.03, 0.14, 4), 0x3a3245, [0.25 + i * 0.12, 0, 0.22], [Math.PI / 2, 0, 0]));
  Wg.push(tp(cap(0.015, 0.4, 4), 0xe8e0c8, [0.35, 0.02, -0.05], [0, 0, Math.PI / 2]));
  const head = tmerge(H); head.translate(0, 0, -0.32);
  const face = faceCap(0.2, [0, 0.12, 0], 2.2, 1.2); face.translate(0, 0, -0.32);
  const m: Model = { torso: tmerge(B), head, arm: tmerge(Wg), leg: tmerge([tp(sph(0.01, 4, 3), 0)]), face, tex: zFace('crow'), scale: 1, hipY: 3.4, shoulder: [0.12, 0.05, 0], neck: [0, 0.1, 0], legX: 0, lean: 0, reach: 0, headTilt: 0 };
  cache.set('crow', m);
  return m;
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
  const d = kind === 'crow' ? crowBuild() : build(kind);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  body.scale.setScalar(d.scale);
  const torso = new THREE.Group(); torso.position.y = d.hipY; body.add(torso);
  torso.add(mesh(d.torso, outline));
  const head = new THREE.Group(); head.position.set(...d.neck); torso.add(head);
  head.add(mesh(d.head, outline));
  let fm = faceMatCache.get(d.tex);
  if (!fm) { fm = new THREE.MeshBasicMaterial({ map: d.tex, transparent: true, alphaTest: 0.3, depthWrite: false }); faceMatCache.set(d.tex, fm); faceMats.push(fm); }
  head.add(new THREE.Mesh(d.face, fm));
  head.rotation.z = d.headTilt * 0.3;
  head.userData.tilt = d.headTilt;
  if (d.glow) torso.add(new THREE.Mesh(d.glow, kind === 'colossus' ? acidMat : glowMat));
  if (d.acid) torso.add(new THREE.Mesh(d.acid, acidMat));
  const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
  let extra: THREE.Object3D | undefined;
  for (const sx of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(sx * d.shoulder[0], d.shoulder[1], d.shoulder[2]);
    const am = mesh(sx > 0 && d.armR ? d.armR : d.arm, outline);
    if (kind === 'crow') am.scale.x = sx;
    a.add(am); torso.add(a); arms.push(a);
    if (kind !== 'crow' && kind !== 'crawler') {
      const l = new THREE.Group(); l.position.set(sx * d.legX, d.hipY, 0);
      l.add(mesh(d.leg, outline)); body.add(l); legs.push(l);
    }
  }
  if (d.extra) {
    extra = mesh(d.extra, outline, 0.03);
    extra.position.set(-0.12, 0.3, -0.52);
    torso.add(extra);
  }
  torso.rotation.x = d.lean;
  return { root, body, torso, head, arms, legs, reach: d.reach, extra };
}

void cone; void cyl;
