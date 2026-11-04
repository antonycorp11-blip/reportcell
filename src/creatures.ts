import * as THREE from 'three';
import { T, N, owned, live, tileY, tileX, tileZ, markDirty } from './farm';
import { rng } from './gfx';
import { CROPS } from './data';
import { toon } from './toon';
import { tp, tmerge, hull, sph, cap, cyl, cone, tor, faceCap, faceTex, eye, brow, mouth, blush, bands, TOON, OUTLINE } from './toon';
import type { FX } from './fx';

type G = THREE.BufferGeometry;
type V3 = [number, number, number];
interface Model { body: G; head: G; pivot: V3; face: G; tex: THREE.Texture; glow?: G; top: number }

const K = '#1c140c';

// ---------------------------------------------------------------- rostos
const faces = {
  wheat: () => faceTex('wheat', (x) => {
    eye(x, 88, 118, 34, 40, { px: 0.15, py: 0.15, pr: 15, iris: '#5a8a2a' });
    eye(x, 168, 118, 34, 40, { px: -0.15, py: 0.15, pr: 15, iris: '#5a8a2a' });
    brow(x, 52, 70, 118, 92); brow(x, 204, 70, 138, 92);
    mouth(x, [[86, 176], [170, 176], [150, 200], [106, 200]], '#4a1212', 6);
  }),
  corn: () => faceTex('corn', (x) => {
    eye(x, 90, 120, 30, 34, { px: 0.1, py: 0.1, pr: 13, iris: '#3f7ad8' });
    eye(x, 166, 124, 30, 26, { px: -0.1, py: 0.1, pr: 12, iris: '#3f7ad8', lid: 0.6 });
    brow(x, 56, 82, 116, 96); brow(x, 198, 86, 142, 98);
    blush(x, 64, 168); blush(x, 192, 168);
  }),
  sun: () => faceTex('sun', (x) => {
    // óculos de laser
    x.fillStyle = '#18202a'; x.strokeStyle = K; x.lineWidth = 7;
    x.beginPath(); x.roundRect(40, 92, 78, 50, 18); x.fill(); x.stroke();
    x.beginPath(); x.roundRect(138, 92, 78, 50, 18); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(118, 112); x.lineTo(138, 112); x.stroke();
    x.shadowColor = '#fff27a'; x.shadowBlur = 16; x.fillStyle = '#ffe94a';
    x.fillRect(52, 108, 54, 10); x.fillRect(150, 108, 54, 10);
    x.shadowBlur = 0;
    mouth(x, [[90, 172], [168, 168], [156, 190], [104, 192]], '#5a1a0a', 0, true);
  }),
  pumpkin: () => faceTex('pumpkin', (x) => {
    x.shadowColor = '#ffcf3a'; x.shadowBlur = 22;
    x.fillStyle = '#ffd23a';
    x.beginPath(); x.moveTo(56, 128); x.lineTo(96, 70); x.lineTo(116, 130); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(200, 128); x.lineTo(160, 70); x.lineTo(140, 130); x.closePath(); x.fill();
    x.fillStyle = '#ffb02a';
    x.beginPath(); x.moveTo(46, 160);
    const pts: [number, number][] = [[70, 170], [82, 190], [100, 172], [118, 196], [138, 172], [156, 196], [174, 172], [190, 190], [210, 160], [180, 218], [128, 232], [76, 218]];
    for (const [a, b] of pts) x.lineTo(a, b);
    x.closePath(); x.fill();
    x.fillStyle = '#ffec8a'; x.beginPath(); x.moveTo(118, 148); x.lineTo(128, 132); x.lineTo(138, 148); x.closePath(); x.fill();
  }),
  berry: () => faceTex('berry', (x) => {
    eye(x, 92, 118, 32, 38, { px: 0.25, py: 0.1, pr: 14, iris: '#2a9a3a', lid: 0.55, lidAng: 0.15 });
    eye(x, 166, 118, 32, 38, { px: 0.25, py: 0.1, pr: 14, iris: '#2a9a3a', lid: 0.55, lidAng: -0.15 });
    brow(x, 60, 72, 118, 82, 10); brow(x, 196, 72, 140, 82, 10);
    mouth(x, [[96, 172], [164, 166], [150, 188], [110, 190]], '#5a0f1a', 0, true);
    x.fillStyle = '#7fe35a'; x.beginPath(); x.ellipse(146, 196, 12, 16, 0, 0, Math.PI * 2); x.fill(); x.lineWidth = 5; x.strokeStyle = K; x.stroke();
  }),
  lav: () => faceTex('lav', (x) => {
    x.strokeStyle = K; x.lineWidth = 9;
    x.beginPath(); x.arc(92, 118, 26, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    x.beginPath(); x.arc(164, 118, 26, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    blush(x, 70, 158, 'rgba(255,120,200,0.45)'); blush(x, 186, 158, 'rgba(255,120,200,0.45)');
    x.fillStyle = '#4a1a4a'; x.beginPath(); x.ellipse(128, 178, 12, 14, 0, 0, Math.PI * 2); x.fill(); x.lineWidth = 6; x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.fillText('z', 196, 70); x.font = 'bold 24px sans-serif'; x.fillText('z', 222, 44);
  }),
  cactus: () => faceTex('cactus', (x) => {
    eye(x, 90, 124, 28, 30, { px: 0, py: 0.25, pr: 13, lid: 0.7, lidAng: 0.25 });
    eye(x, 166, 124, 28, 30, { px: 0, py: 0.25, pr: 13, lid: 0.7, lidAng: -0.25 });
    brow(x, 56, 90, 120, 104, 14); brow(x, 200, 90, 136, 104, 14);
    mouth(x, [[94, 188], [162, 188], [152, 172], [104, 172]], '#3a1010', 5);
    // curativo
    x.save(); x.translate(186, 70); x.rotate(0.5); x.fillStyle = '#f3e3c3'; x.fillRect(-28, -10, 56, 20); x.strokeStyle = K; x.lineWidth = 4; x.strokeRect(-28, -10, 56, 20); x.restore();
  }),
  pepper: () => faceTex('pepper', (x) => {
    eye(x, 88, 112, 30, 32, { px: 0.2, py: 0.2, pr: 14, iris: '#ff8a1a', glow: '#ffb02a' });
    eye(x, 168, 112, 30, 32, { px: -0.2, py: 0.2, pr: 14, iris: '#ff8a1a', glow: '#ffb02a' });
    brow(x, 50, 68, 116, 92, 14); brow(x, 206, 68, 140, 92, 14);
    mouth(x, [[84, 170], [172, 170], [158, 206], [98, 206]], '#3a0808', 7);
    x.shadowColor = '#ffb02a'; x.shadowBlur = 18; x.fillStyle = '#ff7a1a';
    x.beginPath(); x.ellipse(128, 196, 26, 8, 0, 0, Math.PI * 2); x.fill();
  }),
};

/** Posição dos olhos/boca de cada rosto (para piscar e cara de ataque). */
const FSPOT: Record<string, { eyes: [number, number, number][]; my: number; iris: string }> = {
  wheat: { eyes: [[88, 118, 40], [168, 118, 40]], my: 188, iris: '#5a8a2a' },
  corn: { eyes: [[90, 120, 36], [166, 124, 36]], my: 184, iris: '#3f7ad8' },
  sun: { eyes: [], my: 180, iris: '#ffe94a' },
  pumpkin: { eyes: [], my: 200, iris: '#ffd23a' },
  berry: { eyes: [[92, 118, 40], [166, 118, 40]], my: 180, iris: '#2a9a3a' },
  lav: { eyes: [[92, 118, 34], [164, 118, 34]], my: 178, iris: '#9a5ad8' },
  cactus: { eyes: [[90, 124, 32], [166, 124, 32]], my: 182, iris: '#3a7a2a' },
  pepper: { eyes: [[88, 112, 34], [168, 112, 34]], my: 190, iris: '#ff8a1a' },
};
/** Variações do rosto: 1 = piscando, 2 = atacando (bravo, boca aberta). */
function moodTex(kind: keyof typeof faces, mood: 1 | 2): THREE.Texture {
  const base = faces[kind]().image as HTMLCanvasElement;
  const sp = FSPOT[kind];
  return faceTex(kind + '-m' + mood, (x) => {
    x.drawImage(base, 0, 0);
    if (mood === 1) {
      for (const [cx, cy, r] of sp.eyes) {
        x.clearRect(cx - r - 6, cy - r - 4, (r + 6) * 2, r * 2 + 8);
        x.strokeStyle = K; x.lineWidth = 9; x.beginPath(); x.arc(cx, cy - 6, r * 0.75, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
      }
      return;
    }
    if (kind === 'sun') {
      x.shadowColor = '#fff27a'; x.shadowBlur = 30; x.fillStyle = '#ffffff';
      x.fillRect(48, 102, 62, 22); x.fillRect(146, 102, 62, 22); x.shadowBlur = 0;
    } else if (kind === 'pumpkin') {
      x.shadowColor = '#ff7a1a'; x.shadowBlur = 30; x.globalCompositeOperation = 'lighter'; x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-over'; x.shadowBlur = 0;
      return;
    } else {
      for (const [cx, cy, r] of sp.eyes) x.clearRect(cx - r - 6, cy - r - 30, (r + 6) * 2, r * 2 + 34);
      sp.eyes.forEach(([cx, cy, r], i) => {
        const sgn = i === 0 ? 1 : -1;
        eye(x, cx, cy + 4, r * 0.8, r * 0.85, { px: 0, py: 0.1, pr: r * 0.32, iris: sp.iris, glow: sp.iris, lid: 0.55, lidAng: sgn * 0.45 });
        brow(x, cx - sgn * r * 0.95, cy - r * 0.9, cx + sgn * r * 0.75, cy - r * 0.35, 15);
      });
    }
    // boca gritando
    x.clearRect(70, sp.my - 30, 116, 64);
    mouth(x, [[78, sp.my - 18], [178, sp.my - 18], [166, sp.my + 22], [128, sp.my + 32], [90, sp.my + 22]], '#3a0808', 6, true);
  });
}

// ---------------------------------------------------------------- modelos
function legs(P: G[], col: number, y = 0.0, spread = 0.12) {
  for (const sx of [-1, 1]) {
    P.push(tp(cap(0.06, 0.16, 8), col, [sx * spread, y + 0.14, 0], [0, 0, sx * 0.25]));
    P.push(tp(sph(0.085, 10, 6), col, [sx * (spread + 0.04), y + 0.03, -0.05], [0, 0, 0], [1, 0.6, 1.4]));
  }
}

function wheat(): Model {
  const B: G[] = [], H: G[] = [];
  B.push(tp(cap(0.17, 0.42), 0x9bbf4a, [0, 0.62, 0], [0, 0, 0], [1, 1, 0.85]));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; B.push(tp(sph(0.14, 10, 8), 0x6fa83a, [Math.cos(a) * 0.17, 0.32, Math.sin(a) * 0.17], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], [0.7, 1.3, 0.35])); }
  legs(B, 0x5f8f2a);
  for (const sx of [-1, 1]) {
    B.push(tp(cap(0.06, 0.32, 8), 0x8ab43e, [sx * 0.3, 0.78, -0.06], [0.3, 0, sx * 1.05]));
    B.push(tp(sph(0.08, 10, 8), 0x8ab43e, [sx * 0.47, 0.9, -0.14]));
    B.push(tp(cap(0.03, 0.22, 6), 0x7a4a22, [sx * 0.48, 0.98, -0.16]));
    B.push(tp(tor(0.3, 0.045, 2.3, 6, 18), 0xdfe6ee, [sx * 0.52, 1.18, -0.22], [0, Math.PI / 2, sx > 0 ? 0.6 : 2.5], [1, 1, 1.6]));
  }
  H.push(tp(sph(0.32, 16, 12), 0xf2c94c, [0, 0.3, 0], [0, 0, 0], [1, 1.08, 0.95]));
  for (let i = 0; i < 8; i++) {
    const a = -1.1 + (i / 7) * 2.2;
    H.push(tp(cap(0.07, 0.3, 8), i % 2 ? 0xffe08a : 0xf5cd5a, [Math.sin(a) * 0.2, 0.62, 0.08 + Math.abs(a) * 0.05], [-0.45, 0, -a * 0.7]));
  }
  for (const sx of [-1, 1]) H.push(tp(sph(0.06, 8, 6), 0xe0b23a, [sx * 0.31, 0.3, 0.02]));
  return { body: tmerge(B), head: tmerge(H), pivot: [0, 0.95, 0], face: faceCap(0.32, [0, 0.3, 0], 2.1, 1.7, [1, 1.08, 0.95]), tex: faces.wheat(), top: 1.75 };
}

function corn(): Model {
  const B: G[] = [], H: G[] = [];
  for (let i = 0; i < 5; i++) { const a = Math.PI * 0.3 + (i / 4) * Math.PI * 1.4; B.push(tp(sph(0.2, 10, 8), i % 2 ? 0x6fb04a : 0x86c25a, [Math.cos(a) * 0.22, 0.45, Math.sin(a) * 0.22], [Math.sin(a) * -0.35, 0, Math.cos(a) * 0.35], [0.75, 2.2, 0.3])); }
  legs(B, 0x5f9a3a);
  const cob = tp(cap(0.28, 0.62, 14), 0xf5c842, [0, 0.55, 0]);
  bands(cob, 0.05, 1.0, 0.085, 0.82);
  H.push(cob);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; H.push(tp(cap(0.03, 0.28, 6), 0xd8b26a, [Math.cos(a) * 0.08, 1.05, Math.sin(a) * 0.08], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6])); }
  H.push(tp(cyl(0.12, 0.14, 0.36, 14), 0x4f6b2a, [0, 0.36, -0.3], [Math.PI / 2, 0, 0]));
  H.push(tp(tor(0.13, 0.04, Math.PI * 2, 6, 14), 0x3a4a1e, [0, 0.36, -0.48]));
  H.push(tp(cyl(0.09, 0.09, 0.02, 12), 0x120c08, [0, 0.36, -0.49], [Math.PI / 2, 0, 0]));
  return { body: tmerge(B), head: tmerge(H), pivot: [0, 0.32, 0], face: faceCap(0.285, [0, 0.72, 0], 1.9, 1.3), tex: faces.corn(), top: 1.65 };
}

function sun(): Model {
  const B: G[] = [], H: G[] = [];
  B.push(tp(cap(0.075, 0.95, 8), 0x4f9a3a, [0, 0.62, 0]));
  for (const [sx, y] of [[-1, 0.55], [1, 0.82]]) B.push(tp(sph(0.24, 12, 8), 0x5fb046, [sx * 0.24, y, 0], [0, 0, sx * -0.9], [1, 0.45, 0.22]));
  legs(B, 0x3f7a2a, 0, 0.1);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.283;
    H.push(tp(sph(0.14, 10, 8), i % 2 ? 0xffcf2e : 0xffb81c, [Math.cos(a) * 0.44, 0.22 + Math.sin(a) * 0.44, 0.02], [0, 0, a - Math.PI / 2], [0.75, 1.65, 0.35]));
  }
  H.push(tp(sph(0.32, 16, 12), 0x6b3f1e, [0, 0.22, 0], [0, 0, 0], [1, 1, 0.5]));
  return { body: tmerge(B), head: tmerge(H), pivot: [0, 1.2, 0], face: faceCap(0.32, [0, 0.22, 0], 2.6, 2.3, [1, 1, 0.5]), tex: faces.sun(), top: 2.05 };
}

function pumpkin(): Model {
  const B: G[] = [], H: G[] = [];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283 + 0.4; B.push(tp(cap(0.05, 0.42, 6), 0x4f8f3a, [Math.cos(a) * 0.38, 0.08, Math.sin(a) * 0.38], [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3])); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; B.push(tp(sph(0.16, 10, 8), 0x5fa046, [Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3], [0, -a, 0.5], [1.2, 0.3, 0.8])); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; H.push(tp(sph(0.3, 12, 10), i % 2 ? 0xf28a1e : 0xe57a14, [Math.cos(a) * 0.24, 0.36, Math.sin(a) * 0.24], [0, -a, 0], [0.62, 0.82, 1])); }
  H.push(tp(sph(0.42, 14, 10), 0xec8418, [0, 0.36, 0], [0, 0, 0], [1, 0.82, 1]));
  H.push(tp(cap(0.055, 0.2, 6), 0x5a6a2a, [0.03, 0.78, 0.02], [0.3, 0, 0.3]));
  H.push(tp(tor(0.12, 0.03, 4.5, 5, 12), 0x5fa046, [0.12, 0.78, 0.02], [0, 0, 0.5]));
  return { body: tmerge(B), head: tmerge(H), pivot: [0, 0.18, 0], face: faceCap(0.55, [0, 0.36, 0], 1.9, 1.6, [1, 0.85, 1]), tex: faces.pumpkin(), glow: tmerge([tp(sph(0.06, 8, 6), 0xffe35a, [0.03, 0.92, 0.02])]), top: 1.2 };
}

function berry(): Model {
  const r = rng(4);
  const B: G[] = [], H: G[] = [];
  legs(B, 0x3f8a3a, 0, 0.13);
  B.push(tp(cap(0.04, 0.75, 6), 0x3f7a2a, [0.05, 0.85, 0.32], [-0.75, 0, 0]));
  B.push(tp(sph(0.13, 10, 8), 0x9dff3a, [0.05, 1.28, 0.6]));
  H.push(tp(sph(0.4, 16, 12), 0xe8323c, [0, 0.4, 0], [0, 0, 0], [1, 1, 0.95]));
  H.push(tp(cone(0.33, 0.38, 14), 0xe8323c, [0, 0.06, 0], [Math.PI, 0, 0]));
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * 0.75 + r() * Math.PI * 1.5 - Math.PI, y = 0.1 + r() * 0.55, rr = 0.32 + (y > 0.4 ? 0.08 : 0);
    if (Math.sin(a) < -0.6 && y > 0.2) continue;
    H.push(tp(sph(0.028, 6, 4), 0xffe07a, [Math.cos(a) * rr, y, Math.sin(a) * rr]));
  }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; H.push(tp(sph(0.15, 10, 6), 0x3f9a3a, [Math.cos(a) * 0.2, 0.78, Math.sin(a) * 0.2], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], [0.6, 0.2, 1.3])); }
  H.push(tp(cap(0.035, 0.12, 6), 0x3f7a2a, [0, 0.88, 0]));
  return { body: tmerge(B), head: tmerge(H), pivot: [0, 0.22, 0], face: faceCap(0.4, [0, 0.4, 0], 2.0, 1.6, [1, 1, 0.95]), tex: faces.berry(), glow: tmerge([tp(sph(0.1, 8, 6), 0xc8ff6a, [0.05, 1.06, 0.38])]), top: 1.4 };
}

function lav(): Model {
  const B: G[] = [], H: G[] = [];
  B.push(tp(cone(0.22, 0.55, 12), 0xc7b0f5, [0, 0.42, 0], [Math.PI, 0, 0]));
  for (const sx of [-1, 1]) B.push(tp(sph(0.09, 10, 8), 0x6e9a5a, [sx * 0.26, 0.55, -0.08], [0, 0, sx * 0.6], [1.4, 0.5, 0.8]));
  H.push(tp(sph(0.33, 16, 12), 0xc4a8f7, [0, 0.28, 0], [0, 0, 0], [1, 1.05, 1]));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * 6.283;
    if (Math.sin(a) < -0.55) continue;
    H.push(tp(cap(0.06, 0.34, 8), i % 2 ? 0x8a5fd0 : 0x9d74e0, [Math.cos(a) * 0.24, 0.6, Math.sin(a) * 0.24], [Math.sin(a) * -0.55, 0, Math.cos(a) * 0.55]));
  }
  return { body: tmerge(B), head: tmerge(H), pivot: [0, 0.68, 0], face: faceCap(0.33, [0, 0.28, 0], 2.0, 1.6, [1, 1.05, 1]), tex: faces.lav(), glow: tmerge([tp(sph(0.1, 10, 8), 0xf0e0ff, [0, 0.3, -0.18])]), top: 1.55 };
}

function cactus(): Model {
  const r = rng(6);
  const B: G[] = [], H: G[] = [];
  B.push(tp(cap(0.4, 0.7, 14), 0x5aad4e, [0, 0.72, 0]));
  for (const sx of [-1, 1]) {
    B.push(tp(cap(0.13, 0.22, 10), 0x63b856, [sx * 0.52, 0.72, 0], [0, 0, sx * 1.57]));
    B.push(tp(cap(0.13, 0.32, 10), 0x63b856, [sx * 0.68, 0.98, 0]));
  }
  for (let i = 0; i < 18; i++) { const a = r() * 6.283, y = 0.35 + r() * 0.75; B.push(tp(cone(0.025, 0.14, 4), 0xfff2d2, [Math.cos(a) * 0.42, y, Math.sin(a) * 0.42], [0, -a, -Math.PI / 2])); }
  legs(B, 0x3f8a3a, 0, 0.18);
  H.push(tp(sph(0.38, 16, 12), 0x5aad4e, [0, 0.22, 0], [0, 0, 0], [1, 0.95, 1]));
  H.push(tp(sph(0.11, 10, 8), 0xff6aa8, [0.12, 0.6, 0.05], [0, 0, 0], [1, 0.6, 1]));
  H.push(tp(sph(0.06, 8, 6), 0xffe35a, [0.12, 0.66, 0.05]));
  for (let i = 0; i < 6; i++) { const a = r() * 6.283; if (Math.sin(a) < -0.4) continue; H.push(tp(cone(0.022, 0.12, 4), 0xfff2d2, [Math.cos(a) * 0.38, 0.3 + r() * 0.2, Math.sin(a) * 0.38], [0, -a, -Math.PI / 2])); }
  return { body: tmerge(B), head: tmerge(H), pivot: [0, 1.2, 0], face: faceCap(0.38, [0, 0.22, 0], 2.0, 1.6, [1, 0.95, 1]), tex: faces.cactus(), top: 2.0 };
}

function pepper(): Model {
  const B: G[] = [], H: G[] = [];
  B.push(tp(cap(0.26, 0.4, 12), 0xd42a20, [0, 0.62, 0.05], [0.25, 0, 0]));
  B.push(tp(cone(0.2, 0.45, 12), 0xc4241a, [0, 0.22, 0.24], [Math.PI + 0.7, 0, 0]));
  for (const sx of [-1, 1]) B.push(tp(sph(0.2, 10, 8), 0x4fa03a, [sx * 0.24, 0.8, 0.22], [0.4, sx * 0.5, sx * 0.8], [1.4, 0.18, 0.8]));
  legs(B, 0x3f7a2a, 0, 0.12);
  H.push(tp(sph(0.3, 16, 12), 0xd42a20, [0, 0.2, 0]));
  H.push(tp(sph(0.2, 12, 8), 0xd42a20, [0, 0.12, -0.24], [0, 0, 0], [1.1, 0.85, 1]));
  for (const sx of [-1, 1]) H.push(tp(cone(0.06, 0.2, 8), 0xf2e6c8, [sx * 0.16, 0.48, 0.02], [0.3, 0, sx * -0.35]));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; H.push(tp(sph(0.11, 8, 6), 0x3f8a2a, [Math.cos(a) * 0.12, 0.47, Math.sin(a) * 0.12 + 0.04], [0, -a, 0], [1.4, 0.35, 0.7])); }
  H.push(tp(cap(0.04, 0.18, 6), 0x3f7a2a, [0, 0.6, 0.06], [0.4, 0, 0]));
  return { body: tmerge(B), head: tmerge(H), pivot: [0, 0.98, -0.05], face: faceCap(0.3, [0, 0.22, 0], 2.0, 1.55), tex: faces.pepper(), glow: tmerge([tp(sph(0.07, 8, 6), 0xffb02a, [0, 0.08, -0.43])]), top: 1.75 };
}

const STAR = (() => { const g = new THREE.OctahedronGeometry(0.13, 0); g.scale(1, 1, 0.4); return g; })();

interface Set { body: THREE.InstancedMesh; bodyO: THREE.InstancedMesh; head: THREE.InstancedMesh; headO: THREE.InstancedMesh; face: THREE.InstancedMesh; faceB: THREE.InstancedMesh; faceA: THREE.InstancedMesh; glow: THREE.InstancedMesh | null; model: Model }

/** Plantas-criaturas: as culturas maduras se transformam à noite. */
export class Creatures {
  private sets: Set[] = [];
  yaw = new Float32Array(N);
  private hyaw = new Float32Array(N);
  private delay = new Float32Array(N);
  private m4 = new THREE.Matrix4();
  private h4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private nightT = 0;
  aim: (t: number) => { x: number; z: number } | null = () => null;
  charge = new Float32Array(N);
  private stars: THREE.InstancedMesh;

  constructor(scene: THREE.Scene, private fx: FX, high: boolean) {
    const models = [wheat(), corn(), sun(), pumpkin(), berry(), lav(), cactus(), pepper()];
    const KINDS = ['wheat', 'corn', 'sun', 'pumpkin', 'berry', 'lav', 'cactus', 'pepper'] as const;
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mk = (g: G, m: THREE.Material, shadow = false) => {
      const im = new THREE.InstancedMesh(g, m, N);
      im.count = 0; im.frustumCulled = false; im.castShadow = shadow && high; im.receiveShadow = false;
      scene.add(im);
      return im;
    };
    for (let ci = 0; ci < CROPS.length; ci++) {
      const cd = CROPS[ci];
      const md = models[cd.base ?? ci];
      const fm = (tex: THREE.Texture) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, depthWrite: false, color: 0xeeeeee });
      const faceMat = fm(md.tex);
      const kind = KINDS[cd.base ?? ci];
      const bm = cd.tint ? toon({ color: cd.tint }) : TOON;
      this.sets.push({
        body: mk(md.body, bm, true), bodyO: mk(hull(md.body, 0.03), OUTLINE),
        head: mk(md.head, bm, true), headO: mk(hull(md.head, 0.03), OUTLINE),
        face: mk(md.face, faceMat), faceB: mk(md.face, fm(moodTex(kind, 1))), faceA: mk(md.face, fm(moodTex(kind, 2))), glow: md.glow ? mk(md.glow, glowMat) : null, model: md,
      });
    }
    this.stars = new THREE.InstancedMesh(STAR, new THREE.MeshBasicMaterial({ color: 0xffd23f }), N * 3);
    this.stars.count = 0; this.stars.frustumCulled = false;
    scene.add(this.stars);
    const r = rng(9);
    for (let t = 0; t < N; t++) this.delay[t] = r() * 2.5;
  }

  update(dt: number, night: boolean, time: number, cam: THREE.Vector3) {
    this.nightT = night ? this.nightT + dt : 0;
    const counts = new Array(this.sets.length).fill(0);
    const fcount = this.sets.map(() => [0, 0, 0]);
    const BASE = CROPS.map((cd, i) => cd.base ?? i);
    let ns = 0;
    let changed = false;
    for (let t = 0; t < N; t++) {
      const ripe = T.s[t] === 2 && T.g[t] >= 1 && live(t);
      const want = ripe && night && this.nightT > this.delay[t] ? 1 : 0;
      const a0 = T.a[t];
      if (!ripe) { if (a0 !== 0) { T.a[t] = 0; changed = true; } continue; }
      if (a0 !== want) {
        T.a[t] = want > a0 ? Math.min(1, a0 + dt * 1.6) : Math.max(0, a0 - dt * 1.2);
        changed = true;
        if (a0 === 0 && want === 1) this.fx.spawn(tileX(t), 0.5, tileZ(t), 0x9dff7a, 14, 1.2, 4, 7, 0.8);
        if (a0 === 1 && want === 0) this.fx.spawn(tileX(t), 0.6, tileZ(t), 0xfff2a0, 8, 1, 2, 5, 0.8);
      }
      const a = T.a[t];
      if (a <= 0.001) continue;
      const c = T.c[t];
      const x = tileX(t), z = tileZ(t);
      if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > 90 * 90) continue;
      const set = this.sets[c];
      const ct = c;
      const c2 = BASE[c];
      const md = set.model;
      // mira: corpo vira devagar, cabeça rápido
      const tg = this.aim(t);
      const ty = tg ? Math.atan2(-(tg.x - x), -(tg.z - z)) : Math.sin(time * 0.4 + t) * 0.5;
      const pu = Math.max(0, T.p[t]);
      let d = ty - this.yaw[t]; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (c2 === 0 && pu > 0) this.yaw[t] += dt * 20;
      else this.yaw[t] += d * Math.min(1, dt * 3);
      let hd = ty - this.yaw[t]; hd = Math.atan2(Math.sin(hd), Math.cos(hd));
      hd = Math.max(-0.9, Math.min(0.9, hd));
      this.hyaw[t] += (hd - this.hyaw[t]) * Math.min(1, dt * 10);
      // escala/pulo
      const k = a < 1 ? 1 + 2.7 * Math.pow(a - 1, 3) + 1.7 * Math.pow(a - 1, 2) : 1;
      const lvl = T.k[t] >= 40 ? 3 : T.k[t] >= 15 ? 2 : T.k[t] >= 5 ? 1 : 0;
      const big = (1 + lvl * 0.1) * 1.15;
      const ph = time * 3.2 + t * 1.7;
      const bounce = Math.abs(Math.sin(ph)) * 0.05;
      let sx = k * big, sy = k * big * (1 + Math.sin(ph * 2) * 0.03), lean = Math.sin(ph * 0.5) * 0.05, lift = 0;
      let hp = Math.sin(ph) * 0.08, hr = Math.sin(ph * 0.7) * 0.08, hs = 1;
      if (c2 === 1) { hp -= pu * 0.5; lean += pu * 0.15; }
      if (c2 === 2) hp -= 0.15 + pu * 0.25;
      if (c2 === 3) { const ch = this.charge[t]; hs = 1 + ch * 0.3 + Math.sin(time * (10 + ch * 35)) * ch * 0.08; }
      if (c2 === 4) { hp += pu * 0.4; lean -= pu * 0.3; }
      if (c2 === 5) { lift = 0.3 + Math.sin(time * 2 + t) * 0.15; hr += Math.sin(time * 1.3 + t) * 0.15; }
      if (c2 === 7) { hp -= pu * 0.3; hs = 1 + pu * 0.08; }
      if (c2 === 6 && T.p[t] < 0) hs = 1.05;
      if (pu > 0 && c2 !== 0) { sx *= 1 + pu * 0.1; sy *= 1 - pu * 0.08; }
      if (T.p[t] < 0) { sx *= 1 - T.p[t] * 0.12; sy *= 1 + T.p[t] * 0.25; }
      this.q.setFromEuler(this.e.set(lean, this.yaw[t], 0, 'YXZ'));
      this.m4.compose(this.p.set(x, 0.1 + tileY(t) + (lift + bounce) * k, z), this.q, this.sc.set(sx, sy, sx));
      // cabeça
      this.q.setFromEuler(this.e.set(hp, this.hyaw[t], hr, 'YXZ'));
      this.h4.compose(this.p.set(md.pivot[0], md.pivot[1], md.pivot[2]), this.q, this.sc.set(hs, hs, hs));
      this.h4.premultiply(this.m4);
      const i = counts[c]++;
      set.body.setMatrixAt(i, this.m4); set.bodyO.setMatrixAt(i, this.m4);
      set.head.setMatrixAt(i, this.h4); set.headO.setMatrixAt(i, this.h4);
      // expressão: bravo ao atacar/mirar perto, pisca de vez em quando
      const mood = pu > 0.05 || this.charge[t] > 0.15 || (tg && (tg.x - x) ** 2 + (tg.z - z) ** 2 < 49) ? 2 : (time * 0.9 + t * 0.618) % 3.3 < 0.14 ? 1 : 0;
      const fmsh = mood === 2 ? set.faceA : mood === 1 ? set.faceB : set.face;
      fmsh.setMatrixAt(fcount[c][mood]++, this.h4);
      set.glow?.setMatrixAt(i, this.h4);
      if (lvl > 0 && a > 0.9) {
        for (let si = 0; si < lvl; si++) {
          const ang = time * 2 + si * (6.283 / lvl);
          this.q.setFromEuler(this.e.set(0, time * 3, 0));
          this.h4.compose(this.p.set(x + Math.cos(ang) * 0.35, (md.top + lift) * big + 0.2 + tileY(t), z + Math.sin(ang) * 0.35), this.q, this.sc.set(1, 1, 1));
          this.stars.setMatrixAt(ns++, this.h4);
        }
      }
    }
    this.sets.forEach((st, i) => {
      for (const m of [st.body, st.bodyO, st.head, st.headO, st.glow]) {
        if (!m) continue;
        m.count = counts[i]; m.instanceMatrix.needsUpdate = true;
      }
      [st.face, st.faceB, st.faceA].forEach((m, k) => { m.count = fcount[i][k]; m.instanceMatrix.needsUpdate = true; });
    });
    this.stars.count = ns; this.stars.instanceMatrix.needsUpdate = true;
    if (changed) markDirty();
  }
}
