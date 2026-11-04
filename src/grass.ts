import * as THREE from 'three';
import { blades, rng, uTime } from './gfx';

/**
 * Tapete de grama denso que acompanha a câmera (as instâncias "dão a volta"
 * no shader), com balanço de vento e áreas excluídas (campo, estradas, prédios).
 */
export class GrassField {
  mesh: THREE.InstancedMesh;
  private mat: THREE.MeshLambertMaterial;
  private uCam = { value: new THREE.Vector3() };

  constructor(scene: THREE.Scene, high: boolean) {
    const count = high ? 15000 : 6500;
    const size = high ? 66 : 46;
    const r = rng(303);
    const g = blades(r, high ? 5 : 4, 0.28, 0.22, 0.62, [0xffffff, 0xf0f6e8, 0xe4efd4, 0xfaffef]);
    // gradiente base→ponta
    const col = g.attributes.color as THREE.BufferAttribute;
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const k = 0.42 + 0.58 * Math.min(1, pos.getY(i) / 0.55);
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, color: 0x7cc456 });
    const uCam = this.uCam;
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.uniforms.uCam = uCam;
      sh.vertexShader = 'uniform float uTime;\nuniform vec3 uCam;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 ip = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float S = ${size.toFixed(1)};
        vec2 rel = mod(ip.xz - uCam.xz + S * 0.5, S) - S * 0.5;
        vec2 w = uCam.xz + rel;
        float h1 = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float hide = 0.0;
        if (w.x > -36.6 && w.x < 36.6 && w.y > -78.6 && w.y < -5.4) hide = 1.0;
        if (abs(w.x) < 3.6 && w.y > -4.5) hide = 1.0;
        if (length(w - vec2(0.0, 3.0)) < 10.6) hide = 1.0;
        if (w.y > 10.0 && w.y < 14.0 && abs(w.x) < 12.5) hide = 1.0;
        if (length(w - vec2(-36.0, 24.0)) < 9.2) hide = 1.0;
        if (w.x > -22.8 && w.x < -11.2 && w.y > 7.4 && w.y < 16.6) hide = 1.0;
        if (w.x > 11.4 && w.x < 24.6 && w.y > 6.4 && w.y < 17.6) hide = 1.0;
        if (length(w - vec2(27.0, 3.0)) < 3.0) hide = 1.0;
        if (abs(w.x) > 38.0 && abs(w.x) < 46.5 && w.y > -20.5 && w.y < -15.5) hide = 1.0;
        if (abs(w.x) > 96.0 || w.y > 66.0 || w.y < -100.0) hide = 1.0;
        float fade = smoothstep(S * 0.5, S * 0.36, length(rel));
        float sc = (1.0 - hide) * fade * (0.7 + h1 * 0.7);
        float a = h1 * 6.2831;
        float ca = cos(a), sa = sin(a);
        vec3 p = transformed * sc;
        p.xz = vec2(p.x * ca - p.z * sa, p.x * sa + p.z * ca);
        float hh = max(position.y, 0.0);
        float sw = sin(uTime * 1.9 + w.x * 0.35 + w.y * 0.25) + 0.5 * sin(uTime * 3.7 + w.y * 0.8);
        p.x += sw * 0.22 * hh * hh * sc;
        p.z += cos(uTime * 1.5 + w.x * 0.3) * 0.12 * hh * hh * sc;
        p.xz += w - ip.xz;
        transformed = p;
        #ifdef USE_COLOR
          vColor.rgb *= 0.82 + 0.36 * fract(h1 * 7.13);
        #endif`,
      );
    };
    this.mat.customProgramCacheKey = () => 'grassfield';
    this.mesh = new THREE.InstancedMesh(g, this.mat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.makeTranslation((r() - 0.5) * size, 0, (r() - 0.5) * size);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = high;
    scene.add(this.mesh);
  }

  setColor(c: THREE.Color) { this.mat.color.copy(c); }

  update(cam: THREE.Vector3) { this.uCam.value.copy(cam); }
}
