import * as THREE from 'three';
import { Sign, uTime } from './gfx';

export interface Lane { id: string; name: string; arrow: string; pts: [number, number][]; unlock: number }

/** Rotas de ataque: os zumbis seguem estes pontos até a casa. */
export const LANES: Lane[] = [
  { id: 'n1', name: 'Norte', arrow: '⬆️', unlock: 1, pts: [[-5, -93], [-5, -62], [-3, -34], [-1, -14], [-5, -2], [-10.2, 11.5]] },
  { id: 'n2', name: 'Nordeste', arrow: '↗️', unlock: 2, pts: [[24, -93], [24, -60], [22, -36], [7, -22], [3, -6], [-10.2, 12.5]] },
  { id: 'e', name: 'Leste', arrow: '➡️', unlock: 3, pts: [[91, -11], [60, -11], [34, -11], [12, -12], [2, -3], [-10.2, 12]] },
  { id: 'w', name: 'Oeste', arrow: '⬅️', unlock: 5, pts: [[-91, -11], [-60, -11], [-36, -11], [-20, -12], [-17, -1], [-17, 7]] },
  { id: 's', name: 'Sul', arrow: '⬇️', unlock: 7, pts: [[0, 58], [0, 36], [-1, 22], [-6, 16], [-10.2, 13]] },
];
export const LMAP: Record<string, Lane> = Object.fromEntries(LANES.map((l) => [l.id, l]));
export const lanesFor = (night: number) => LANES.filter((l) => night >= l.unlock);

const arrowMat = (color: THREE.Color) => new THREE.ShaderMaterial({
  uniforms: { uTime, uColor: { value: color }, uOp: { value: 0 } },
  transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOp; varying vec2 vUv;
    void main(){
      float v = abs(vUv.y - 0.5) * 2.0;
      float c = fract(vUv.x * 0.5 - uTime * 0.9 - v * 0.35);
      float chevron = smoothstep(0.0, 0.08, c) * (1.0 - smoothstep(0.32, 0.42, c));
      float edge = smoothstep(1.0, 0.75, v);
      float a = (0.25 + chevron * 0.75) * edge * uOp;
      gl_FragColor = vec4(uColor * (0.7 + chevron * 0.6), a);
      #include <colorspace_fragment>
    }`,
});

function ribbon(pts: [number, number][], width: number): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let dist = 0;
  // subdivide para seguir bem o chão
  const P: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector2(...pts[i]), b = new THREE.Vector2(...pts[i + 1]);
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / 2));
    for (let k = 0; k < n; k++) P.push(a.clone().lerp(b, k / n));
  }
  P.push(new THREE.Vector2(...pts[pts.length - 1]));
  for (let i = 0; i < P.length; i++) {
    const prev = P[Math.max(0, i - 1)], next = P[Math.min(P.length - 1, i + 1)];
    const d = next.clone().sub(prev).normalize();
    const nx = -d.y, nz = d.x;
    if (i > 0) dist += P[i].distanceTo(P[i - 1]);
    pos.push(P[i].x + nx * width / 2, 0.07, P[i].y + nz * width / 2, P[i].x - nx * width / 2, 0.07, P[i].y - nz * width / 2);
    uv.push(dist, 0, dist, 1);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class LaneView {
  private items: { lane: Lane; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; beacon: THREE.Group; beam: THREE.Mesh; sign: Sign; target: number; op: number }[] = [];

  constructor(scene: THREE.Scene) {
    for (const lane of LANES) {
      const mat = arrowMat(new THREE.Color(0xff4a3a));
      const mesh = new THREE.Mesh(ribbon(lane.pts, 1.6), mat);
      mesh.renderOrder = 3; mesh.frustumCulled = false;
      scene.add(mesh);
      const beacon = new THREE.Group();
      const [x, z] = lane.pts[0];
      const [x2, z2] = lane.pts[1];
      beacon.position.set(x + (x2 - x) * 0.08, 0, z + (z2 - z) * 0.08);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      beam.position.y = 30;
      beacon.add(beam);
      const sign = new Sign(['ROTA ' + lane.name.toUpperCase(), '']);
      sign.scale.setScalar(1.6);
      sign.position.set(2.5, 0, 0);
      sign.rotation.y = Math.atan2(-10 - beacon.position.x, 12 - beacon.position.z);
      beacon.add(sign);
      scene.add(beacon);
      this.items.push({ lane, mesh, mat, beacon, beam, sign, target: 0, op: 0 });
    }
  }

  /** counts: quantidade de zumbis por rota na próxima noite (ou atual). */
  set(counts: Record<string, number>, night: boolean) {
    for (const it of this.items) {
      const c = counts[it.lane.id] || 0;
      it.target = c > 0 ? (night ? 0.55 : 1) : 0;
      it.sign.setText([`ROTA ${it.lane.name.toUpperCase()}`, c > 0 ? `🧟 ${c} ${night ? 'atacando' : 'esta noite'}` : 'tranquila']);
    }
  }

  update(dt: number, time: number) {
    for (const it of this.items) {
      it.op += (it.target - it.op) * Math.min(1, dt * 3);
      it.mat.uniforms.uOp.value = it.op;
      it.mesh.visible = it.op > 0.01;
      it.beacon.visible = it.op > 0.01;
      (it.beam.material as THREE.MeshBasicMaterial).opacity = it.op * (0.18 + Math.sin(time * 3) * 0.06);
    }
  }
}
