import * as THREE from 'three';
import { part, merge, cone, cyl, ico, box, bx, mat, windMat, rng, fbm, heightAt, Sign, prism, dotTexture } from './gfx';
import { colliders } from './physics';
import { PARCELS, owned, setRain, tileX, tileZ, randomRipe, PN, TILE } from './farm';
import { game, vitality, lv, siloUsed, siloCap, fmt } from './state';
import { isProcessing } from './economy';
import type { FX } from './fx';

export const POS = {
  house: new THREE.Vector3(-17, 0, 12),
  barn: new THREE.Vector3(18, 0, 12),
  silo: new THREE.Vector3(27, 0, 3),
  well: new THREE.Vector3(-6, 0, 3),
  market: new THREE.Vector3(6, 0, 3),
  tractor: new THREE.Vector3(10, 0, -1),
  mill: new THREE.Vector3(-44, 0, -18),
  press: new THREE.Vector3(44, 0, -18),
  pond: new THREE.Vector3(-36, 0, 24),
};

export const parcelPrice = (n: number) => Math.round(250 * Math.pow(2.3, n - 1));
export const parcelLevel = (n: number) => n + 1;
export function parcelSignPos(id: number) { const p = PARCELS[id]; return new THREE.Vector3(p.x0 + 10, 0, p.z0 + 20.6); }

const C = (h: number) => new THREE.Color(h);
const DAY_TOP = C(0x3d86d6), DAY_HOR = C(0xc4e6f7), NIGHT_TOP = C(0x060c22), NIGHT_HOR = C(0x1d2a4c), GOLD = C(0xffa766), RAIN = C(0x8f98a3);
const SUN_DAY = C(0xfff3dd), SUN_GOLD = C(0xffa45c), MOON = C(0x9fb4e6);
const GRASS_DRY = C(0xb9ad62), GRASS_LUSH = C(0x5ea845), HILL = C(0x4c7f3a), ROCK = C(0x8e8f80), SAND = C(0xd9c995);

export class World {
  scene: THREE.Scene;
  sun = new THREE.DirectionalLight(0xffffff, 2.6);
  hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5d7040, 1.2);
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private ground: THREE.Mesh;
  private gVit = -1;
  private trees: THREE.InstancedMesh[] = [];
  private treeTint: number[][] = [];
  private flowers!: THREE.InstancedMesh;
  private flowerMax = 0;
  private windowMat = new THREE.MeshLambertMaterial({ color: 0x9cc6e0, emissive: 0xffc870, emissiveIntensity: 0, flatShading: true });
  private lampMat = new THREE.MeshLambertMaterial({ color: 0xfff1c4, emissive: 0xffd27a, emissiveIntensity: 0 });
  private porch = new THREE.PointLight(0xffc27a, 0, 18, 1.6);
  private stars: THREE.Points;
  private clouds: THREE.Group[] = [];
  private birds: { g: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; r: number; h: number; sp: number; ph: number }[] = [];
  private flies: { g: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; base: THREE.Vector3; ph: number }[] = [];
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  rainF = 0;
  private rainTarget = 0;
  private weatherT = 90;
  private millGroup = new THREE.Group();
  private millBlades = new THREE.Group();
  private millSite = new THREE.Group();
  private pressGroup = new THREE.Group();
  private pressSite = new THREE.Group();
  private siloGroup = new THREE.Group();
  private bales: THREE.Mesh[] = [];
  parcelSigns: Sign[] = [];
  tractorSign: Sign;
  private millSign: Sign;
  private pressSign: Sign;
  private sprinklers: THREE.Group[] = [];
  private drones: { g: THREE.Group; rotors: THREE.Mesh[]; target: THREE.Vector3; t: number }[] = [];
  private droneHolder = new THREE.Group();
  private smokeT = 0;
  private sprayT = 0;
  private fx: FX;
  sunDir = new THREE.Vector3();
  night = 0;

  constructor(scene: THREE.Scene, fx: FX, high: boolean) {
    this.scene = scene;
    this.fx = fx;
    scene.fog = new THREE.Fog(0xc4e6f7, 90, 430);
    scene.add(this.hemi);
    this.sun.castShadow = true;
    const sz = high ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);

    // Céu
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunVis: { value: 1 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVis; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 c = mix(hor, top, smoothstep(-0.02, 0.5, h));
          if (h < 0.0) c = hor * mix(1.0, 0.75, min(1.0, -h * 3.0));
          float sd = max(dot(d, sunDir), 0.0);
          c += sunCol * (smoothstep(0.9985, 0.9992, sd) * 2.0 + pow(sd, 10.0) * 0.28) * sunVis;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 14), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // Estrelas
    {
      const r = rng(5); const n = 700; const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.95);
        p[i * 3] = Math.sin(ph) * Math.cos(th) * 700; p[i * 3 + 1] = Math.cos(ph) * 700; p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 700;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false, map: dotTexture() }));
      this.stars.frustumCulled = false;
      scene.add(this.stars);
    }

    // Terreno
    const gg = new THREE.PlaneGeometry(1000, 1000, 160, 160);
    gg.rotateX(-Math.PI / 2);
    const pos = gg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) - 0.02);
    gg.computeVertexNormals();
    gg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    this.ground = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    this.buildRoads();
    this.buildPond();
    this.buildTrees();
    this.buildFlowers();
    this.buildRocks();
    this.buildFence();
    this.buildHouse();
    this.buildBarn();
    this.buildSilo();
    this.buildWell();
    this.buildMarket();
    this.buildMill();
    this.buildPress();
    this.buildLamps();
    this.buildClouds();
    this.buildBirds();
    this.buildButterflies();
    scene.add(this.droneHolder);

    // Placas
    for (const p of PARCELS) {
      const s = new Sign(['TERRENO', '']);
      s.position.copy(parcelSignPos(p.id));
      scene.add(s);
      this.parcelSigns.push(s);
    }
    this.tractorSign = new Sign(['TRATOR', '$350 · Nv 3']);
    this.tractorSign.position.copy(POS.tractor);
    scene.add(this.tractorSign);
    this.millSign = new Sign(['MOINHO', '$2.000 · Nv 5']);
    this.millSign.position.copy(POS.mill).add(new THREE.Vector3(4.5, 0, 0));
    this.millSign.rotation.y = Math.PI / 2;
    scene.add(this.millSign);
    this.pressSign = new Sign(['PRENSA', '$9.000 · Nv 8']);
    this.pressSign.position.copy(POS.press).add(new THREE.Vector3(-5.5, 0, 0));
    this.pressSign.rotation.y = -Math.PI / 2;
    scene.add(this.pressSign);

    // Chuva
    {
      const n = 1400; this.rainPos = new Float32Array(n * 6);
      const r = rng(9);
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.5) * 60, y = r() * 30, z = (r() - 0.5) * 60;
        this.rainPos.set([x, y, z, x + 0.05, y + 0.7, z], i * 6);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
      this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaecbe8, transparent: true, opacity: 0 }));
      this.rain.frustumCulled = false;
      this.rain.visible = false;
      scene.add(this.rain);
    }

    // Colisores
    colliders.boxes.push(
      { x1: -22.4, z1: 7.8, x2: -11.6, z2: 16.2 },
      { x1: 11.8, z1: 6.8, x2: 24.2, z2: 17.2 },
      { x1: 4.1, z1: 2.1, x2: 7.9, z2: 3.9 },
      { x1: 38.6, z1: -21.4, x2: 49.6, z2: -14.6, on: () => lv('press') > 0 },
    );
    colliders.circles.push(
      { x: POS.silo.x, z: POS.silo.z, r: 2.5 },
      { x: POS.well.x, z: POS.well.z, r: 1.3 },
      { x: POS.mill.x, z: POS.mill.z, r: 3.3, on: () => lv('mill') > 0 },
      { x: POS.pond.x, z: POS.pond.z, r: 7 },
    );
  }

  // ------------------------------------------------------------------ construção
  private buildRoads() {
    const P: THREE.BufferGeometry[] = [];
    const dirt = 0xa98a5c, dirt2 = 0x9c7f52;
    const strip = (x1: number, z1: number, x2: number, z2: number, c = dirt) => {
      const g = new THREE.PlaneGeometry(x2 - x1, z2 - z1); g.rotateX(-Math.PI / 2);
      P.push(part(g, c, [(x1 + x2) / 2, 0.012, (z1 + z2) / 2]));
    };
    strip(-38, -8, 38, -4); strip(-38, -80, 38, -76);
    strip(-38, -80, -34, -4); strip(34, -80, 38, -4);
    strip(-14, -80, -10, -4, dirt2); strip(10, -80, 14, -4, dirt2);
    strip(-38, -32, 38, -28, dirt2); strip(-38, -56, 38, -52, dirt2);
    strip(-3, -4, 3, 62);
    strip(-12, 10.5, -3, 13.5); strip(3, 10.5, 12, 13.5);
    strip(-46, -20, -38, -16); strip(38, -20, 46, -16);
    const c = new THREE.CircleGeometry(10, 28); c.rotateX(-Math.PI / 2);
    P.push(part(c, 0xb39466, [0, 0.01, 3]));
    const mesh = new THREE.Mesh(merge(P), new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private buildPond() {
    const p = POS.pond;
    const w = new THREE.Mesh(new THREE.CircleGeometry(7.5, 32), new THREE.MeshStandardMaterial({ color: 0x3f8fc4, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.88 }));
    w.rotation.x = -Math.PI / 2; w.position.set(p.x, 0.04, p.z);
    this.scene.add(w);
    const sand = new THREE.Mesh(new THREE.RingGeometry(7.2, 9, 32), mat(0xd9c995));
    sand.rotation.x = -Math.PI / 2; sand.position.set(p.x, 0.02, p.z); sand.receiveShadow = true;
    this.scene.add(sand);
    const r = rng(3); const P: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2, d = 7.3 + r() * 1.5;
      P.push(part(ico(0.35 + r() * 0.4, 0), 0x8d8b84, [p.x + Math.cos(a) * d, 0.1, p.z + Math.sin(a) * d], [r(), r(), r()], [1, 0.6, 1]));
    }
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d = 6.4 + r() * 1.2;
      for (let k = 0; k < 3; k++) P.push(part(cyl(0.03, 0.04, 1.4 + r() * 0.6, 3), 0x6a8a3a, [p.x + Math.cos(a) * d + (r() - 0.5) * 0.4, 0.7, p.z + Math.sin(a) * d + (r() - 0.5) * 0.4], [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3]));
    }
    const lily = new THREE.Mesh(merge(P), windMat(0.02));
    lily.castShadow = true;
    this.scene.add(lily);
    // vitórias-régias
    const LP: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d = r() * 5.5;
      LP.push(part(cyl(0.45, 0.45, 0.04, 8), 0x4f9a45, [p.x + Math.cos(a) * d, 0.07, p.z + Math.sin(a) * d]));
      if (r() > 0.5) LP.push(part(ico(0.13, 0), 0xffb6d5, [p.x + Math.cos(a) * d, 0.16, p.z + Math.sin(a) * d]));
    }
    this.scene.add(new THREE.Mesh(merge(LP), mat(0xffffff, { vertexColors: true })));
  }

  private buildTrees() {
    const pine: THREE.BufferGeometry[] = [
      part(cyl(0.22, 0.32, 2.2, 5), 0x6b4a2b, [0, 1.1, 0]),
      part(cone(2.1, 3.2, 7), 0x2f6e3c, [0, 3.2, 0]),
      part(cone(1.65, 2.7, 7), 0x377a42, [0, 4.7, 0]),
      part(cone(1.1, 2.3, 7), 0x3f8648, [0, 6.1, 0]),
    ];
    const round: THREE.BufferGeometry[] = [
      part(cyl(0.28, 0.4, 2.6, 5), 0x7a5532, [0, 1.3, 0]),
      part(ico(2.1, 0), 0x5a9a3c, [0, 3.8, 0]),
      part(ico(1.5, 0), 0x68aa46, [0.9, 4.7, 0.4]),
      part(ico(1.3, 0), 0x4f8f36, [-0.9, 4.3, -0.5]),
    ];
    const birch: THREE.BufferGeometry[] = [
      part(cyl(0.18, 0.25, 4, 5), 0xe8e2d4, [0, 2, 0]),
      part(ico(1.4, 0), 0x8cc152, [0, 4.6, 0], [0, 0, 0], [1, 1.4, 1]),
      part(ico(1.0, 0), 0x9dcc5a, [0.5, 5.6, 0.2]),
    ];
    const geos = [merge(pine), merge(round), merge(birch)];
    const r = rng(42);
    const spots: { x: number; z: number; type: number }[] = [];
    const fixed: [number, number, number][] = [[-27, 4, 1], [-25, 20, 1], [-8, 24, 2], [8, 26, 1], [30, 18, 1], [33, 9, 2], [-29, 12, 2], [-12, 28, 0], [16, 28, 0], [-48, -4, 1], [48, -2, 1], [-50, -40, 0], [50, -44, 0], [-52, -70, 1], [52, -66, 2]];
    for (const [x, z, t] of fixed) spots.push({ x, z, type: t });
    let tries = 0;
    while (spots.length < 420 && tries < 5000) {
      tries++;
      const x = (r() - 0.5) * 640, z = -340 + r() * 600;
      if (x > -56 && x < 56 && z > -90 && z < 40) continue;
      if (Math.abs(x) < 6 && z > 30) continue;
      spots.push({ x, z, type: r() < 0.45 ? 0 : r() < 0.7 ? 1 : 2 });
    }
    const counts = [0, 0, 0];
    for (const s of spots) counts[s.type]++;
    const meshes = geos.map((g, i) => {
      const m = new THREE.InstancedMesh(g, windMat(0.0035), counts[i]);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      return m;
    });
    const idx = [0, 0, 0];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3();
    this.treeTint = [[], [], []];
    for (const s of spots) {
      const k = 0.8 + r() * 0.8;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      m4.compose(new THREE.Vector3(s.x, heightAt(s.x, s.z) - 0.2, s.z), q, sv.set(k, k * (0.85 + r() * 0.3), k));
      meshes[s.type].setMatrixAt(idx[s.type], m4);
      this.treeTint[s.type].push(0.82 + r() * 0.3);
      idx[s.type]++;
      if (Math.abs(s.x) < 95 && s.z > -95 && s.z < 62) colliders.circles.push({ x: s.x, z: s.z, r: 0.5 * k });
    }
    this.trees = meshes;
  }

  private buildFlowers() {
    const P = [part(cyl(0.012, 0.02, 0.36, 3, true), 0x7fa85a, [0, 0.18, 0]), part(ico(0.075, 0), 0xffffff, [0, 0.38, 0], [0, 0, 0], [1, 0.6, 1])];
    const g = merge(P);
    const r = rng(17);
    const pts: [number, number][] = [];
    let tries = 0;
    while (pts.length < 2200 && tries < 20000) {
      tries++;
      const x = (r() - 0.5) * 190, z = -96 + r() * 156;
      if (x > -40 && x < 40 && z > -82 && z < -2) continue;
      if (Math.abs(x) < 4.5 && z > -4) continue;
      if (Math.hypot(x, z - 3) < 11) continue;
      if (x > -24 && x < -9 && z > 6 && z < 18) continue;
      if (x > 10 && x < 31 && z > 0 && z < 19) continue;
      if (Math.hypot(x - POS.pond.x, z - POS.pond.z) < 9.5) continue;
      if (Math.hypot(x - POS.mill.x, z - POS.mill.z) < 6 || Math.hypot(x - POS.press.x, z - POS.press.z) < 8) continue;
      // agrupa em manchas
      if (fbm(x * 0.06, z * 0.06) < 0.42) continue;
      pts.push([x, z]);
    }
    this.flowerMax = pts.length;
    const m = new THREE.InstancedMesh(g, windMat(0.25), pts.length);
    const palette = [0xff8fbf, 0xffe066, 0xffffff, 0xb48cf0, 0xff9a52, 0x7fc8ff, 0xff6b6b];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    pts.forEach(([x, z], i) => {
      const k = 0.8 + r() * 0.9;
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(k, k, k));
      m.setMatrixAt(i, m4);
      m.setColorAt(i, c.set(palette[(r() * palette.length) | 0]));
    });
    m.count = 0;
    this.flowers = m;
    this.scene.add(m);
  }

  private buildRocks() {
    const r = rng(23);
    const m = new THREE.InstancedMesh(ico(1, 0), mat(0x8f8d86), 80);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < 80; i++) {
      let x = 0, z = 0;
      do { x = (r() - 0.5) * 400; z = -250 + r() * 400; } while (x > -45 && x < 45 && z > -86 && z < 36);
      const k = 0.4 + r() * 1.6;
      q.setFromEuler(new THREE.Euler(r(), r(), r()));
      m4.compose(new THREE.Vector3(x, heightAt(x, z), z), q, new THREE.Vector3(k, k * 0.6, k * 0.9));
      m.setMatrixAt(i, m4);
    }
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
  }

  private buildFence() {
    const P: THREE.BufferGeometry[] = [];
    const wood = 0x9a6a3c;
    const run = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.round(len / 2.5));
      const ang = Math.atan2(z2 - z1, x2 - x1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        P.push(part(box(0.16, 1.15, 0.16), 0x86592f, [x1 + (x2 - x1) * t, 0.57, z1 + (z2 - z1) * t]));
      }
      for (const y of [0.45, 0.9]) P.push(part(box(len, 0.1, 0.07), wood, [(x1 + x2) / 2, y, (z1 + z2) / 2], [0, -ang, 0]));
    };
    run(-30, -3, -30, 31); run(34, -3, 34, 31);
    run(-30, 31, -4, 31); run(4, 31, 34, 31);
    const m = new THREE.Mesh(merge(P), mat(0xffffff, { vertexColors: true }));
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
  }

  private buildHouse() {
    const g = new THREE.Group(); g.position.copy(POS.house);
    bx(g, 10.4, 0.5, 8.4, 0x8d8378, 0, 0.25, 0);
    bx(g, 10, 4.2, 8, 0xf3e6c8, 0, 2.35, 0);
    const roof = new THREE.Mesh(prism(11, 3.2, 9.4), mat(0xa8432f)); roof.position.y = 4.4; roof.castShadow = true; g.add(roof);
    bx(g, 0.9, 3, 0.9, 0x9a4b3a, -3, 6.4, 2.2);
    bx(g, 0.16, 2.3, 1.4, 0x7a4a2a, 5.05, 1.6, 0);
    bx(g, 0.2, 0.12, 0.12, 0xd4b24a, 5.2, 1.6, 0.45);
    for (const z of [-2.6, 2.6]) {
      bx(g, 0.14, 1.2, 1.2, this.windowMat, 5.04, 2.6, z);
      bx(g, 0.18, 1.35, 0.3, 0x4f7a4a, 5.07, 2.6, z - 0.8);
      bx(g, 0.18, 1.35, 0.3, 0x4f7a4a, 5.07, 2.6, z + 0.8);
      bx(g, 0.5, 0.3, 1.3, 0x7a4a2a, 5.3, 1.85, z);
      for (let k = -1; k <= 1; k++) bx(g, 0.25, 0.25, 0.25, [0xff7aa8, 0xffe066, 0xff9a52][k + 1], 5.35, 2.1, z + k * 0.4);
    }
    for (const x of [-2.5, 2.5]) for (const z of [-4.04, 4.04]) bx(g, 1.2, 1.2, 0.14, this.windowMat, x, 2.6, z);
    bx(g, 2.6, 0.22, 4.4, 0x9a6a3c, 6.4, 0.3, 0);
    for (const z of [-2, 2]) bx(g, 0.2, 2.6, 0.2, 0xf2efe6, 7.5, 1.6, z);
    bx(g, 3, 0.18, 4.8, 0xa8432f, 6.5, 2.95, 0);
    this.porch.position.set(6.6, 2.6, 0);
    g.add(this.porch);
    this.scene.add(g);
  }

  private buildBarn() {
    const g = new THREE.Group(); g.position.copy(POS.barn);
    bx(g, 12, 6, 10, 0xb3392b, 0, 3, 0);
    const roof = new THREE.Mesh(prism(12.8, 4.2, 11), mat(0x5b5049)); roof.position.y = 6; roof.castShadow = true; g.add(roof);
    const W = 0xf2efe6;
    for (const [x, z] of [[-6, -5], [-6, 5], [6, -5], [6, 5]]) bx(g, 0.3, 6, 0.3, W, x, 3, z);
    bx(g, 0.16, 4.4, 4.4, 0x8a2a20, -6.04, 2.2, 0);
    bx(g, 0.2, 4.6, 0.25, W, -6.08, 2.3, -2.2); bx(g, 0.2, 4.6, 0.25, W, -6.08, 2.3, 2.2); bx(g, 0.2, 0.25, 4.6, W, -6.08, 4.5, 0);
    const b1 = bx(g, 0.2, 0.22, 6, W, -6.1, 2.2, 0); b1.rotation.x = 0.78;
    const b2 = bx(g, 0.2, 0.22, 6, W, -6.1, 2.2, 0); b2.rotation.x = -0.78;
    bx(g, 0.16, 1.4, 1.6, 0x3a2a20, -6.04, 7.4, 0);
    this.scene.add(g);
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(cyl(0.6, 0.6, 1.2, 10), mat(0xe2c25a));
      b.rotation.z = Math.PI / 2;
      b.position.set(14 + (i % 4) * 1.35, 0.6 + Math.floor(i / 4) * 1.1, 4.6 + (i >= 4 ? 0.3 : 0));
      b.castShadow = true; b.visible = false;
      this.scene.add(b); this.bales.push(b);
    }
  }

  private buildSilo() {
    const g = this.siloGroup; g.position.copy(POS.silo);
    const m = new THREE.Mesh(cyl(2.4, 2.4, 10, 16), mat(0xc7cbd0)); m.position.y = 5; m.castShadow = true; m.receiveShadow = true; g.add(m);
    for (const y of [1.5, 3.5, 5.5, 7.5, 9.5]) { const r = new THREE.Mesh(cyl(2.46, 2.46, 0.16, 16), mat(0x9aa0a8)); r.position.y = y; g.add(r); }
    const d = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xdfe4ea)); d.position.y = 10; d.castShadow = true; g.add(d);
    for (const x of [-0.35, 0.35]) bx(g, 0.08, 10, 0.08, 0x6f747b, x, 5, -2.5);
    for (let y = 0.5; y < 10; y += 0.6) bx(g, 0.7, 0.06, 0.06, 0x6f747b, 0, y, -2.5);
    this.scene.add(g);
  }

  private buildWell() {
    const g = new THREE.Group(); g.position.copy(POS.well);
    const ring = new THREE.Mesh(cyl(1.15, 1.25, 1, 10), mat(0x9b9a95)); ring.position.y = 0.5; ring.castShadow = true; g.add(ring);
    const w = new THREE.Mesh(cyl(0.95, 0.95, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0x2f7fb8, roughness: 0.1 })); w.position.y = 0.98; g.add(w);
    for (const x of [-1, 1]) bx(g, 0.18, 2.2, 0.18, 0x7a5532, x, 1.6, 0);
    const roof = new THREE.Mesh(prism(2.8, 0.9, 2.6), mat(0x8a3b2a)); roof.position.y = 2.6; roof.castShadow = true; g.add(roof);
    const crank = new THREE.Mesh(cyl(0.07, 0.07, 2.1, 6), mat(0x5a3a22)); crank.rotation.z = Math.PI / 2; crank.position.y = 2.1; g.add(crank);
    bx(g, 0.35, 0.35, 0.35, 0x8a6a3c, 0.2, 1.6, 0);
    this.scene.add(g);
  }

  private buildMarket() {
    const g = new THREE.Group(); g.position.copy(POS.market);
    bx(g, 3.6, 1, 1.6, 0x9a6a3c, 0, 0.5, 0);
    for (const [x, z] of [[-1.7, -0.7], [1.7, -0.7], [-1.7, 0.7], [1.7, 0.7]]) bx(g, 0.14, 2.7, 0.14, 0x7a5532, x, 1.35, z);
    for (let i = 0; i < 6; i++) {
      const s = bx(g, 0.62, 0.08, 2.1, i % 2 ? 0xf7f1e3 : 0xe0473a, -1.55 + i * 0.62, 2.75, 0);
      s.rotation.x = -0.18;
    }
    const prod = [0xf08a24, 0xe23a3a, 0xf2d04b, 0x9b6fd6, 0x7fc25a];
    for (let i = 0; i < 5; i++) {
      bx(g, 0.6, 0.3, 0.6, 0xb9884e, -1.4 + i * 0.7, 1.15, -0.3);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(ico(0.13, 0), mat(prod[i])); b.position.set(-1.5 + i * 0.7 + k * 0.1, 1.4, -0.3 + (k - 1) * 0.12); g.add(b); }
    }
    const s = new Sign(['MERCADO', '📈']);
    s.position.set(0, 1.4, -1.2); s.scale.setScalar(0.7);
    g.add(s);
    this.scene.add(g);
  }

  private buildMill() {
    const g = this.millGroup; g.position.copy(POS.mill);
    const t = new THREE.Mesh(cyl(2.2, 3.2, 9, 8), mat(0xe2d6c3)); t.position.y = 4.5; t.castShadow = true; t.receiveShadow = true; g.add(t);
    const cap = new THREE.Mesh(cone(2.8, 2.8, 8), mat(0x7a3b2a)); cap.position.y = 10.4; cap.castShadow = true; g.add(cap);
    bx(g, 0.2, 2, 1.2, 0x6b4425, 3.0, 1, 0, 0).rotation.z = -0.1;
    bx(g, 0.2, 0.9, 0.9, this.windowMat, 2.55, 5.5, 0).rotation.z = -0.1;
    const B = this.millBlades; B.position.set(3.1, 8.6, 0);
    const hub = new THREE.Mesh(cyl(0.35, 0.35, 0.6, 8), mat(0x5a3a22)); hub.rotation.z = Math.PI / 2; B.add(hub);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.x = (k * Math.PI) / 2;
      bx(arm, 0.14, 6.6, 0.24, 0x6b4425, 0.2, 3.4, 0);
      bx(arm, 0.06, 5, 1.3, 0xf3ece0, 0.25, 3.9, 0.75);
      B.add(arm);
    }
    g.add(B);
    this.scene.add(g);
    // canteiro de obras
    const s = this.millSite; s.position.copy(POS.mill);
    for (let i = 0; i < 5; i++) bx(s, 3, 0.2, 0.4, 0xb5874e, 0, 0.1 + i * 0.2, (i % 2) * 0.3);
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(ico(0.5, 0), mat(0x9b9a95)); r.position.set(-1.8 + i * 0.4, 0.3, 1.5); s.add(r); }
    this.scene.add(s);
  }

  private buildPress() {
    const g = this.pressGroup; g.position.copy(POS.press);
    bx(g, 8, 5, 6, 0xd9c08a, 0, 2.5, 0);
    const roof = new THREE.Mesh(prism(8.6, 2.2, 6.8), mat(0x6b5a4a)); roof.position.y = 5; roof.castShadow = true; g.add(roof);
    const tank = new THREE.Mesh(cyl(1.4, 1.4, 4, 12), mat(0xe8b830)); tank.position.set(-5.3, 2, 0); tank.castShadow = true; g.add(tank);
    const ch = new THREE.Mesh(cyl(0.35, 0.45, 4, 8), mat(0x777777)); ch.position.set(2, 7, 1.5); ch.castShadow = true; g.add(ch);
    bx(g, 0.16, 2.6, 2.2, 0x6b4425, -4.05, 1.3, 1.2);
    for (const z of [-1.5]) bx(g, 0.14, 1.1, 1.4, this.windowMat, -4.04, 3, z);
    this.scene.add(g);
    const s = this.pressSite; s.position.copy(POS.press);
    for (let i = 0; i < 6; i++) bx(s, 3.5, 0.2, 0.4, 0xb5874e, 0, 0.1 + i * 0.2, (i % 2) * 0.3);
    bx(s, 1, 1, 1, 0x8a8a8a, 2, 0.5, 2);
    this.scene.add(s);
  }

  private buildLamps() {
    const P: THREE.BufferGeometry[] = [];
    const spots = [[4, -3], [-4, 12], [4, 22], [-4, 34], [4, 46], [-9, -3]];
    const bulbs: THREE.BufferGeometry[] = [];
    for (const [x, z] of spots) {
      P.push(part(cyl(0.08, 0.12, 4, 6), 0x3a3a3a, [x, 2, z]));
      P.push(part(box(0.9, 0.08, 0.08), 0x3a3a3a, [x - Math.sign(x) * 0.4, 3.95, z]));
      bulbs.push(part(ico(0.22, 0), 0xffffff, [x - Math.sign(x) * 0.8, 3.75, z]));
    }
    const m = new THREE.Mesh(merge(P), mat(0xffffff, { vertexColors: true })); m.castShadow = true;
    this.scene.add(m, new THREE.Mesh(merge(bulbs), this.lampMat));
  }

  private buildClouds() {
    const r = rng(8);
    const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25, flatShading: true, fog: false });
    for (let i = 0; i < 16; i++) {
      const P: THREE.BufferGeometry[] = [];
      const n = 3 + ((r() * 4) | 0);
      for (let k = 0; k < n; k++) P.push(part(ico(4 + r() * 5, 0), 0xffffff, [k * 5 - n * 2.5, r() * 2, (r() - 0.5) * 6], [r(), r(), r()], [1, 0.6, 1]));
      const g = new THREE.Group();
      g.add(new THREE.Mesh(merge(P), cm));
      g.position.set((r() - 0.5) * 700, 90 + r() * 50, (r() - 0.5) * 700);
      this.clouds.push(g);
      this.scene.add(g);
    }
  }

  private buildBirds() {
    const r = rng(12);
    const bm = mat(0x3a3a46);
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(cone(0.12, 0.6, 4), bm); body.rotation.x = Math.PI / 2; g.add(body);
      const wl = new THREE.Mesh(box(0.9, 0.03, 0.3), bm); wl.geometry.translate(0.45, 0, 0); g.add(wl);
      const wr = new THREE.Mesh(box(0.9, 0.03, 0.3), bm); wr.geometry.translate(-0.45, 0, 0); g.add(wr);
      g.visible = false;
      this.scene.add(g);
      this.birds.push({ g, wl, wr, r: 25 + r() * 35, h: 16 + r() * 14, sp: 0.15 + r() * 0.15, ph: r() * 6.28 });
    }
  }

  private buildButterflies() {
    const r = rng(14);
    const cols = [0xffd23f, 0xff8fbf, 0x7fc8ff, 0xffffff, 0xff9a52];
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      const m = new THREE.MeshLambertMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide });
      const pg = new THREE.PlaneGeometry(0.22, 0.18);
      const wl = new THREE.Mesh(pg, m); wl.geometry = pg.clone().translate(0.11, 0, 0); wl.rotation.x = -Math.PI / 2;
      const wr = new THREE.Mesh(pg.clone().translate(-0.11, 0, 0), m); wr.rotation.x = -Math.PI / 2;
      g.add(wl, wr);
      let x = 0, z = 0;
      do { x = (r() - 0.5) * 120; z = -80 + r() * 130; } while (x > -38 && x < 38 && z > -80 && z < 0);
      g.visible = false;
      this.scene.add(g);
      this.flies.push({ g, wl, wr, base: new THREE.Vector3(x, 1, z), ph: r() * 100 });
    }
  }

  private makeDrone() {
    const g = new THREE.Group();
    bx(g, 0.7, 0.22, 0.7, 0xf2f2f2, 0, 0, 0);
    bx(g, 0.3, 0.12, 0.3, 0x40c4ff, 0, -0.15, 0);
    const rotors: THREE.Mesh[] = [];
    for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
      bx(g, 0.08, 0.08, 0.8, 0x555555, x / 2, 0.05, z / 2).rotation.y = Math.atan2(x, z);
      const r = new THREE.Mesh(box(0.7, 0.02, 0.08), mat(0x222222)); r.position.set(x, 0.14, z); g.add(r); rotors.push(r);
    }
    const light = new THREE.Mesh(ico(0.08, 0), new THREE.MeshBasicMaterial({ color: 0x40ff8a })); light.position.set(0, 0, 0.36); g.add(light);
    g.position.set(0, 4, -10);
    this.droneHolder.add(g);
    this.drones.push({ g, rotors, target: new THREE.Vector3(0, 4, -18), t: 0 });
  }

  /** Envia um drone para um canteiro (efeito visual de colheita automática). */
  droneTo(t: number) {
    if (!this.drones.length) return;
    let best = this.drones[0], bd = Infinity;
    const x = tileX(t), z = tileZ(t);
    for (const d of this.drones) { const dd = (d.g.position.x - x) ** 2 + (d.g.position.z - z) ** 2; if (dd < bd) { bd = dd; best = d; } }
    best.target.set(x, 3, z);
    best.t = 1.5;
    this.fx.spawn(x, 0.8, z, 0x7dffb0, 6, 0.6, 2, 2, 0.8);
  }

  // ------------------------------------------------------------------ atualização
  updateGroundColors(vit: number) {
    const g = this.ground.geometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = g.attributes.color as THREE.BufferAttribute;
    const base = new THREE.Color().copy(GRASS_DRY).lerp(GRASS_LUSH, vit);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = fbm(x * 0.045, z * 0.045);
      c.copy(base).multiplyScalar(0.82 + n * 0.36);
      if (y > 1) c.lerp(HILL, Math.min(1, y / 25) * 0.7);
      if (y > 34) c.lerp(ROCK, Math.min(1, (y - 34) / 12));
      const dp = Math.hypot(x - POS.pond.x, z - POS.pond.z);
      if (dp < 10) c.lerp(SAND, 1 - Math.max(0, dp - 8) / 2);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    // árvores
    const tint = new THREE.Color();
    this.trees.forEach((m, ti) => {
      for (let i = 0; i < m.count; i++) {
        const k = this.treeTint[ti][i];
        tint.setRGB(k, k * (0.88 + 0.12 * vit), k * (0.7 + 0.3 * vit));
        m.setColorAt(i, tint);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    this.flowers.count = Math.floor(this.flowerMax * (0.04 + 0.96 * vit));
  }

  refresh() {
    const s = game.s;
    const n = s.parcels.length;
    for (const p of PARCELS) {
      const sign = this.parcelSigns[p.id];
      sign.visible = !owned[p.id];
      if (!owned[p.id]) sign.setText(['TERRENO À VENDA', `${fmt(parcelPrice(n))} · Nv ${parcelLevel(n)}`, p.fert > 1 ? `Solo fértil +${Math.round((p.fert - 1) * 100)}%` : 'Solo comum']);
    }
    this.tractorSign.visible = !lv('tractor');
    const mill = lv('mill') > 0, press = lv('press') > 0;
    this.millGroup.visible = mill; this.millSite.visible = !mill; this.millSign.visible = !mill;
    this.pressGroup.visible = press; this.pressSite.visible = !press; this.pressSign.visible = !press;
    this.siloGroup.scale.y = 1 + 0.07 * lv('silo');
    // aspersores
    const spr = lv('sprinkler') > 0;
    for (const p of PARCELS) {
      let g = this.sprinklers[p.id];
      if (!g) {
        g = new THREE.Group();
        bx(g, 0.12, 1.6, 0.12, 0x777777, 0, 0.8, 0);
        const head = new THREE.Mesh(cyl(0.12, 0.18, 0.2, 6), mat(0x2f7fb8)); head.position.y = 1.7; head.name = 'head'; g.add(head);
        g.position.set(p.x0 + PN * TILE / 2, 0, p.z0 + PN * TILE / 2);
        this.scene.add(g);
        this.sprinklers[p.id] = g;
      }
      g.visible = spr && owned[p.id] === 1;
    }
    while (this.drones.length < lv('robots')) this.makeDrone();
  }

  update(dt: number, camPos: THREE.Vector3, time: number) {
    const s = game.s;
    const vit = vitality(s);
    if (Math.abs(vit - this.gVit) > 0.015) { this.gVit = vit; this.updateGroundColors(vit); }

    // Dia e noite
    const t = s.dayTime;
    const ang = t < 0.7 ? (t / 0.7) * Math.PI : Math.PI + ((t - 0.7) / 0.3) * Math.PI;
    const el = Math.sin(ang);
    this.sunDir.set(Math.cos(ang), el, 0.45).normalize();
    const dayF = THREE.MathUtils.smoothstep(el, -0.08, 0.22);
    const goldF = 1 - THREE.MathUtils.smoothstep(Math.abs(el), 0.0, 0.38);
    this.night = 1 - dayF;
    const top = new THREE.Color().copy(NIGHT_TOP).lerp(DAY_TOP, dayF);
    const hor = new THREE.Color().copy(NIGHT_HOR).lerp(DAY_HOR, dayF).lerp(GOLD, goldF * 0.65 * Math.max(dayF, 0.3));
    const rf = this.rainF;
    top.lerp(RAIN, rf * 0.6 * dayF); hor.lerp(RAIN, rf * 0.6 * dayF);
    this.skyMat.uniforms.top.value.copy(top);
    this.skyMat.uniforms.hor.value.copy(hor);
    this.skyMat.uniforms.sunDir.value.copy(this.sunDir);
    this.skyMat.uniforms.sunCol.value.copy(SUN_DAY).lerp(SUN_GOLD, goldF);
    this.skyMat.uniforms.sunVis.value = dayF * (1 - rf * 0.9);
    (this.scene.fog as THREE.Fog).color.copy(hor);
    (this.scene.fog as THREE.Fog).far = 430 - rf * 200;

    const lightDir = el > -0.05 ? this.sunDir : new THREE.Vector3(-this.sunDir.x, -this.sunDir.y, this.sunDir.z).normalize();
    this.sun.position.copy(camPos).addScaledVector(lightDir, 100);
    this.sun.target.position.copy(camPos);
    this.sun.color.copy(MOON).lerp(new THREE.Color().copy(SUN_DAY).lerp(SUN_GOLD, goldF), dayF);
    this.sun.intensity = (2.7 * dayF + 0.45 * (1 - dayF)) * (1 - rf * 0.5);
    this.hemi.intensity = (0.5 + 1.05 * dayF) * (1 - rf * 0.15);
    this.hemi.color.copy(top).lerp(new THREE.Color(0xffffff), 0.5);
    this.windowMat.emissiveIntensity = this.night * 1.3;
    this.lampMat.emissiveIntensity = this.night * 2;
    this.porch.intensity = this.night * 30;
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, this.night - 0.3) * (1 - rf);
    this.sky.position.copy(camPos);
    this.stars.position.copy(camPos);

    // Clima
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      if (this.rainTarget > 0) { this.rainTarget = 0; this.weatherT = 150 + Math.random() * 200; }
      else if (Math.random() < 0.4) { this.rainTarget = 1; this.weatherT = 40 + Math.random() * 50; }
      else this.weatherT = 90 + Math.random() * 120;
    }
    this.rainF += (this.rainTarget - this.rainF) * Math.min(1, dt * 0.4);
    setRain(this.rainF > 0.3 ? 0.035 * this.rainF : 0);
    this.rain.visible = this.rainF > 0.02;
    if (this.rain.visible) {
      (this.rain.material as THREE.LineBasicMaterial).opacity = this.rainF * 0.55;
      const p = this.rainPos;
      for (let i = 0; i < p.length; i += 6) {
        p[i + 1] -= dt * 22; p[i + 4] -= dt * 22;
        if (p[i + 1] < 0) { p[i + 1] += 30; p[i + 4] += 30; }
      }
      this.rain.position.set(camPos.x, 0, camPos.z);
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    // Nuvens
    for (const c of this.clouds) {
      c.position.x += dt * 2.5;
      if (c.position.x > 380) c.position.x = -380;
      (c.children[0] as THREE.Mesh).scale.setScalar(1 + rf * 0.3);
    }

    // Pássaros
    const showBirds = vit > 0.22 && this.night < 0.6;
    for (const b of this.birds) {
      b.g.visible = showBirds;
      if (!showBirds) continue;
      const a = time * b.sp + b.ph;
      b.g.position.set(Math.cos(a) * b.r, b.h + Math.sin(time * 0.7 + b.ph) * 2, -30 + Math.sin(a) * b.r);
      b.g.rotation.y = -a;
      const f = Math.sin(time * 9 + b.ph) * 0.6;
      b.wl.rotation.z = f; b.wr.rotation.z = -f;
    }
    // Borboletas
    const showFlies = vit > 0.42 && this.night < 0.5 && rf < 0.5;
    for (const f of this.flies) {
      f.g.visible = showFlies;
      if (!showFlies) continue;
      const tt = time * 0.6 + f.ph;
      f.g.position.set(f.base.x + Math.sin(tt) * 3 + Math.sin(tt * 2.3) * 1, 0.7 + Math.sin(tt * 3.1) * 0.35, f.base.z + Math.cos(tt * 0.8) * 3);
      f.g.rotation.y = tt;
      const w = Math.sin(time * 18 + f.ph) * 1.1;
      f.wl.rotation.y = w; f.wr.rotation.y = -w;
    }

    // Moinho
    if (lv('mill')) this.millBlades.rotation.x += dt * (isProcessing('mill') ? 1.6 : 0.4);
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.25;
      if (lv('press') && isProcessing('press')) this.fx.spawn(POS.press.x + 2, 9, POS.press.z + 1.5, 0xbbbbbb, 2, 0.4, 1.5, -0.5, 2.5);
    }
    // Fardos ~ ocupação do silo
    const fill = siloUsed() / siloCap();
    this.bales.forEach((b, i) => { b.visible = fill > (i + 0.5) / this.bales.length; });

    // Aspersores
    this.sprayT -= dt;
    const doSpray = this.sprayT <= 0;
    if (doSpray) this.sprayT = 0.1;
    for (const g of this.sprinklers) {
      if (!g || !g.visible) continue;
      const head = g.getObjectByName('head')!;
      head.rotation.y += dt * 3;
      if (doSpray && camPos.distanceToSquared(g.position) < 3600) {
        const a = head.rotation.y;
        for (let k = 0; k < 2; k++) {
          const aa = a + k * Math.PI;
          this.fx.spawn(g.position.x + Math.cos(aa) * 0.3, 1.8, g.position.z + Math.sin(aa) * 0.3, 0x8fd0ff, 1, 0.1, 2.5, 6, 1.1);
        }
      }
    }
    // Drones
    for (const d of this.drones) {
      d.t -= dt;
      if (d.t <= 0) {
        const t2 = randomRipe();
        const pid = s.parcels[(Math.random() * s.parcels.length) | 0];
        const p = PARCELS[pid];
        if (t2 >= 0) d.target.set(tileX(t2), 3.2, tileZ(t2));
        else d.target.set(p.x0 + Math.random() * 20, 4 + Math.random() * 2, p.z0 + Math.random() * 20);
        d.t = 2 + Math.random() * 2;
      }
      d.g.position.lerp(d.target, Math.min(1, dt * 1.5));
      d.g.position.y += Math.sin(time * 3 + d.t) * 0.01;
      for (const r of d.rotors) r.rotation.y += dt * 40;
    }
  }
}
