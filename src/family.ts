import * as THREE from 'three';
import { tp, tmerge, hull, sph, cap, cyl, cone, tor, faceCap, faceTex, eye, brow, mouth, blush, TOON, OUTLINE } from './toon';
import { resolve } from './physics';
import * as farm from './farm';
import { T, N, owned, live, tileY, tileX, tileZ } from './farm';
import type { FX } from './fx';

type G = THREE.BufferGeometry;
export type Who = 'ana' | 'bia' | 'leo' | 'ze';
const DOOR = { x: -10.4, z: 12 };
const K = '#1c140c';

function happyFace(key: string, o: { lash?: boolean; glasses?: boolean; beard?: boolean; freckles?: boolean } = {}) {
  return faceTex('fam-' + key, (x) => {
    eye(x, 92, 120, 22, 26, { px: 0.05, py: 0.1, pr: 13, iris: '#5a3a1a' });
    eye(x, 164, 120, 22, 26, { px: -0.05, py: 0.1, pr: 13, iris: '#5a3a1a' });
    if (o.lash) { x.strokeStyle = K; x.lineWidth = 5; for (const cx of [92, 164]) for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(cx + k * 12, 96); x.lineTo(cx + k * 16, 86); x.stroke(); } }
    brow(x, 70, 84, 112, 80, 7, '#4a2e14'); brow(x, 144, 80, 186, 84, 7, '#4a2e14');
    if (o.glasses) { x.strokeStyle = '#3a2a1a'; x.lineWidth = 6; x.beginPath(); x.arc(92, 120, 32, 0, 6.3); x.stroke(); x.beginPath(); x.arc(164, 120, 32, 0, 6.3); x.stroke(); x.beginPath(); x.moveTo(124, 118); x.lineTo(132, 118); x.stroke(); }
    blush(x, 66, 160); blush(x, 190, 160);
    if (o.freckles) { x.fillStyle = 'rgba(150,80,40,0.6)'; for (const [a, b] of [[60, 146], [72, 152], [184, 146], [196, 152], [66, 140], [190, 140]]) { x.beginPath(); x.arc(a, b, 3, 0, 6.3); x.fill(); } }
    if (o.beard) {
      x.fillStyle = '#e8e4dc'; x.strokeStyle = K; x.lineWidth = 5;
      x.beginPath(); x.moveTo(60, 150); x.quadraticCurveTo(128, 260, 196, 150); x.quadraticCurveTo(128, 190, 60, 150); x.fill(); x.stroke();
      x.beginPath(); x.ellipse(110, 164, 26, 10, -0.2, 0, 6.3); x.ellipse(146, 164, 26, 10, 0.2, 0, 6.3); x.fill(); x.stroke();
    } else mouth(x, [[100, 168], [156, 168], [146, 186], [110, 186]], '#7a2a2a', 0, true);
  });
}

interface Look { skin: number; shirt: number; pants: number; hair: number; scale: number; face: THREE.Texture; extra: (H: G[], B: G[]) => void }

const LOOKS: Record<Who, () => Look> = {
  ana: () => ({ skin: 0xf2c6a0, shirt: 0x3a9a8a, pants: 0x4a5a8a, hair: 0x6a3a1a, scale: 0.95, face: happyFace('ana', { lash: true }),
    extra: (H) => { H.push(tp(sph(0.35, 14, 10), 0x6a3a1a, [0, 0.36, 0.06], [0, 0, 0], [1.02, 1, 1.02])); H.push(tp(sph(0.14, 10, 8), 0x6a3a1a, [0, 0.4, 0.38])); H.push(tp(cap(0.08, 0.22, 8), 0x6a3a1a, [0, 0.2, 0.44])); } }),
  bia: () => ({ skin: 0xf5d0ac, shirt: 0xe85a8a, pants: 0x5a6aaa, hair: 0xd8a040, scale: 0.72, face: happyFace('bia', { freckles: true }),
    extra: (H) => { H.push(tp(sph(0.35, 14, 10), 0xd8a040, [0, 0.38, 0.06], [0, 0, 0], [1.03, 0.98, 1.03])); for (const sx of [-1, 1]) { H.push(tp(sph(0.13, 10, 8), 0xd8a040, [sx * 0.36, 0.25, 0.08])); H.push(tp(sph(0.06, 8, 6), 0xff5a8a, [sx * 0.33, 0.36, 0.06])); } } }),
  leo: () => ({ skin: 0xe8b890, shirt: 0xf2b630, pants: 0x3a5a3a, hair: 0x3a2a1a, scale: 0.66, face: happyFace('leo', { freckles: true }),
    extra: (H) => { H.push(tp(sph(0.35, 14, 8), 0x2a6ad8, [0, 0.42, 0.03], [0, 0, 0], [1.03, 0.75, 1.03])); H.push(tp(cyl(0.3, 0.3, 0.04, 14), 0x2a6ad8, [0, 0.52, -0.25], [0.25, 0, 0], [1, 1, 0.6])); } }),
  ze: () => ({ skin: 0xe2b08a, shirt: 0xd8d0b8, pants: 0x6a5a3a, hair: 0xe8e4dc, scale: 0.98, face: happyFace('ze', { glasses: true, beard: true }),
    extra: (H, B) => {
      H.push(tp(cyl(0.6, 0.62, 0.04, 16), 0xd8b45a, [0, 0.6, 0])); H.push(tp(cyl(0.28, 0.32, 0.24, 14), 0xd8b45a, [0, 0.72, 0])); H.push(tp(cyl(0.325, 0.325, 0.06, 14), 0x8a3a2a, [0, 0.64, 0]));
      for (const sx of [-1, 1]) B.push(tp(cap(0.04, 0.5, 6), 0x4a6aa8, [sx * 0.13, 0.3, -0.24], [0.15, 0, 0]));
    } }),
};

interface NPC {
  who: Who; g: THREE.Group; body: THREE.Group; head: THREE.Group; arms: THREE.Group[]; legs: THREE.Group[];
  target: THREE.Vector3; wait: number; walk: number; state: 'day' | 'run' | 'inside' | 'out'; tool?: THREE.Object3D; task: number;
}

function buildNPC(who: Who) {
  const L = LOOKS[who]();
  const B: G[] = [], H: G[] = [], A: G[] = [], Lg: G[] = [];
  B.push(tp(cap(0.24, 0.3, 14), L.shirt, [0, 0.28, 0], [0, 0, 0], [1, 1, 0.85]));
  if (who === 'ana') B.push(tp(cone(0.36, 0.45, 14), L.shirt, [0, -0.02, 0]));
  Lg.push(tp(cap(0.09, 0.34, 10), L.pants, [0, -0.28, 0]));
  Lg.push(tp(sph(0.11, 10, 8), 0x4a3222, [0, -0.6, -0.05], [0, 0, 0], [1, 0.6, 1.4]));
  A.push(tp(cap(0.075, 0.2, 8), L.shirt, [0, -0.16, 0]));
  A.push(tp(cap(0.065, 0.18, 8), L.skin, [0, -0.42, 0]));
  A.push(tp(sph(0.085, 10, 8), L.skin, [0, -0.6, 0]));
  H.push(tp(sph(0.33, 16, 12), L.skin, [0, 0.3, 0]));
  for (const sx of [-1, 1]) H.push(tp(sph(0.07, 8, 6), L.skin, [sx * 0.32, 0.3, 0.02], [0, 0, 0], [0.5, 1, 1]));
  L.extra(H, B);
  const geo = { body: tmerge(B), head: tmerge(H), arm: tmerge(A), leg: tmerge(Lg) };
  const mk = (gg: G) => { const grp = new THREE.Group(); const m = new THREE.Mesh(gg, TOON); m.castShadow = true; grp.add(m, new THREE.Mesh(hull(gg, 0.022), OUTLINE)); return grp; };
  const g = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(L.scale); g.add(body);
  const torso = mk(geo.body); torso.position.y = 0.68; body.add(torso);
  const head = new THREE.Group(); head.position.y = 1.18; body.add(head);
  head.add(mk(geo.head));
  head.add(new THREE.Mesh(faceCap(0.33, [0, 0.3, 0], 2.0, 1.6), new THREE.MeshBasicMaterial({ map: L.face, transparent: true, alphaTest: 0.3, depthWrite: false })));
  const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 0.3, 1.0, 0); a.add(mk(geo.arm)); body.add(a); arms.push(a);
    const l = new THREE.Group(); l.position.set(sx * 0.12, 0.66, 0); l.add(mk(geo.leg)); body.add(l); legs.push(l);
  }
  if (who === 'ze') { const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), TOON); (cane.geometry as G).setAttribute('color', new THREE.Float32BufferAttribute(new Array(cane.geometry.attributes.position.count * 3).fill(0.45), 3)); cane.position.set(0, -0.55, -0.05); arms[1].add(cane); body.rotation.x = 0.12; }
  let tool: THREE.Object3D | undefined;
  if (who === 'bia' || who === 'leo') {
    const can = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 10), new THREE.MeshToonMaterial({ color: who === 'bia' ? 0x4ab6ff : 0x7ad84a }));
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 6), c.material); sp.rotation.x = -1; sp.position.set(0, 0.04, -0.15);
    can.add(c, sp); can.position.set(0, -0.68, -0.05); arms[1].add(can); tool = can;
  }
  return { g, body, head, arms, legs, tool };
}

export const FAMILY: Record<Who, { name: string; role: string }> = {
  ana: { name: 'Ana', role: 'Esposa · cozinha e cuida da vida' },
  bia: { name: 'Bia', role: 'Filha · rega e aduba as plantas' },
  leo: { name: 'Léo', role: 'Filho · rega e aduba as plantas' },
  ze: { name: 'Vô Zé', role: 'Dono da fazenda · oficina e fusões' },
};

const HOME: Record<Who, [number, number][]> = {
  ana: [[-9.5, 9], [-9, 15], [-13, 6.5], [-7, 12]],
  bia: [],
  leo: [],
  ze: [[10.5, 9], [11, 11.5], [9.5, 13], [10.5, 10.5]],
};

export class Family {
  list: NPC[] = [];
  private bench = new THREE.Group();
  inside = false;

  constructor(private scene: THREE.Scene, private fx: FX) {
    for (const who of ['ana', 'bia', 'leo', 'ze'] as Who[]) {
      const b = buildNPC(who);
      b.g.position.set(-9 + Math.random() * 2, 0, 10 + Math.random() * 4);
      scene.add(b.g);
      this.list.push({ who, ...b, target: b.g.position.clone(), wait: Math.random() * 2, walk: 0, state: 'day', task: -1 });
    }
    // bancada do avô
    const W = this.bench; W.position.set(9.5, 0, 10.5); W.rotation.y = Math.PI / 2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.9), new THREE.MeshToonMaterial({ color: 0x9a6a3c })); top.position.y = 0.95; W.add(top);
    for (const [x, z] of [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.12), top.material); l.position.set(x, 0.47, z); W.add(l); }
    const vise = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), new THREE.MeshToonMaterial({ color: 0x5a6a7a })); vise.position.set(0.7, 1.15, 0); W.add(vise);
    const saw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.18), new THREE.MeshToonMaterial({ color: 0xc8ccd2 })); saw.position.set(-0.3, 1.04, 0.1); W.add(saw);
    W.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    scene.add(W);
  }

  get(who: Who) { return this.list.find((n) => n.who === who)!; }

  /** Todos correm para casa. */
  runHome() { for (const n of this.list) if (n.state === 'day') { n.state = 'run'; n.target.set(DOOR.x, 0, DOOR.z + (Math.random() - 0.5)); } }

  /** Saem de casa ao amanhecer. */
  comeOut() {
    this.inside = false;
    this.list.forEach((n, i) => { n.state = 'out'; n.g.visible = true; n.g.position.set(DOOR.x + 0.5, 0, DOOR.z - 0.6 + i * 0.4); n.wait = 0.3 * i; n.target.set(DOOR.x + 3 + i, 0, DOOR.z - 1 + i); });
  }

  allInside() { return this.list.every((n) => n.state === 'inside'); }

  private pickTask(n: NPC) {
    if (n.who === 'bia' || n.who === 'leo') {
      // procura muda com sede: só o que ainda está crescendo (maduro não precisa de água)
      // prioridade: mais seca e mais nova primeiro, depois a mais perto
      let best = -1, bd = Infinity;
      for (let t = 0; t < N; t++) {
        if (!live(t) || T.s[t] !== 2 || T.g[t] >= 1 || T.w[t] > 0.5) continue;
        const dist = Math.hypot(tileX(t) - n.g.position.x, tileZ(t) - n.g.position.z);
        const score = dist + T.w[t] * 60 + T.g[t] * 25;
        if (score < bd && !this.list.some((o) => o !== n && o.task >= 0 && Math.abs(tileX(o.task) - tileX(t)) + Math.abs(tileZ(o.task) - tileZ(t)) < 4)) { bd = score; best = t; }
      }
      n.task = best;
      if (best >= 0) { n.target.set(tileX(best) + 1.1, 0, tileZ(best) + 0.6); return; }
      n.target.set(-4 + Math.random() * 8, 0, 0 + Math.random() * 8);
      return;
    }
    const spots = HOME[n.who];
    const [x, z] = spots[(Math.random() * spots.length) | 0];
    n.target.set(x + (Math.random() - 0.5), 0, z + (Math.random() - 0.5));
  }

  update(dt: number, time: number, player: THREE.Vector3, waterBoost: number) {
    for (const n of this.list) {
      if (n.state === 'inside') { n.g.visible = false; continue; }
      const p = n.g.position;
      if (n.state === 'day' && n.task >= 0 && n.wait <= 0) {
        const t = n.task;
        if (T.s[t] !== 2 || T.g[t] >= 1 || T.w[t] > 0.7) { n.task = -1; this.pickTask(n); }
      }
      const speed = n.state === 'run' ? 5.2 : n.who === 'ze' ? 1.1 : n.who === 'ana' ? 1.5 : 2.1;
      const dx = n.target.x - p.x, dz = n.target.z - p.z, d = Math.hypot(dx, dz);
      let moving = false;
      if (n.wait > 0) n.wait -= dt;
      else if (d > 0.35) {
        moving = true;
        const yaw = Math.atan2(-dx, -dz);
        let dy = yaw - n.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        n.g.rotation.y += dy * Math.min(1, dt * 8);
        p.x += (dx / d) * speed * dt; p.z += (dz / d) * speed * dt;
        resolve(p, 0.3);
      } else {
        if (n.state === 'run') { n.state = 'inside'; n.g.visible = false; this.fx.spawn(DOOR.x, 1, DOOR.z, 0xfff2a0, 6, 0.5, 2, 4, 0.5); if (this.allInside()) this.inside = true; continue; }
        if (n.state === 'out') n.state = 'day';
        // chegou: regar?
        if (n.task >= 0) {
          const t = n.task;
          if (T.s[t] === 2 && T.g[t] < 1) {
            for (const tt of farm.area(t, 1)) if (T.s[tt] === 2 && T.g[tt] < 1) T.w[tt] = 1;
            farm.markDirty();
            this.fx.spawn(tileX(t), 0.9, tileZ(t), 0x6fc3ff, 18, 1.4, 1.5, 9, 0.8);
            n.g.rotation.y = Math.atan2(-(tileX(t) - p.x), -(tileZ(t) - p.z));
          }
          n.task = -1;
          n.wait = 1.4 / waterBoost;
        } else n.wait = 1.5 + Math.random() * 3;
        this.pickTask(n);
      }
      // olha para o jogador quando perto e parado
      const pd = Math.hypot(player.x - p.x, player.z - p.z);
      if (!moving && pd < 4) { const yaw = Math.atan2(-(player.x - p.x), -(player.z - p.z)); n.g.rotation.y += Math.atan2(Math.sin(yaw - n.g.rotation.y), Math.cos(yaw - n.g.rotation.y)) * Math.min(1, dt * 5); }
      // animação
      n.walk += dt * (moving ? speed * 3.2 : 0);
      const sw = moving ? Math.sin(n.walk) * (n.state === 'run' ? 0.9 : 0.5) : 0;
      n.legs[0].rotation.x = sw; n.legs[1].rotation.x = -sw;
      const watering = n.wait > 0 && (n.who === 'bia' || n.who === 'leo') && n.task < 0 && n.wait < 1.4;
      n.arms[0].rotation.x = n.state === 'run' ? -sw * 1.2 : -sw * 0.6;
      n.arms[1].rotation.x = n.state === 'run' ? sw * 1.2 : watering ? -1.1 : sw * 0.6;
      n.body.position.y = moving ? Math.abs(Math.cos(n.walk)) * (n.state === 'run' ? 0.08 : 0.04) : Math.sin(time * 2 + n.who.length) * 0.01;
      n.head.rotation.z = Math.sin(time * 1.3 + n.who.length) * 0.06;
      if (n.state === 'run') n.body.rotation.x = 0.25; else n.body.rotation.x = n.who === 'ze' ? 0.12 : 0;
      if (n.who === 'ze' && !moving && n.wait > 0) n.arms[0].rotation.x = -1.2 + Math.abs(Math.sin(time * 6)) * 0.6; // martelando
    }
  }
}
