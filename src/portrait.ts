import * as THREE from 'three';
import { buildZombie, type ZKindM } from './zmodels';

const cache = new Map<string, string>();

/** Desenha um retrato do zumbi (para o card de "novo inimigo"). */
export function zPortrait(renderer: THREE.WebGLRenderer, kind: ZKindM): string {
  const c = cache.get(kind);
  if (c) return c;
  const S = 256;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dd, 0x4a5a6a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-2, 4, -5); scene.add(sun);
  const z = buildZombie(kind, true);
  z.root.rotation.y = Math.PI - 0.5;
  for (let i = 0; i < z.arms.length; i++) z.arms[i].rotation.x = z.reach;
  scene.add(z.root);
  const box = new THREE.Box3().setFromObject(z.root);
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const h = Math.max(size.y, size.x * 1.1, size.z);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const dist = h / (2 * Math.tan((15 * Math.PI) / 180)) * 1.12;
  cam.position.set(ctr.x - dist * 0.25, ctr.y + h * 0.1, ctr.z - dist);
  cam.lookAt(ctr);
  const rt = new THREE.WebGLRenderTarget(S, S, { samples: 4 });
  const prev = renderer.getRenderTarget();
  const prevClear = renderer.getClearAlpha(), prevColor = renderer.getClearColor(new THREE.Color());
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(S * S * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(prevColor, prevClear);
  rt.dispose();
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d')!;
  const img = x.createImageData(S, S);
  const lin = (v: number) => { const f = v / 255; return Math.round(255 * (f <= 0.0031308 ? f * 12.92 : 1.055 * f ** (1 / 2.4) - 0.055)); };
  for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
    const s = ((S - 1 - y) * S + i) * 4, d = (y * S + i) * 4;
    img.data[d] = lin(px[s]); img.data[d + 1] = lin(px[s + 1]); img.data[d + 2] = lin(px[s + 2]); img.data[d + 3] = px[s + 3];
  }
  x.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  cache.set(kind, url);
  return url;
}
