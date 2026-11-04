import * as THREE from 'three';
import { rng } from './gfx';
import { tp, tmerge, bands } from './toon';

type G = THREE.BufferGeometry;
// primitivas leves (poucos vértices, ainda suaves)
const S = (r: number, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h);
const C = (rt: number, rb: number, h: number, s = 5) => new THREE.CylinderGeometry(rt, rb, h, s, 1, true);
const CO = (r: number, h: number, s = 6) => new THREE.ConeGeometry(r, h, s, 1);
const CP = (r: number, len: number, s = 6) => new THREE.CapsuleGeometry(r, len, 2, s);

/** Folha: esfera achatada inclinada para fora. */
function leaf(P: G[], x: number, y: number, z: number, ang: number, len: number, col: number, tilt = 0.9) {
  P.push(tp(S(1, 6, 4), col, [x + Math.cos(ang) * len * 0.45, y, z + Math.sin(ang) * len * 0.45], [0, -ang, tilt], [len * 0.5, 0.03, len * 0.16]));
}

function wheat(): G {
  const r = rng(11); const P: G[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x = -0.6 + i * 0.6 + (r() - 0.5) * 0.2, z = -0.6 + j * 0.6 + (r() - 0.5) * 0.2, h = 0.75 + r() * 0.25;
    const lean = (r() - 0.5) * 0.2;
    P.push(tp(C(0.022, 0.03, h), 0x9cc04a, [x, h / 2, z], [lean, 0, 0]));
    P.push(tp(S(1, 6, 5), 0xf5cf55, [x, h + 0.12, z + lean * h * 0.5], [lean, r() * 3, 0], [0.075, 0.2, 0.075]));
    P.push(tp(CO(0.012, 0.18, 3), 0xffe28a, [x, h + 0.36, z + lean * h * 0.5], [lean, 0, 0]));
    if (r() > 0.5) leaf(P, x, 0.3, z, r() * 6.28, 0.42, 0x86b840);
  }
  return tmerge(P);
}

function corn(): G {
  const r = rng(22); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.4], [0.45, -0.35], [0, 0.45]]) {
    const h = 1.85 + r() * 0.3;
    P.push(tp(C(0.045, 0.065, h, 6), 0x6fae3e, [x, h / 2, z]));
    for (let k = 0; k < 4; k++) leaf(P, x, 0.45 + k * 0.38, z, r() * 6.28, 0.75, k % 2 ? 0x7fc04a : 0x6aac3c, 0.6);
    const cob = tp(CP(0.075, 0.26, 7), 0xffd54a, [x + 0.12, 1.08, z], [0, 0, -0.35]);
    bands(cob, 0.9, 1.3, 0.05, 0.85);
    P.push(cob);
    P.push(tp(S(1, 6, 4), 0x9fd060, [x + 0.15, 0.94, z], [0, 0, -0.35], [0.09, 0.16, 0.09]));
    P.push(tp(CO(0.08, 0.32, 5), 0xe0c27a, [x, h + 0.12, z]));
  }
  return tmerge(P);
}

function sunflower(): G {
  const r = rng(33); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.35], [0.45, -0.25], [0, 0.45]]) {
    const h = 1.5 + r() * 0.3;
    P.push(tp(C(0.04, 0.06, h, 6), 0x5a9e3a, [x, h / 2, z]));
    leaf(P, x, 0.55, z, 0.3, 0.55, 0x6ab046); leaf(P, x, 0.9, z, 3.4, 0.5, 0x6ab046);
    // pétalas (disco largo amarelo) + miolo marrom, voltados para +z levemente para cima
    P.push(tp(S(1, 12, 4), 0xffc928, [x, h + 0.06, z + 0.03], [Math.PI / 2 - 0.45, 0, 0], [0.38, 0.05, 0.38]));
    P.push(tp(S(1, 9, 5), 0x6b3f1e, [x, h + 0.08, z + 0.07], [Math.PI / 2 - 0.45, 0, 0], [0.2, 0.07, 0.2]));
  }
  return tmerge(P);
}

function pumpkin(): G {
  const r = rng(44); const P: G[] = [];
  for (let k = 0; k < 5; k++) leaf(P, 0, 0.08, 0, (k / 5) * 6.28 + r(), 0.9, 0x4f9a3a, 0.15);
  for (const [x, z, s] of [[-0.3, 0.22, 1], [0.38, -0.28, 0.78]]) {
    const pm = tp(S(0.36, 12, 8), 0xf28a1e, [x, 0.27 * s, z], [0, r(), 0], [s, s * 0.72, s]);
    bands(pm, -1, 2, 10, 1); // sem efeito (mantém API)
    // gomos: escurece por ângulo
    const p = pm.attributes.position, c = pm.attributes.color;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i) - z, p.getX(i) - x); const k = 0.82 + 0.18 * Math.abs(Math.cos(a * 4)); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
    P.push(pm);
    P.push(tp(C(0.03, 0.045, 0.16, 5), 0x6b5a2a, [x, 0.55 * s, z], [0.2, 0, 0.2]));
  }
  return tmerge(P);
}

function strawberry(): G {
  const r = rng(55); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.4], [0.45, -0.3], [0, 0.45]]) {
    P.push(tp(S(0.34, 8, 6), 0x3f9a3a, [x, 0.2, z], [0, r(), 0], [1, 0.6, 1]));
    for (let k = 0; k < 4; k++) {
      const a = r() * 6.28;
      P.push(tp(S(1, 6, 5), 0xe8323c, [x + Math.cos(a) * 0.3, 0.13, z + Math.sin(a) * 0.3], [0, 0, 0], [0.07, 0.09, 0.07]));
    }
    P.push(tp(S(0.05, 5, 4), 0xffffff, [x, 0.42, z]));
  }
  return tmerge(P);
}

function lavender(): G {
  const r = rng(66); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.4], [0.45, -0.35], [0, 0.45]]) {
    P.push(tp(S(0.24, 7, 5), 0x6e9a5a, [x, 0.12, z], [0, r(), 0], [1, 0.5, 1]));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 6.28, lx = Math.cos(a) * 0.08, lz = Math.sin(a) * 0.08, h = 0.6 + r() * 0.2;
      P.push(tp(C(0.012, 0.016, h, 4), 0x7c9a63, [x + lx, h / 2, z + lz], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]));
      P.push(tp(S(1, 5, 4), k % 2 ? 0x9b6fd6 : 0xb08ce8, [x + lx + Math.cos(a) * h * 0.3, h + 0.05, z + lz + Math.sin(a) * h * 0.3], [0, 0, 0], [0.05, 0.14, 0.05]));
    }
  }
  return tmerge(P);
}

function cactus(): G {
  const r = rng(88); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.4], [0.45, -0.3], [-0.1, 0.45]]) {
    const h = 0.6 + r() * 0.4;
    P.push(tp(CP(0.14, h, 8), 0x5aad4e, [x, h / 2 + 0.12, z]));
    P.push(tp(CP(0.07, 0.16, 6), 0x63b856, [x + 0.2, h * 0.55 + 0.1, z], [0, 0, -1.4]));
    P.push(tp(CP(0.07, 0.18, 6), 0x63b856, [x + 0.3, h * 0.55 + 0.24, z]));
    if (r() > 0.4) P.push(tp(S(0.07, 6, 4), 0xff6aa8, [x, h + 0.3, z], [0, 0, 0], [1, 0.6, 1]));
  }
  return tmerge(P);
}

function pepper(): G {
  const r = rng(99); const P: G[] = [];
  for (const [x, z] of [[-0.4, -0.35], [0.4, -0.3], [0, 0.42]]) {
    P.push(tp(C(0.025, 0.035, 0.4, 4), 0x4f7a2a, [x, 0.2, z]));
    P.push(tp(S(0.3, 8, 6), 0x3f8a2e, [x, 0.5, z], [r(), r(), 0], [1, 0.75, 1]));
    for (let k = 0; k < 4; k++) {
      const a = r() * 6.28;
      P.push(tp(CP(0.045, 0.16, 6), k % 2 ? 0xe02a1a : 0xff4a1a, [x + Math.cos(a) * 0.27, 0.36, z + Math.sin(a) * 0.27], [0.3, a, 0.2]));
    }
  }
  return tmerge(P);
}

export function buildToonCrops(): G[] {
  return [wheat(), corn(), sunflower(), pumpkin(), strawberry(), lavender(), cactus(), pepper()];
}
