import * as THREE from 'three';
import { part, merge, cone, cyl, ico, box, rng, shade, blades } from './gfx';

type G = THREE.BufferGeometry;
const v = new THREE.Vector3();
const e = new THREE.Euler();

/** Haste inclinada; retorna a ponta. */
function stalk(P: G[], x: number, z: number, h: number, rx: number, rz: number, r: number, color: number, seg = 3): THREE.Vector3 {
  e.set(rx, 0, rz);
  v.set(0, h / 2, 0).applyEuler(e);
  P.push(part(cyl(r * 0.6, r, h, seg, true), color, [x + v.x, v.y, z + v.z], [rx, 0, rz]));
  return new THREE.Vector3(0, h, 0).applyEuler(e).add(new THREE.Vector3(x, 0, z));
}

function wheat(): G {
  const r = rng(11); const P: G[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const x = -0.69 + i * 0.46 + (r() - 0.5) * 0.18;
    const z = -0.6 + j * 0.6 + (r() - 0.5) * 0.18;
    const h = 0.75 + r() * 0.3;
    const rx = (r() - 0.5) * 0.25, rz = (r() - 0.5) * 0.25;
    const tip = stalk(P, x, z, h, rx, rz, 0.035, 0x9fb54c);
    P.push(part(cone(0.075, 0.32, 4), 0xeac35a, [tip.x, tip.y + 0.1, tip.z], [rx, r() * 3, rz]));
    if (r() > 0.4) P.push(part(cone(0.045, 0.45, 3, true), 0x8fae48, [x + 0.08, 0.22, z], [0, r() * 6, -0.7]));
  }
  return merge(P);
}

function corn(): G {
  const r = rng(22); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    const h = 1.8 + r() * 0.35;
    const tip = stalk(P, x, z, h, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08, 0.06, 0x6f9a3a, 5);
    for (let k = 0; k < 4; k++) {
      const a = r() * Math.PI * 2;
      const y = 0.4 + k * 0.38;
      P.push(part(cone(0.09, 0.95, 3, true), 0x7fb54a, [x + Math.cos(a) * 0.3, y + 0.15, z + Math.sin(a) * 0.3], [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0]));
    }
    P.push(part(cyl(0.07, 0.06, 0.36, 5), 0xf2d04b, [x + 0.12, 1.1, z], [0, 0, -0.4]));
    P.push(part(cone(0.075, 0.2, 4, true), 0x9cc25a, [x + 0.14, 0.92, z], [Math.PI, 0, -0.4]));
    P.push(part(cone(0.1, 0.35, 3), 0xd8c27a, [tip.x, tip.y + 0.12, tip.z]));
  }
  return merge(P);
}

function sunflower(): G {
  const r = rng(33); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.35], [0.45, -0.25], [0, 0.45]]) {
    const h = 1.5 + r() * 0.3;
    stalk(P, x, z, h, 0, 0, 0.055, 0x5f8f35, 4);
    for (let k = 0; k < 2; k++) {
      const a = r() * Math.PI * 2;
      P.push(part(cone(0.16, 0.55, 3, true), 0x6aa23e, [x + Math.cos(a) * 0.22, 0.55 + k * 0.4, z + Math.sin(a) * 0.22], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2]));
    }
    // cabeça voltada para +z (sol nascente) levemente inclinada
    P.push(part(cyl(0.34, 0.34, 0.05, 9), 0xffc928, [x, h + 0.05, z + 0.06], [Math.PI / 2 - 0.45, 0, 0]));
    P.push(part(cyl(0.2, 0.2, 0.08, 9), 0x5a3a1a, [x, h + 0.08, z + 0.1], [Math.PI / 2 - 0.45, 0, 0]));
  }
  return merge(P);
}

function pumpkin(): G {
  const r = rng(44); const P: G[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r();
    P.push(part(cone(0.32, 0.7, 3), 0x4f8f3a, [Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45], [Math.PI / 2, 0, a], [1, 1, 0.25]));
  }
  for (const [x, z, s] of [[-0.3, 0.2, 1], [0.35, -0.25, 0.8]]) {
    P.push(part(ico(0.38, 1), 0xf08a24, [x, 0.27 * s, z], [0, r(), 0], [s, s * 0.72, s]));
    P.push(part(cyl(0.03, 0.05, 0.18, 4), 0x6b4a22, [x, 0.55 * s, z]));
  }
  return merge(P);
}

function strawberry(): G {
  const r = rng(55); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.4], [0.45, -0.3], [0, 0.45]]) {
    P.push(part(ico(0.34, 0), 0x3f8a3a, [x, 0.2, z], [r(), r(), 0], [1, 0.62, 1]));
    for (let k = 0; k < 4; k++) {
      const a = r() * Math.PI * 2;
      P.push(part(cone(0.07, 0.15, 5), 0xe23a3a, [x + Math.cos(a) * 0.3, 0.14, z + Math.sin(a) * 0.3], [Math.PI, 0, 0]));
    }
    P.push(part(ico(0.05, 0), 0xffffff, [x, 0.44, z]));
  }
  return merge(P);
}

function lavender(): G {
  const r = rng(66); const P: G[] = [];
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    P.push(part(ico(0.26, 0), 0x6e8f5a, [x, 0.12, z], [0, r(), 0], [1, 0.5, 1]));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rx = Math.sin(a) * 0.35, rz = -Math.cos(a) * 0.35;
      const tip = stalk(P, x, z, 0.6 + r() * 0.2, rx, rz, 0.02, 0x7c9a63);
      P.push(part(cone(0.055, 0.28, 4), 0x9b6fd6, [tip.x, tip.y + 0.08, tip.z], [rx, 0, rz]));
    }
  }
  return merge(P);
}

export function buildCropGeometries(): G[] {
  return [shade(wheat(), 0.5), shade(corn(), 0.45), shade(sunflower(), 0.5), shade(pumpkin(), 0.6), shade(strawberry(), 0.6), shade(lavender(), 0.5)];
}

export function grassTuft(): G {
  const r = rng(77);
  const g = blades(r, 34, 0.95, 0.28, 0.75, [0xd6f0b8, 0xc4e3a0, 0xe2f2c8, 0xb8d890]);
  return shade(g, 0.45);
}

export function soilGeometry(): G {
  const P: G[] = [];
  P.push(part(box(1.96, 0.1, 1.96), 0xbbbbbb, [0, 0.05, 0]));
  for (const x of [-0.72, -0.24, 0.24, 0.72]) {
    P.push(part(box(0.3, 0.08, 1.88), 0xffffff, [x, 0.12, 0]));
  }
  return merge(P);
}

export function frameGeometry(): G {
  const P: G[] = [];
  const t = 0.07, s = 1.9;
  P.push(part(box(s, 0.04, t), 0xffffff, [0, 0, -s / 2]));
  P.push(part(box(s, 0.04, t), 0xffffff, [0, 0, s / 2]));
  P.push(part(box(t, 0.04, s), 0xffffff, [-s / 2, 0, 0]));
  P.push(part(box(t, 0.04, s), 0xffffff, [s / 2, 0, 0]));
  return merge(P);
}
