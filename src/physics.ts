import type * as THREE from 'three';

export interface Box { x1: number; z1: number; x2: number; z2: number; on?: () => boolean }
export interface Circle { x: number; z: number; r: number; on?: () => boolean }
export const colliders = { boxes: [] as Box[], circles: [] as Circle[] };

export const BOUNDS = { x1: -92, x2: 92, z1: -94, z2: 60 };

export function resolve(p: THREE.Vector3, r: number): boolean {
  let hit = false;
  for (const b of colliders.boxes) {
    if (b.on && !b.on()) continue;
    const cx = Math.max(b.x1, Math.min(p.x, b.x2));
    const cz = Math.max(b.z1, Math.min(p.z, b.z2));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r;
      } else {
        // dentro da caixa: empurra pelo lado mais próximo
        const l = p.x - b.x1, rr = b.x2 - p.x, t = p.z - b.z1, bb = b.z2 - p.z;
        const m = Math.min(l, rr, t, bb);
        if (m === l) p.x = b.x1 - r; else if (m === rr) p.x = b.x2 + r; else if (m === t) p.z = b.z1 - r; else p.z = b.z2 + r;
      }
    }
  }
  for (const c of colliders.circles) {
    if (c.on && !c.on()) continue;
    const dx = p.x - c.x, dz = p.z - c.z;
    const d2 = dx * dx + dz * dz, rr = c.r + r;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr;
      hit = true;
    }
  }
  if (p.x < BOUNDS.x1) { p.x = BOUNDS.x1; hit = true; }
  if (p.x > BOUNDS.x2) { p.x = BOUNDS.x2; hit = true; }
  if (p.z < BOUNDS.z1) { p.z = BOUNDS.z1; hit = true; }
  if (p.z > BOUNDS.z2) { p.z = BOUNDS.z2; hit = true; }
  return hit;
}
