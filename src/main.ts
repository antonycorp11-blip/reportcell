import './style.css';
import * as THREE from 'three';
import { CROPS, HAND_TOOLS, IMPLEMENTS, UPMAP, GOALS, upCost } from './data';
import { game, bus, load, newState, save, wipe, fmt, lv, sk, canCap, implWidth, tractorSpeed, walkSpeed, earn, spend, siloCap, siloUsed, legacyGain, type State } from './state';
import * as farm from './farm';
import { FarmView, tileX, tileZ, isOwned, T, PARCELS } from './farm';
import { World, POS, parcelPrice, parcelLevel, parcelSignPos } from './world';
import { FX } from './fx';
import { Player } from './player';
import { Tractor } from './tractor';
import { input, initInput, moveVec, consume, holdButton, press } from './input';
import { initAudio, setSound, sfx, engine } from './audio';
import { simStep, sell, sellAll, deliver } from './economy';
import { resolve } from './physics';
import { uTime, addOutlines } from './gfx';
import * as ui from './ui';
import { Life } from './life';
import { learn, NMAP } from './skills';
import { Horde, ZDEF, eyeMat as zEyeMat, type Zombie, type ZKind } from './zombies';
import { Defense } from './defense';
import { LaneView, LMAP, lanesFor } from './lanes';
import { Creatures } from './creatures';
import { faceMats } from './zmodels';
import { Minimap } from './minimap';
import { Post } from './post';
import { House, plankHp, maxPlanks } from './house';
import { Family, FAMILY, type Who } from './family';
import { icon, RES } from './icons';
import { Walls, WALLS } from './walls';
import { rng } from './gfx';
import { colliders } from './physics';
import { baseMax, playerMax, addXp, dayLen, diffK, pct } from './state';
import { recalcStats } from './skills';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

let s: State = load() ?? newState();
game.s = s;
const q = s.settings.quality;
const high = q === 'high' || (q === 'auto' && !isTouch);

// ------------------------------------------------------------------ renderização
const renderer = new THREE.WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = high ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(isTouch ? 72 : 70, window.innerWidth / window.innerHeight, 0.08, 1300);
scene.add(camera);
const vmScene = new THREE.Scene();
const vmHemi = new THREE.HemisphereLight(0xffffff, 0x667744, 1.5);
const vmSun = new THREE.DirectionalLight(0xffffff, 2);
vmScene.add(vmHemi, vmSun, vmSun.target);

const post = new Post(renderer, scene, vmScene, camera, high);
const fx = new FX(scene);
const world = new World(scene, fx, high);
const view = new FarmView(scene, high);
const player = new Player(camera);
vmScene.add(player.view);
const tractor = new Tractor(scene);
const life = new Life(scene, fx);
addOutlines(scene);
life.onUnlock = (name) => { if (playing) { ui.banner('✨ A fazenda evoluiu!', name); sfx.level(); } };
const horde = new Horde(scene, fx);
const defense = new Defense(scene, horde, fx);
const laneView = new LaneView(scene);
const house = new House(scene, fx, horde);
const family = new Family(scene, fx);
house.onBreak = (e) => { ui.toast(`🚨 ${e.name} arrombada! Pregue tábuas (1 madeira cada)`, 'warn'); sfx.scream(); };
const creatures = new Creatures(scene, fx, high);
creatures.aim = (t) => (defense.hasAim[t] ? { x: defense.aimX[t], z: defense.aimZ[t] } : null);
creatures.charge = defense.charge;
const walls = new Walls(scene, fx);
const minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement);
// lanterna (segue a câmera) — ilumina a noite
const flashlight = new THREE.SpotLight(0xfff4dd, 0, 45, 0.55, 0.55, 1.2);
scene.add(flashlight, flashlight.target);
let buildType = 0;
interface WaveEntry { kind: ZKind; lane: string }
let plan: { list: WaveEntry[]; mod: string | null; counts: Record<string, number>; kinds: Record<string, number> } = { list: [], mod: null, counts: {}, kinds: {} };
let nightMod: string | null = null, baseAtDusk = 0;
defense.ctx = {
  kill: (z, by) => onKill(z, by),
  boom: (x, z) => boom(x, z),
  shot: (k) => { if (shotT <= 0) { shotT = 0.07; sfx.shoot(k === 4 ? 1 : k); } },
  levelUp: (t, lvl) => {
    const x = tileX(t), z = tileZ(t);
    fx.spawn(x, 2, z, 0xffd23f, 30, 1.5, 5, 5, 1.2);
    if (camera.position.distanceToSquared(new THREE.Vector3(x, 0, z)) < 2500) ui.float3d(`⭐ ${CROPS[T.c[t]].def} nível ${lvl + 1}!`, new THREE.Vector3(x, 2.8, z), camera, 'money');
    sfx.combo();
  },
};
let playerHp = 100, hurtT = 10, deadT = 0, over = false, shotT = 0, baseAlertT = 0, groanT = 3, shake = 0;
let spawnQueue: WaveEntry[] = [], spawnT = 0, waveTotal = 0, visDay = 0.1;

// ------------------------------------------------------------------ estado inicial
function applyState() {
  s = game.s;
  farm.deserialize(s.tiles);
  farm.syncOwned();
  world.refresh();
  tractor.setPose(s.tx, s.tz, s.tyaw);
  tractor.group.visible = lv('tractor') > 0;
  tractor.setMode(s.implement, implWidth());
  player.pos.set(s.px, 0, s.pz);
  player.yaw = s.yaw;
  if (s.tool === 5 && !lv('multi')) s.tool = 0;
  playerHp = playerMax();
  if (s.phase === 'night') { s.phase = 'day'; s.phaseT = 20; }
  horde.clear(); defense.reset();
  walls.load(s.walls);
  if (!s.entries || s.entries.length !== house.entries.length) house.repairAll();
  house.refresh();
  family.comeOut();
  recalcStats();
  planNext();
  player.setTool(s.tool);
  if (!hasWeapon(s.weapon)) s.weapon = 'pa';
  player.setWeapon(s.weapon);
  if (s.inTractor && !lv('tractor')) s.inTractor = false;
  player.showTool(!s.inTractor);
  ui.invalidateBars();
  ui.renderToolbar(s.inTractor);
  updateActionIcon();
  ui.updateHud();
}

function doSave() {
  if (wiped) return;
  s.px = player.pos.x; s.pz = player.pos.z; s.yaw = player.yaw;
  s.walls = walls.serialize();
  s.tx = tractor.group.position.x; s.tz = tractor.group.position.z; s.tyaw = tractor.yaw;
  save(farm.serialize());
}
let wiped = false;

// ------------------------------------------------------------------ progresso offline
let offline = false;
function runSim(seconds: number, chunk: number) {
  offline = true;
  let t = seconds;
  while (t > 0) { const d = Math.min(chunk, t); simStep(d); t -= d; }
  offline = false;
}

let welcome = '';
function offlineProgress() {
  const el = Math.min((Date.now() - s.saved) / 1000, 4 * 3600);
  if (!s.tiles || el < 30) return;
  const m0 = s.money, h0 = s.stats.harvested, inv0 = siloUsed(), x0 = s.level;
  runSim(el, 2);
  const mins = Math.round(el / 60);
  const lines: string[] = [];
  lines.push(`<p>Você ficou fora por <b>${mins >= 60 ? (mins / 60).toFixed(1).replace('.', ',') + ' h' : mins + ' min'}</b>. Enquanto isso:</p><ul class="wb">`);
  lines.push('<li>🌱 Suas plantações continuaram crescendo</li>');
  if (s.stats.harvested > h0) lines.push(`<li>🤖 Os drones colheram <b>${s.stats.harvested - h0}</b> canteiros</li>`);
  if (siloUsed() > inv0) lines.push(`<li>🏚️ O silo ganhou <b>+${siloUsed() - inv0}</b> itens</li>`);
  if (s.money > m0) lines.push(`<li>💰 Você ganhou <b>${fmt(s.money - m0)}</b></li>`);
  if (s.level > x0) lines.push(`<li>⭐ Subiu para o nível <b>${s.level}</b></li>`);
  lines.push('</ul>');
  welcome = lines.join('');
}

// ------------------------------------------------------------------ ações
function updateActionIcon() {
  if (s.inTractor) ui.setActionIcon(workOn ? '⬆️' : '⬇️');
  else ui.setActionIcon(HAND_TOOLS[s.tool].icon);
}

let workOn = true;

function buyUpgrade(id: string) {
  const u = UPMAP[id];
  const l = lv(id);
  if (l >= u.max) return;
  const lock = u.req?.(s);
  if (lock) { ui.toast('🔒 ' + lock, 'warn'); sfx.error(); return; }
  const cost = upCost(u, l);
  if (!spend(cost)) { ui.toast(`💸 Faltam ${fmt(cost - s.money)}`, 'warn'); sfx.error(); return; }
  s.up[id] = l + 1;
  sfx.buy();
  world.refresh();
  if (id === 'tractor') {
    tractor.setPose(POS.tractor.x, POS.tractor.z, 0);
    tractor.group.visible = true;
    ui.banner('🚜 Trator comprado!', 'Entre nele no pátio para arar, plantar e colher fileiras inteiras');
    fx.spawn(POS.tractor.x, 2, POS.tractor.z, 0xffd23f, 40, 3, 6, 6, 1.4);
  } else if (id === 'mill') {
    ui.banner('🌬️ Moinho construído!', 'Trigo no silo vira farinha automaticamente');
    fx.spawn(POS.mill.x, 6, POS.mill.z, 0xffffff, 50, 5, 5, 4, 1.5);
  } else if (id === 'press') {
    ui.banner('🏭 Prensa construída!', 'Girassóis viram óleo premium');
    fx.spawn(POS.press.x, 6, POS.press.z, 0xffd23f, 50, 5, 5, 4, 1.5);
  } else if (id === 'robots' && l === 0) ui.banner('🤖 Era da Automação!', 'Drones colhem por você — até offline');
  else if (id === 'multi') ui.banner('✨ Kit Multiuso!', 'A ferramenta faz a ação certa em cada canteiro');
  else ui.toast(`${u.icon} ${u.name} → nível ${l + 1}`, 'good');
  if (id === 'robots') world.refresh();
  if (id === 'width') tractor.setMode(s.implement, implWidth());
  if (id === 'can') s.can = canCap();
  ui.invalidateBars();
  ui.renderToolbar(s.inTractor);
  ui.pulse('money');
}

function buyParcel(id: number) {
  if (farm.owned[id]) return;
  if (!farm.isNextParcel(id)) { ui.toast('🚧 Construa ao lado de uma área que você já tem', 'warn'); return; }
  const n = s.parcels.length;
  const need = parcelLevel(n);
  if (s.level < need) { ui.toast(`🔒 Requer nível ${need}`, 'warn'); sfx.error(); return; }
  const cost = parcelPrice(n);
  if (!spend(cost)) { ui.toast(`💸 Faltam ${fmt(cost - s.money)}`, 'warn'); sfx.error(); return; }
  s.parcels.push(id);
  farm.appear[id] = 0;
  farm.syncOwned();
  world.refresh();
  sfx.buy();
  const p = parcelSignPos(id);
  for (let k = 0; k < 6; k++) fx.spawn(PARCELS[id].x0 + 3 + k * 3, 1, PARCELS[id].z0 + 10, 0xb08a5a, 25, 4, 4, 8, 1.2);
  fx.spawn(p.x, 2, p.z - 5, 0x9dff7a, 60, 6, 5, 5, 1.6);
  ui.banner('🏗️ Expansão construída!', `+100 canteiros${PARCELS[id].fert > 1 ? ` · solo fértil +${Math.round((PARCELS[id].fert - 1) * 100)}%` : ''}`);
}

function moneyFloat(g: number, big = false) {
  ui.floatAt('+' + fmt(g), window.innerWidth / 2, window.innerHeight * 0.4, big ? 'money big' : 'money');
  ui.pulse('money');
  sfx.coin();
}

function prestige() {
  const gain = legacyGain(s);
  if (s.level < 12 || gain <= 0) return;
  if (!confirm(`Plantar seu Legado? A fazenda recomeça, mas você ganha +${gain} pontos de legado permanentes.`)) return;
  const ns = newState(s.legacy + gain, s.prestiges + 1, s.settings);
  game.s = ns;
  farm.resetTiles();
  ns.tiles = farm.serialize();
  applyState();
  ui.closePanel();
  sfx.level();
  ui.banner('🌳 Legado plantado!', `Legado ${ns.legacy} · +${ns.legacy * 10}% preços · Era Tecnológica`);
  doSave();
}

ui.initUI({
  buy: buyUpgrade,
  buyParcel,
  sell(id) { const g = sell(id); if (g) moneyFloat(g); },
  sellAll() { const g = sellAll(); if (g) moneyFloat(g, true); },
  deliver() { const g = deliver(); if (g) { moneyFloat(g, true); ui.toast('📦 Pedido entregue!', 'good'); } },
  prestige,
  learn(id) {
    if (!learn(id)) { sfx.error(); return; }
    sfx.buy();
    ui.toast(`${NMAP[id].icon} ${NMAP[id].name} desbloqueado!`, 'good');
    tractor.setMode(s.implement, implWidth());
    fx.spawn(player.pos.x, 2, player.pos.z, 0xffd23f, 25, 1.5, 5, 6, 1.2);
    hudDirty = true;
  },
  toggleCam,
  aerial: toggleAerial,
  zoom: (d: number) => { aer.th = Math.max(22, Math.min(140, aer.th * (d > 0 ? 1.25 : 0.8))); },
  tool: selectTool,
  wall(i) { buildType = i; if (aerial) ui.toast(`Toque no mapa para construir · ${WALLS[i].icon} ${WALLS[i].name} · ${resTxt(WALLS[i].cost)}`); sfx.click(); ui.renderCropbar(s.inTractor, buildType); ui.toast(`${WALLS[i].icon} <b>${WALLS[i].name}</b> · ${resTxt(WALLS[i].cost)} · ${WALLS[i].desc}`); },
  crop(i) { if (s.level >= CROPS[i].level) { s.crop = i; sfx.click(); ui.renderCropbar(s.inTractor); ui.toast(`${CROPS[i].icon} <b>${CROPS[i].def}</b> · ${CROPS[i].role}`); } },
  startNight: () => startNight(),
  npc: (v: string) => npcAction(v),
  weapon: (id: string) => { if (!hasWeapon(id)) return; s.weapon = id; player.setWeapon(id); sfx.click(); ui.renderCropbar(s.inTractor); ui.toast(`${WEAPONS[id].name} · ${WEAPONS[id].desc}`); },
  restart: () => restart(),
  open() { input.enabled = false; input.action = false; if (document.pointerLockElement) document.exitPointerLock(); },
  close() { input.enabled = true; if (!isTouch && playing) canvas.requestPointerLock?.(); },
  setting(k, v) {
    if (k === 'sound') { s.settings.sound = !!v; setSound(!!v); }
    if (k === 'diff') { s.settings.diff = v as 'easy' | 'normal' | 'hard'; planNext(); ui.toast('💀 Dificuldade alterada — vale a partir da próxima noite'); }
    if (k === 'quality') { s.settings.quality = v as State['settings']['quality']; doSave(); location.reload(); }
  },
  reset() { wiped = true; wipe(); location.reload(); },
  fullscreen: toggleFullscreen,
});

function selectTool(i: number) {
  if (s.inTractor) {
    if (i >= IMPLEMENTS.length) return;
    s.implement = i;
    tractor.setMode(i, implWidth());
  } else {
    if (i >= HAND_TOOLS.length || (i === 5 && !lv('multi'))) return;
    s.tool = i;
    player.setTool(i);
  }
  sfx.click();
  ui.renderToolbar(s.inTractor);
  updateActionIcon();
}

function toggleCam() {
  if (!s.inTractor) return;
  s.tpCam = !s.tpCam;
  camSnap = true;
  player.pitch = -0.25;
  tractor.headYaw = 0;
  ui.toast(s.tpCam ? '🎥 Câmera em terceira pessoa' : '🎥 Câmera na cabine');
  sfx.click();
}

// ------------------------------------------------------------------ visão aérea
let aerial = false;
const aer = { x: 0, z: -20, h: 70, tx: 0, tz: -20, th: 70 };
function toggleAerial() {
  if (!playing || over) return;
  aerial = !aerial;
  document.body.classList.toggle('aerial', aerial);
  if (aerial) {
    aer.tx = aer.x = player.pos.x * 0.5 - 4; aer.tz = aer.z = (player.pos.z - 12) * 0.5 - 8;
    aer.th = 62; aer.h = 30;
    input.action = false;
    if (document.pointerLockElement) document.exitPointerLock();
    ui.invalidateBars(); ui.renderCropbar(false, buildType);
    ui.toast(isTouch ? '🦅 Visão aérea · arraste para mover · ➕➖ zoom' : '🦅 Visão aérea · mouse/WASD movem · roda dá zoom · Q volta', 'good');
  } else {
    player.pitch = -0.25;
    camSnap = true;
    aerialMarks.count = 0;
    ui.invalidateBars(); ui.renderToolbar(s.inTractor);
    if (!isTouch) canvas.requestPointerLock?.();
  }
  sfx.click();
}

/** Constrói a barricada selecionada no ponto tocado (visão aérea). */
function aerialTap(sx: number, sy: number) {
  const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera);
  const d = rc.ray.direction; if (d.y >= -0.01) return;
  const t = -camera.position.y / d.y;
  const x = Math.round(camera.position.x + d.x * t), z = Math.round(camera.position.z + d.z * t);
  const other = walls.at(x, z, 1.6);
  if (other) { buildPt.set(other.x, 0, other.z); const W0 = WALLS[other.type]; if (other.hp >= W0.hp) { ui.toast('🧱 Já está inteira'); return; } if (!payRes({ wood: 1 })) return; other.hp = W0.hp; sfx.plow(); ui.toast('🔨 Reparado · 1 madeira'); return; }
  let blocked = false;
  for (const b of colliders.boxes) { if (b.on && !b.on()) continue; if (x > b.x1 - 1 && x < b.x2 + 1 && z > b.z1 - 1 && z < b.z2 + 1) blocked = true; }
  for (const c of colliders.circles) { if (c.on && !c.on()) continue; if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 1) ** 2) blocked = true; }
  if (blocked || Math.abs(x) > 92 || z < -95 || z > 60) { ui.toast('🚫 Não dá para construir aqui', 'warn'); sfx.error(); return; }
  const W = WALLS[buildType];
  if (s.level < W.level) { ui.toast(`🔒 ${W.name} requer nível ${W.level}`, 'warn'); return; }
  if (!payRes(W.cost)) return;
  // vira de frente para a rota mais próxima
  let best = Infinity, rot = 0;
  for (const id in LMAP) { const P = LMAP[id].pts; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1]; const vx = bx - ax, vz = bz - az; const L = vx * vx + vz * vz; const u = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L)); const dd = (ax + vx * u - x) ** 2 + (az + vz * u - z) ** 2; if (dd < best) { best = dd; rot = -Math.atan2(vx, -vz); } } }
  walls.add(buildType, x, z, best < 100 ? rot : 0);
  sfx.plow();
  fx.spawn(x, 0.5, z, 0x9a6a3c, 14, 1.5, 3, 9, 0.7);
}
function aerialInput(dt: number, mx: number, my: number) {
  const k = aer.h / 480;
  const px = input.touch ? 1 / 0.0055 : 1 / 0.0022;
  aer.tx -= input.lookX * px * k;
  aer.tz -= input.lookY * px * k;
  aer.tx += mx * dt * aer.h * 0.8;
  aer.tz -= my * dt * aer.h * 0.8;
  if (input.pinch) { aer.th = Math.max(22, Math.min(140, aer.th * Math.exp(-input.pinch * 1.2))); input.pinch = 0; }
  if (consume('Tap')) aerialTap(input.tapX, input.tapY);
  aer.tx = Math.max(-95, Math.min(95, aer.tx));
  aer.tz = Math.max(-100, Math.min(60, aer.tz));
}
const aerialMarks = new THREE.InstancedMesh(new THREE.RingGeometry(0.55, 1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.85, depthTest: false }), 200);
aerialMarks.count = 0; aerialMarks.frustumCulled = false; aerialMarks.renderOrder = 30;
scene.add(aerialMarks);
function aerialCamera(dt: number) {
  const mm = new THREE.Matrix4(); let n = 0; const k = aer.h / 45;
  for (const z of horde.list) { if (z.dead || n >= 200) continue; const sc = k * (z.kind === 'colossus' ? 2.2 : z.kind === 'brute' ? 1.4 : 1) * (1 + Math.sin(realTime * 6) * 0.08); mm.makeScale(sc, 1, sc).setPosition(z.g.position.x, z.kind === 'crow' ? 3.4 : 0.15, z.g.position.z); aerialMarks.setMatrixAt(n++, mm); }
  aerialMarks.count = n; aerialMarks.instanceMatrix.needsUpdate = true;
  const f = 1 - Math.exp(-dt * 6);
  aer.x += (aer.tx - aer.x) * f; aer.z += (aer.tz - aer.z) * f; aer.h += (aer.th - aer.h) * f;
  camera.position.set(aer.x, aer.h, aer.z + aer.h * 0.38);
  camera.lookAt(aer.x, 0, aer.z);
}

function toggleFullscreen() {
  const d = document as any;
  if (document.fullscreenElement || d.webkitFullscreenElement) (document.exitFullscreen || d.webkitExitFullscreen)?.call(document);
  else {
    const el = document.documentElement as any;
    const r = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' });
    Promise.resolve(r).then(() => (screen.orientation as any)?.lock?.('landscape')).catch(() => { /* */ });
  }
}

// ------------------------------------------------------------------ alvo e ferramentas
const ray = new THREE.Vector3();
function targetTile(): number {
  camera.getWorldDirection(ray);
  if (ray.y < -0.08) {
    const d = -camera.position.y / ray.y;
    if (d < 6.5) {
      const t = farm.tileAt(camera.position.x + ray.x * d, camera.position.z + ray.z * d);
      if (t >= 0) return t;
    }
  }
  const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
  return farm.tileAt(player.pos.x + fwdX * 2.3, player.pos.z + fwdZ * 2.3);
}

function smartAction(t: number): number {
  const st = T.s[t];
  if (st === 0 || st === 3) return 0;
  if (st === 1) return 1;
  if (st === 2 && T.g[t] >= 1) return 3;
  if (st === 2 && T.w[t] < 0.5 && s.can > 0) return 2;
  return -1;
}

let combo = 0, lastHarvest = -10, realTime = 0, soundT = 0;
const comboMult = () => 1 + Math.min(combo, 30) * 0.02;
const tp = new THREE.Vector3();

function harvestTile(t: number): boolean {
  const r = farm.harvest(t, comboMult());
  if (r === 'full') { ui.toast('🏚️ Silo cheio! Venda no Mercado 📈 ou amplie o silo', 'warn'); return false; }
  if (!r) return false;
  combo = realTime - lastHarvest < 1.7 ? combo + 1 : 1;
  lastHarvest = realTime;
  if (combo > s.stats.maxCombo) s.stats.maxCombo = combo;
  ui.setCombo(combo);
  const C = CROPS[r.c];
  const x = tileX(t), z = tileZ(t);
  fx.spawn(x, 0.8, z, 0xffd23f, 10, 1.2, 4, 7, 0.9);
  fx.spawn(x, 0.5, z, 0x9fd65a, 6, 1.5, 3, 9, 0.7);
  ui.float3d(`+${r.units} ${C.icon}`, tp.set(x, 1.4, z), camera, 'crop');
  if (r.gold) { ui.float3d('✨ SAFRA DOURADA ×5!', tp.set(x, 2.4, z), camera, 'money'); fx.spawn(x, 1, z, 0xffd700, 30, 2, 6, 6, 1.2); sfx.combo(); }
  if (r.rot && Math.random() < 0.5) ui.float3d('♻️ Rotação +fertilidade', tp.set(x, 2.1, z), camera, 'rot');
  if (soundT <= 0) { sfx.harvest(combo); soundT = 0.06; }
  if (combo % 10 === 0) {
    const bonus = Math.round(combo * 1.5 * s.level * (1 + sk('c4')));
    earn(bonus);
    ui.floatAt(`COMBO ×${combo}! +${fmt(bonus)}`, window.innerWidth / 2, window.innerHeight * 0.32, 'money big');
    sfx.combo();
  }
  return true;
}

function applyTool(t: number, action: number, fromTractor: boolean): boolean {
  const x = tileX(t), z = tileZ(t);
  switch (action) {
    case 0:
      if (!farm.plow(t)) return false;
      fx.spawn(x, 0.2, z, 0x6b4426, fromTractor ? 4 : 9, 1.2, 3, 9, 0.7);
      return true;
    case 1: {
      const r = farm.plant(t, s.crop);
      if (r === 'money') { ui.toast(`💸 Sem dinheiro para sementes de ${CROPS[s.crop].name}`, 'warn'); return false; }
      if (r !== 'ok') return false;
      fx.spawn(x, 0.3, z, 0x8fdc5a, fromTractor ? 3 : 6, 0.8, 2, 8, 0.6);
      return true;
    }
    case 2:
      if (!fromTractor && s.can <= 0) { ui.toast('🪣 Regador vazio! Encha no poço', 'warn'); return false; }
      if (!farm.water(t)) return false;
      if (!fromTractor) s.can--;
      fx.spawn(x, 0.9, z, 0x6fc3ff, fromTractor ? 4 : 10, 1.2, 1.5, 9, 0.7);
      return true;
    case 3:
      return harvestTile(t);
  }
  return false;
}

const actionSfx = [sfx.plow, sfx.plant, sfx.water, () => { /* colheita tem som próprio */ }];
let cooldown = 0, canAcc = 0;
function useHand() {
  if (s.tool === 4) { attack(); return; }
  if (s.tool === 6) { build(); return; }
  const t0 = targetTile();
  if (t0 < 0) return;
  if (!isOwned(t0)) { ui.toast('🪧 Este terreno está à venda — compre na placa'); cooldown = 0.5; return; }
  const tiles = farm.area(t0, lv('tool'));
  const done = new Set<number>();
  for (const t of tiles) {
    const a = s.tool === 5 ? smartAction(t) : s.tool;
    if (a < 0) continue;
    if (applyTool(t, a, false)) done.add(a);
  }
  if (done.size) {
    player.use();
    for (const a of done) actionSfx[a]();
    cooldown = (s.tool === 3 ? 0.16 : s.tool === 2 ? 0.2 : 0.26) / pct('tool');
    bus.emit('hud');
  } else cooldown = 0.12;
}

function tileInfo(t: number): string {
  if (t < 0) return '';
  if (!isOwned(t)) return '🔒 Terreno à venda';
  const st = T.s[t];
  const fert = T.f[t] !== 1 ? ` · 🌱×${T.f[t].toFixed(2).replace('.', ',')}` : '';
  const w = ` · 💧${Math.round(T.w[t] * 100)}%`;
  if (st === 0) return '🌿 Mato — use a enxada ⛏️' + fert;
  if (st === 3) return '🌾 Restolho — are de novo ⛏️' + fert;
  if (st === 1) return '🟫 Solo arado — plante 🌱' + w + fert;
  const C = CROPS[T.c[t]];
  if (T.g[t] >= 1) return s.phase === 'night' ? `${C.icon} ${C.def} · ❤️ ${Math.ceil(T.h[t])}` : `✅ ${C.icon} ${C.def} pronto · colha 💰 ou deixe defender 🌙`;
  return `${C.icon} ${C.name} ${Math.floor(T.g[t] * 100)}%${w}${T.w[t] < 0.1 ? ' · com sede!' : ''}${fert}`;
}

// ------------------------------------------------------------------ trator
function enterTractor() {
  s.inTractor = true;
  tractor.headYaw = 0;
  camOrbit = 0; camSnap = true;
  document.body.classList.add('inTractor');
  player.pitch = -0.25;
  player.showTool(false);
  sfx.door();
  engine(true, 0);
  ui.renderToolbar(true);
  updateActionIcon();
  ui.updateHud();
  if (!seenTractorTip) { seenTractorTip = true; ui.toast(isTouch ? '🚜 Joystick: acelera e vira · ⬆️/⬇️ ergue/baixa o implemento' : '🚜 W/S acelera · A/D vira · clique ergue/baixa o implemento', 'good'); }
}
let seenTractorTip = false;

function exitTractor() {
  s.inTractor = false;
  document.body.classList.remove('inTractor');
  const p = tractor.group.localToWorld(new THREE.Vector3(-2.4, 0, 0.6));
  player.pos.set(p.x, 0, p.z);
  resolve(player.pos, 0.4);
  player.yaw = s.tpCam ? tractor.yaw : tractor.yaw + tractor.headYaw;
  player.pitch = -0.3;
  player.showTool(true);
  sfx.door();
  engine(false);
  ui.renderToolbar(false);
  updateActionIcon();
  ui.updateHud();
}

// ------------------------------------------------------------------ interações
interface Inter { pos: () => THREE.Vector3; r: number; label: () => string | null; act: () => void }
const millSignPos = POS.mill.clone().add(new THREE.Vector3(4.5, 0, 0));
const pressSignPos = POS.press.clone().add(new THREE.Vector3(-5.5, 0, 0));
const houseDoor = new THREE.Vector3(-11, 0, 12);
const inters: Inter[] = [
  { pos: () => POS.well, r: 3, label: () => (s.can < canCap() ? 'Encher regador 💧' : null), act: () => { s.can = canCap(); sfx.fill(); fx.spawn(POS.well.x, 1.2, POS.well.z, 0x6fc3ff, 20, 1, 3, 8, 0.8); ui.updateHud(); } },
  { pos: () => POS.market, r: 3.2, label: () => 'Abrir mercado 📈', act: () => ui.openPanel('market') },
  { pos: () => tractor.group.position, r: 3.8, label: () => (lv('tractor') ? 'Entrar no trator 🚜' : null), act: enterTractor },
  { pos: () => POS.tractor, r: 3, label: () => (lv('tractor') ? null : `Comprar trator ${fmt(upCost(UPMAP.tractor, 0))}`), act: () => buyUpgrade('tractor') },
  { pos: () => millSignPos, r: 3.5, label: () => (lv('mill') ? null : `Construir moinho ${fmt(upCost(UPMAP.mill, 0))}`), act: () => buyUpgrade('mill') },
  { pos: () => pressSignPos, r: 3.5, label: () => (lv('press') ? null : `Construir prensa ${fmt(upCost(UPMAP.press, 0))}`), act: () => buyUpgrade('press') },
  { pos: () => houseDoor, r: 3.2, label: () => (s.phase === 'day' && !over ? 'Começar a noite 🌙' : null), act: () => startNight() },
  ...house.entries.map((e, i): Inter => {
    const sp = house.spot(i);
    const pos = new THREE.Vector3(sp.x + e.nx * 0.6, 0, sp.z + e.nz * 0.6);
    return { pos: () => pos, r: 2.4, label: () => { const n = Math.ceil(house.hp(i) / plankHp() - 0.001), m = maxPlanks(e); return n < m ? `🔨 Pregar tábua ${n}/${m} · 1 madeira` : null; }, act: () => { if (!payRes({ wood: 1 })) return; house.repair(i); player.use(); sfx.plow(); } };
  }),
  ...(['ana', 'bia', 'leo', 'ze'] as Who[]).map((who): Inter => ({
    pos: () => family.get(who).g.position, r: 2.6,
    label: () => (family.get(who).state === 'day' || family.get(who).state === 'out' ? `💬 Falar com ${FAMILY[who].name}` : null),
    act: () => openNpc(who),
  })),
  ...PARCELS.map((p): Inter => {
    const pos = parcelSignPos(p.id);
    return { pos: () => pos, r: 3.2, label: () => (farm.isNextParcel(p.id) ? `🏗️ Construir expansão ${fmt(parcelPrice(s.parcels.length))}` : null), act: () => buyParcel(p.id) };
  }),
];


let currentInter: Inter | null = null;
function findInter() {
  if (s.inTractor) { currentInter = null; ui.setInteract(Math.abs(tractor.speed) < 1.5 ? 'Sair do trator' : null, isTouch); return; }
  let best: Inter | null = null, bd = Infinity, label: string | null = null;
  for (const it of inters) {
    const p = it.pos();
    const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    if (d < it.r && d < bd) { const l = it.label(); if (l) { best = it; bd = d; label = l; } }
  }
  currentInter = best;
  ui.setInteract(label, isTouch);
}

// ------------------------------------------------------------------ eventos
bus.on('level', (l: number) => {
  const reward = l * 25;
  s.money += reward; s.totalEarned += reward;
  ui.invalidateBars();
  if (offline) return;
  const unlocks = CROPS.filter((c) => c.level === l).map((c) => `${c.icon} ${c.def}`);
  ui.banner(`⭐ Nível ${l}!`, `+${fmt(reward)} · +1 ponto de habilidade ⭐${unlocks.length ? ' · Desbloqueado: ' + unlocks.join(', ') : ' · Novas melhorias na loja'}`);
  sfx.level();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    fx.spawn(player.pos.x + Math.cos(a) * 3, 2.5, player.pos.z + Math.sin(a) * 3, [0xffd23f, 0xff8fbf, 0x7fc8ff, 0x9dff7a][i % 4], 12, 1.5, 6, 6, 1.6);
  }
  world.refresh();
  ui.renderToolbar(s.inTractor);
});
let hudDirty = true;
bus.on('hud', () => { hudDirty = true; });
bus.on('order', () => { if (!offline) ui.toast('📦 Novo pedido especial no mercado!'); });

// ------------------------------------------------------------------ apocalipse: ondas, combate e sobrevivência
const MODS: Record<string, { name: string; desc: string }> = {
  boss: { name: '💀 Noite do Colosso', desc: 'um chefe gigante vem pelo norte' },
  blood: { name: '🌕 Lua de Sangue', desc: 'zumbis 30% mais rápidos · recompensa ×1,5' },
  fog: { name: '🌫️ Neblina', desc: 'visão curta · zumbis vêm em silêncio' },
  double: { name: '👥 Horda Dupla', desc: '60% mais zumbis · recompensa ×1,5' },
};
const KIND_ICON: Record<string, string> = { walker: '🧟', runner: '🏃', brute: '💪', digger: '⛏️', crow: '🐦‍⬛', colossus: '💀' };

function planWave(n: number) {
  const r = rng(n * 7919 + s.prestiges * 131 + 7);
  const lanes = lanesFor(n);
  const mod = n % 5 === 0 ? 'boss' : n % 4 === 0 ? 'blood' : n % 6 === 3 ? 'fog' : n >= 6 && n % 7 === 6 ? 'double' : null;
  const total = Math.min(220, Math.round((12 + n * 6 + n * n * 0.25) * (mod === 'double' ? 1.6 : 1) * diffK()[0]));
  const list: WaveEntry[] = [];
  const newest = lanes[lanes.length - 1];
  for (let i = 0; i < total; i++) {
    const v = r();
    let kind: ZKind = 'walker';
    if (v < 0.15 + Math.min(0.1, n * 0.02)) kind = 'runner';
    else if (n >= 2 && v < 0.3) kind = 'brute';
    else if (n >= 3 && v < 0.4) kind = 'digger';
    else if (n >= 4 && v < 0.52) kind = 'crow';
    // rota nova recebe parte maior na noite em que abre
    const lane = newest.unlock === n && r() < 0.5 ? newest : lanes[Math.floor(r() * lanes.length)];
    list.push({ kind, lane: lane.id });
  }
  if (mod === 'boss') for (let b = 0; b < n / 5; b++) list.splice(Math.floor(total * (0.5 + b * 0.1)), 0, { kind: 'colossus', lane: 'n1' });
  const counts: Record<string, number> = {}, kinds: Record<string, number> = {};
  for (const e of list) { counts[e.lane] = (counts[e.lane] || 0) + 1; kinds[e.kind] = (kinds[e.kind] || 0) + 1; }
  return { list, mod, counts, kinds };
}

function planNext() {
  const n = s.nights + 1;
  plan = planWave(n);
  laneView.set(plan.counts, false);
  const lanes = Object.keys(plan.counts).map((id) => `${LMAP[id].arrow}<b>${plan.counts[id]}</b>`).join(' ');
  void KIND_ICON;
  const newLane = lanesFor(n).find((l) => l.unlock === n && n > 1);
  const mod = plan.mod ? ` · <span class="pmod">${MODS[plan.mod].name}</span>` : '';
  ui.setPreview(`🧟 ${lanes}${newLane ? ` <span class="pnew">nova rota ${newLane.arrow}</span>` : ''}${mod}`);
}

function laneOf(path: [number, number][]): string | null { for (const id in LMAP) if (LMAP[id].pts === path) return id; return null; }

function spawnOne(e: WaveEntry) {
  const n = s.nights + 1;
  const lane = LMAP[e.lane];
  const [x, z] = lane.pts[0];
  horde.spawn(e.kind, x + (Math.random() - 0.5) * 4, z + (Math.random() - 0.5) * 4, (1 + 0.2 * (n - 1)) * diffK()[1], lane.pts);
}

function startNight() {
  if (s.phase === 'night' || over) return;
  world.danger = 0;
  document.body.classList.remove('warn');
  if (s.phaseT > 5) {
    const bonus = Math.round(s.phaseT * (1 + s.nights * 0.6));
    earn(bonus);
    ui.toast(`⏩ Bônus de coragem: +${fmt(bonus)}`, 'good');
  }
  s.phase = 'night';
  const n = s.nights + 1;
  nightLoot = {};
  family.runHome();
  spawnQueue = [...plan.list];
  waveTotal = spawnQueue.length;
  nightMod = plan.mod;
  baseAtDusk = s.baseHp;
  laneView.set(plan.counts, true);
  ui.setPreview('');
  eyeTint();
  spawnT = 3;
  ui.closePanel();
  ui.banner(`🌙 Noite ${n}`, nightMod ? `${MODS[nightMod].name} · ${waveTotal} zumbis` : `${waveTotal} zumbis a caminho · suas plantas ganharam vida!`);
  sfx.night();
  hudDirty = true;
}

function endNight() {
  family.comeOut();
  s.buffs = {};
  s.phase = 'day';
  s.phaseT = dayLen(s.nights + 1);
  s.nights++;
  const lost = Math.max(0, baseAtDusk - s.baseHp) / baseMax();
  const grade = lost <= 0.001 ? 'S' : lost < 0.15 ? 'A' : lost < 0.4 ? 'B' : 'C';
  const gm = { S: 2, A: 1.5, B: 1.2, C: 1 }[grade];
  const perfect = grade === 'S';
  const reward = Math.round((40 + s.nights * 35) * (nightMod === 'blood' || nightMod === 'double' ? 1.5 : 1) * gm);
  earn(reward);
  for (const k in nightLoot) s.res[k] = (s.res[k] || 0) + nightLoot[k];
  ui.openPanel('grade', gradeHtml(grade, lost, reward));
  addXp(10 + s.nights * 5);
  s.baseHp = Math.min(baseMax(), s.baseHp + baseMax() * 0.3);
  playerHp = playerMax();
  void perfect;
  nightMod = null; eyeTint();
  laneView.set({}, false);
  planNext();
  sfx.level();
  horde.clear();
  doSave();
}

function updatePhase(dt: number) {
  if (over) return;
  if (s.phase === 'day') {
    const prevT = s.phaseT;
    if (!ui.blocking()) s.phaseT -= dt;
    world.danger = Math.max(0, Math.min(1, 1 - s.phaseT / 30));
    if (prevT > 30 && s.phaseT <= 30) { ui.banner('🌙 A NOITE ESTÁ CHEGANDO!', '30 segundos — termine de plantar e prepare as defesas'); sfx.siren(); document.body.classList.add('warn'); }
    if (s.phaseT <= 10 && Math.ceil(prevT) !== Math.ceil(s.phaseT) && s.phaseT > 0) { ui.bigCount(Math.ceil(s.phaseT)); sfx.heart(); }
    if (prevT > 12 && s.phaseT <= 12) { family.runHome(); ui.toast('🏃 A família está correndo para casa!'); }
    if (s.phaseT <= 0) startNight();
    const p = 1 - Math.max(0, s.phaseT) / dayLen(s.nights);
    visDay += (0.1 + 0.58 * p - visDay) * Math.min(1, dt * 1.5);
  } else {
    spawnT -= dt;
    const n = s.nights + 1;
    if (spawnT <= 0 && spawnQueue.length && horde.alive() < 45) {
      spawnOne(spawnQueue.shift()!);
      spawnT = Math.max(0.2, 1.4 - n * 0.09) * (0.5 + Math.random() * 0.8);
    }
    const left = spawnQueue.length + horde.alive();
    const target = 0.75 + 0.21 * (1 - left / Math.max(1, waveTotal));
    visDay += (target - visDay) * Math.min(1, dt * (visDay < 0.7 ? 2.2 : 0.8));
    if (left === 0 && spawnQueue.length === 0) endNight();
    // gemidos
    groanT -= dt;
    if (groanT <= 0) {
      groanT = 1.5 + Math.random() * 3;
      const z = horde.nearest(player.pos.x, player.pos.z, 25, true, true);
      if (z) sfx.groan(z.kind === 'colossus' || z.kind === 'brute');
    }
  }
  if (s.phase === 'day' && visDay > 0.9) visDay = 0.06;
  s.dayTime = visDay;
  // vida do jogador
  hurtT += dt;
  if (deadT > 0) {
    deadT -= dt;
    player.pitch = Math.min(0.9, player.pitch + dt * 0.6);
    if (deadT <= 0) {
      player.pos.set(-9.5, 0, 12); player.yaw = -Math.PI / 2; player.pitch = -0.1;
      playerHp = playerMax();
      ui.toast('❤️ Você se recuperou na casa');
    }
  } else if (hurtT > 4 && playerHp < playerMax()) playerHp = Math.min(playerMax(), playerHp + dt * 8 * (1 + 0.5 * lv('medkit')) * (s.buffs.bread ? 3 : 1));
  if (s.phase === 'night' && sk('d4') && !over) s.baseHp = Math.min(baseMax(), s.baseHp + 3 * dt);
  if (s.phase === 'night' && s.baseHp < baseMax() * 0.5 && Math.random() < dt * 4) fx.spawn(POS.house.x + (Math.random() - 0.5) * 8, 4 + Math.random() * 2, POS.house.z + (Math.random() - 0.5) * 6, Math.random() < 0.5 ? 0xff7a2a : 0x555555, 2, 1, 2, -1, 1.5);
}

function eyeTint() {
  zEyeMat.color.set(nightMod === 'blood' ? 0xff1a1a : 0xffb02a);
  for (const m of faceMats) m.color.set(nightMod === 'blood' ? 0xffa0a0 : 0xffffff);
  world.fogMult = nightMod === 'fog' ? 0.4 : 1;
}

function hurtPlayer(d: number) {
  if (deadT > 0 || over || dashT > 0) return;
  d *= diffK()[2];
  if (s.inTractor) d *= 0.4;
  playerHp -= d;
  hurtT = 0;
  ui.hurt(Math.min(1, d * 3));
  if (playerHp <= 0) {
    playerHp = 0;
    deadT = 4;
    if (s.inTractor) exitTractor();
    ui.banner('💀 Você caiu!', 'Voltando para a casa em 4 s…');
    sfx.error();
  }
}

function hurtBase(d: number) {
  if (over) return;
  d *= diffK()[2];
  s.baseHp -= d;
  baseAlertT -= 1 / 60;
  if (baseAlertT <= 0) { baseAlertT = 5; ui.toast('😱 Zumbis dentro de casa! A família está em perigo!', 'warn'); sfx.scream(); }
  if (s.baseHp <= 0) gameOver();
}

const LOOT: Record<string, [string, number, number][]> = {
  walker: [['wood', 0.6, 1], ['metal', 0.15, 1], ['food', 0.08, 1]],
  runner: [['wood', 0.4, 1], ['mseed', 0.08, 1]],
  brute: [['wood', 1, 2], ['metal', 0.8, 2], ['food', 0.3, 1]],
  digger: [['metal', 0.7, 1], ['mseed', 0.25, 1]],
  crow: [['mseed', 0.3, 1], ['wood', 0.3, 1]],
  colossus: [['wood', 1, 8], ['metal', 1, 8], ['mseed', 1, 4], ['food', 1, 3]],
};
let nightLoot: Record<string, number> = {};
const LOOT_COL: Record<string, number> = { wood: 0xc98a4a, metal: 0xbfd2e6, mseed: 0x9dff7a, food: 0xffb547 };

function onKill(z: Zombie, by: 'plant' | 'player') {
  for (const [res, ch, n] of LOOT[z.kind] || []) if (Math.random() < ch) {
    nightLoot[res] = (nightLoot[res] || 0) + n;
    const p = z.g.position;
    fx.spawn(p.x, 1.2, p.z, LOOT_COL[res], 8, 0.6, 5, 9, 1.1);
  }
  s.stats.kills++;
  earn(Math.round(z.reward * pct('kill')));
  addXp(z.kind === 'colossus' ? 80 : z.kind === 'brute' ? 6 : 2);
  const p = z.g.position;
  if (camera.position.distanceToSquared(p) < 1600 || z.kind === 'colossus') ui.float3d(`+${fmt(z.reward)}`, tp.set(p.x, 2.3, p.z), camera, by === 'player' ? 'money' : 'coin');
  fx.spawn(p.x, 1, p.z, 0x7fbf3a, z.kind === 'colossus' ? 60 : 12, 1.5, 4, 8, 0.9);
  if (z.kind === 'colossus') { ui.banner('🏆 Colosso derrotado!', `+${fmt(z.reward)}`); boom(p.x, p.z); }
  if (killSfxT <= 0) { sfx.splat(); killSfxT = 0.08; }
}
let killSfxT = 0;

function ramHit(z: Zombie) {
  const sp = Math.abs(tractor.speed);
  const f = new THREE.Vector3(-Math.sin(tractor.yaw), 0, -Math.cos(tractor.yaw)).multiplyScalar(Math.sign(tractor.speed) * 9);
  if (horde.hit(z, sp * 14, { knock: f })) { onKill(z, 'player'); s.stats.runOver++; }
  sfx.whack();
  shake = Math.max(shake, 0.15);
}

function boom(x: number, z: number) {
  fx.spawn(x, 0.8, z, 0xff8a2a, 40, 4, 7, 6, 0.9);
  fx.spawn(x, 1.2, z, 0xffe06a, 20, 3, 5, 4, 0.6);
  fx.spawn(x, 1.5, z, 0x444444, 15, 3, 3, -1, 1.8);
  sfx.boom();
  const d = Math.hypot(player.pos.x - x, player.pos.z - z);
  if (d < 30) shake = Math.max(shake, 0.5 * (1 - d / 30));
}

const aimDir = new THREE.Vector3();
function aimTarget(maxAng: number, range: number): Zombie | null {
  camera.getWorldDirection(aimDir);
  let best: Zombie | null = null, bs = Infinity;
  for (const z of horde.list) {
    if (z.dead || z.burrowed) continue;
    const zp = z.g.position;
    const v = new THREE.Vector3(zp.x - camera.position.x, (z.kind === 'crow' ? 3.4 : 1.2) - camera.position.y, zp.z - camera.position.z);
    const d = v.length();
    if (d > range) continue;
    const ang = v.normalize().angleTo(aimDir);
    if (ang < maxAng && ang * d * 0.3 + d * 0.02 < bs) { bs = ang * d * 0.3 + d * 0.02; best = z; }
  }
  return best;
}

const WEAPONS: Record<string, { name: string; icon: string; kind: 'melee' | 'gun' | 'flame'; dmg: number; cd: number; range: number; arc: number; knock: number; cost?: Record<string, number>; desc: string }> = {
  pa: { name: 'Pá', icon: 'hammer', kind: 'melee', dmg: 18, cd: 0.5, range: 3.0, arc: 0.35, knock: 5, desc: 'Equilibrada. Combo de 3 golpes com giro.' },
  axe: { name: 'Machado', icon: 'hammer', kind: 'melee', dmg: 36, cd: 0.8, range: 3.3, arc: 0.25, knock: 9, cost: { wood: 6, metal: 4 }, desc: 'Lento e devastador. Arremessa zumbis longe.' },
  scythe: { name: 'Foice Dupla', icon: 'sword', kind: 'melee', dmg: 13, cd: 0.28, range: 3.6, arc: -0.25, knock: 3, cost: { metal: 6, mseed: 1 }, desc: 'Rapidíssima e corta tudo à sua volta.' },
  gun: { name: 'Espingarda de Sementes', icon: 'target', kind: 'gun', dmg: 10, cd: 0.75, range: 22, arc: 0, knock: 3, cost: { metal: 10, wood: 4 }, desc: 'Leque de 6 sementes. Ótima contra grupos.' },
  flame: { name: 'Lança-Chamas de Pimenta', icon: 'flame', kind: 'flame', dmg: 46, cd: 0.08, range: 7.5, arc: 0.82, knock: 0.5, cost: { metal: 14, mseed: 3 }, desc: 'Cone de fogo contínuo que queima tudo.' },
};
const hasWeapon = (id: string) => id === 'pa' || lv('w_' + id) > 0;
let comboStep = 0, comboT = -9, hitStop = 0, dashT = 0, dashCd = 0;
const dashDir = new THREE.Vector3();

function attack() {
  const W = WEAPONS[s.weapon] && hasWeapon(s.weapon) ? WEAPONS[s.weapon] : WEAPONS.pa;
  camera.getWorldDirection(aimDir);
  const fwd = new THREE.Vector3(aimDir.x, 0, aimDir.z).normalize();
  const mult = pct('udmg') * (s.buffs.pie ? 1.3 : 1) * (1 + 0.3 * lv('blade'));
  if (W.kind === 'melee') {
    comboStep = realTime - comboT < 0.95 ? (comboStep % 3) + 1 : 1;
    comboT = realTime;
    const spin = comboStep === 3;
    player.use(comboStep);
    let hits = 0;
    horde.each(player.pos.x, player.pos.z, W.range * (spin ? 1.15 : 1), (z) => {
      const v = new THREE.Vector3(z.g.position.x - player.pos.x, 0, z.g.position.z - player.pos.z);
      const d = v.length();
      if (!spin && d > 0.01 && v.normalize().dot(fwd) < W.arc) return;
      if (z.kind === 'crow' && player.pitch < 0.15) return;
      const crit = Math.random() < 0.15;
      const dmg = W.dmg * mult * (spin ? 1.8 : 1) * (crit ? 2 : 1);
      const kdir = spin ? v.normalize() : fwd.clone();
      hits++;
      const p = z.g.position;
      ui.float3d(String(Math.round(dmg)), new THREE.Vector3(p.x, 2.2, p.z), camera, crit ? 'crit' : 'dmg');
      fx.spawn(p.x, 1.3, p.z, 0x8fdc3a, crit ? 22 : 12, 1.4, 4, 9, 0.7);
      if (horde.hit(z, dmg, { knock: kdir.multiplyScalar(W.knock * (spin ? 1.6 : 1) * (crit ? 1.4 : 1)) })) onKill(z, 'player');
    });
    if (hits) { hitStop = spin ? 0.11 : 0.065; shake = Math.max(shake, spin ? 0.28 : 0.14); sfx.whack(); if (spin) sfx.combo(); }
    else sfx.swing();
    cooldown = (W.cd * (spin ? 1.35 : 1)) / pct('tool');
  } else if (W.kind === 'gun') {
    player.use(1);
    const from = camera.position.clone().addScaledVector(aimDir, 0.9); from.y -= 0.2;
    const tgt = aimTarget(0.3, 30);
    const base = tgt ? new THREE.Vector3(tgt.g.position.x - from.x, (tgt.kind === 'crow' ? 3.4 : 1.2) - from.y, tgt.g.position.z - from.z).normalize() : aimDir.clone();
    for (let k = 0; k < 6; k++) {
      const d = base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.22)).normalize();
      defense.fireSeed(from, null, d, W.dmg * mult * (1 + 0.25 * lv('ammo')));
    }
    fx.spawn(from.x, from.y, from.z, 0xfff2a0, 10, 0.4, 2, 0, 0.2);
    shake = Math.max(shake, 0.12); sfx.shoot(3); sfx.whack();
    cooldown = W.cd / pct('tool');
  } else {
    player.use(1);
    const tip = camera.position.clone().addScaledVector(aimDir, 1.0); tip.y -= 0.25;
    for (let k = 0; k < 4; k++) {
      const f = 1 + Math.random() * W.range;
      fx.spawn(tip.x + aimDir.x * f, tip.y + aimDir.y * f * 0.5, tip.z + aimDir.z * f, Math.random() < 0.5 ? 0xff7a1a : 0xffd23f, 2, f * 0.15, 0.6, -1.5, 0.35);
    }
    horde.each(player.pos.x, player.pos.z, W.range, (z) => {
      const v = new THREE.Vector3(z.g.position.x - player.pos.x, 0, z.g.position.z - player.pos.z);
      if (v.length() > 0.01 && v.normalize().dot(fwd) < W.arc) return;
      if (horde.hit(z, W.dmg * W.cd * mult, { poison: 8 })) onKill(z, 'player');
    });
    if (soundT <= 0) { sfx.shoot(1); soundT = 0.12; }
    cooldown = W.cd;
  }
}

function dash() {
  if (dashCd > 0 || s.inTractor || aerial || deadT > 0) return;
  const [mx, my] = moveVec();
  const fx2 = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  if (Math.hypot(mx, my) > 0.2) dashDir.set(fx2 * my + rx * mx, 0, fz * my + rz * mx).normalize(); else dashDir.set(fx2, 0, fz);
  dashT = 0.2; dashCd = 1.1;
  sfx.swing();
  fx.spawn(player.pos.x, 0.3, player.pos.z, 0xd8c8a0, 14, 1.2, 1.5, 6, 0.6);
}

const buildPt = new THREE.Vector3();
let buildOk = false, buildRot = 0;
function buildTarget() {
  camera.getWorldDirection(ray);
  let d = 3.2;
  if (ray.y < -0.08) d = Math.min(7, -camera.position.y / ray.y);
  const fx2 = Math.hypot(ray.x, ray.z) || 1;
  buildPt.set(Math.round(camera.position.x + (ray.x / fx2) * Math.max(2.2, d * fx2)), 0, Math.round(camera.position.z + (ray.z / fx2) * Math.max(2.2, d * fx2)));
  buildRot = Math.round(player.yaw / (Math.PI / 2)) * (Math.PI / 2);
  const probe = buildPt.clone();
  let blocked = false;
  for (const b of colliders.boxes) { if (b.on && !b.on()) continue; if (probe.x > b.x1 - 1 && probe.x < b.x2 + 1 && probe.z > b.z1 - 1 && probe.z < b.z2 + 1) blocked = true; }
  for (const c of colliders.circles) { if (c.on && !c.on()) continue; if ((probe.x - c.x) ** 2 + (probe.z - c.z) ** 2 < (c.r + 1) ** 2) blocked = true; }
  const other = walls.at(buildPt.x, buildPt.z, 1.6);
  buildOk = !blocked && !other && Math.hypot(buildPt.x - player.pos.x, buildPt.z - player.pos.z) > 1.4;
  return other;
}

function build() {
  const other = buildTarget();
  cooldown = 0.35;
  if (other) {
    const max = WALLS[other.type].hp;
    if (other.hp >= max) { ui.toast('🧱 Já está inteira'); return; }
    if (!payRes({ wood: 1 })) return;
    other.hp = max; sfx.plow(); player.use();
    ui.toast('🔨 Reparado · 1 madeira');
    return;
  }
  const W = WALLS[buildType];
  if (s.level < W.level) { ui.toast(`🔒 ${W.name} requer nível ${W.level}`, 'warn'); return; }
  if (!buildOk) { ui.toast('🚫 Não dá para construir aqui', 'warn'); sfx.error(); return; }
  if (!payRes(W.cost)) return;
  walls.add(buildType, buildPt.x, buildPt.z, buildRot);
  player.use(); sfx.plow();
  fx.spawn(buildPt.x, 0.5, buildPt.z, 0x9a6a3c, 12, 1.5, 3, 9, 0.7);
  s.stats.plowed += 0;
}

function gradeHtml(g: string, lost: number, reward: number): string {
  const col = { S: '#ffd23f', A: '#7dff5a', B: '#4ac8ff', C: '#ff8a5a' }[g];
  const msg = { S: 'Defesa perfeita! A família dormiu em paz.', A: 'Ótima noite — só uns arranhões.', B: 'Foi por pouco… reforce as janelas.', C: 'Noite brutal. A família quase não aguentou!' }[g];
  const loot = RES.map((r) => `<div class="lootc" style="--c:${r.color}">${icon(r.icon)}<b>+${nightLoot[r.id] || 0}</b><small>${r.name}</small></div>`).join('');
  return `<div class="grade"><div class="gl" style="--c:${col}">${g}</div><div class="gi"><b>Noite ${s.nights} sobrevivida</b><p>${msg}</p>
    <p class="gs">Família ferida: <b>${Math.round(lost * 100)}%</b> · Zumbis eliminados: <b>${s.stats.kills}</b></p></div></div>
    <p class="note">Espólios que os zumbis deixaram cair:</p><div class="loot">${loot}</div>
    <p class="rew">Recompensa: <b>${fmt(reward)}</b> (nota ${g} ×${{ S: 2, A: 1.5, B: 1.2, C: 1 }[g]})</p>
    <button class="big" data-a="close">☀️ Começar o dia ${s.nights + 1}</button>`;
}

const RES_NAME: Record<string, string> = { wood: 'madeira', metal: 'metal', mseed: 'semente mutante', food: 'comida' };
function resTxt(c: Record<string, number>) { return Object.entries(c).map(([k, v]) => `${v} ${RES_NAME[k]}`).join(' + '); }
function payRes(c: Record<string, number>): boolean {
  for (const [k, v] of Object.entries(c)) if ((s.res[k] || 0) < v) { ui.toast(`🪵 Falta ${RES_NAME[k]} (precisa de ${resTxt(c)}) — derrote zumbis para conseguir`, 'warn'); sfx.error(); return false; }
  for (const [k, v] of Object.entries(c)) s.res[k] -= v;
  hudDirty = true;
  return true;
}

// ------------------------------------------------------------------ família: conversas e serviços
const LINES: Record<Who, string[]> = {
  ana: ['Tem comida no fogão. Ninguém luta de barriga vazia.', 'A chuva verde levou a cidade inteira… mas não vai levar a gente.', 'As crianças estão com medo. Fica perto da casa à noite, tá?', 'Se trouxer milho do campo, faço aquela sopa que te deixa forte.'],
  bia: ['Pai, as plantas piscaram pra mim de novo!', 'Eu e o Léo regamos tudo que tava com sede!', 'Se me der adubo, as plantas crescem rapidinho.', 'A Lavanda é minha favorita. Ela canta à noite.'],
  leo: ['Eu vi um zumbi corvo! Era enorme!', 'Quando eu crescer quero ser igual o Milho-Artilheiro. PÁ PÁ PÁ!', 'Regador cheio, missão cumprida!', 'Pai, posso ficar acordado pra ver as plantas lutarem?'],
  ze: ['Essa terra é teimosa como eu. Por isso ainda está viva.', 'Com metal e madeira eu blindo essa casa inteira.', 'Os agrotóxicos misturados com a chuva… criaram vida nas plantas. Ironia, né?', 'Traga sementes mutantes. Quero tentar umas misturas no laboratório.'],
};
const RECIPES: Record<string, { name: string; desc: string; need: Record<string, number>; inv?: Record<string, number>; buff?: string }> = {
  eat: { name: 'Refeição quente', desc: 'Cura 60 de vida agora', need: { food: 1 } },
  soup: { name: 'Sopa de milho', desc: '+40 de vida máxima até o amanhecer', need: { food: 1 }, inv: { corn: 4 }, buff: 'soup' },
  bread: { name: 'Pão de trigo', desc: 'Regenera vida 3× mais rápido esta noite', need: {}, inv: { wheat: 6 }, buff: 'bread' },
  pie: { name: 'Torta de abóbora', desc: '+30% de dano da sua arma esta noite', need: { food: 1 }, inv: { pumpkin: 2 }, buff: 'pie' },
  fert: { name: 'Adubo caseiro', desc: 'Plantas crescem +40% mais rápido hoje', need: { food: 1 }, inv: { wheat: 3 }, buff: 'fert' },
};
const WORKSHOP: Record<string, { name: string; desc: string; need: Record<string, number>; max: number }> = {
  plates: { name: 'Chapas de metal', desc: 'Janelas e porta aguentam 2,2× mais', need: { metal: 8, wood: 4 }, max: 1 },
  porch: { name: 'Armadilha da varanda', desc: 'Estacas ao redor da casa ferem e atrasam zumbis', need: { wood: 10, metal: 3 }, max: 1 },
  spot: { name: 'Holofote', desc: 'Varre o campo à noite e deixa zumbis lentos', need: { metal: 6, wood: 2 }, max: 1 },
  turret: { name: 'Torreta do telhado', desc: 'Atira sozinha em zumbis perto da casa (nível 2: +50% dano)', need: { metal: 12, wood: 8 }, max: 2 },
  kidcans: { name: 'Regadores das crianças', desc: 'Bia e Léo regam quase 2× mais rápido', need: { wood: 4, metal: 1 }, max: 1 },
};
let npcWho: Who = 'ana';
function costHtml(need: Record<string, number>, inv?: Record<string, number>) {
  const r = Object.entries(need).map(([k, v]) => `<span class="cst ${(s.res[k] || 0) >= v ? '' : 'no'}">${v}${icon(k)}</span>`);
  const c = Object.entries(inv || {}).map(([k, v]) => `<span class="cst ${(s.inv[k] || 0) >= v ? '' : 'no'}">${v} ${CROPS.find((x) => x.id === k)?.name ?? k}</span>`);
  return [...r, ...c].join(' ');
}
function canPay(need: Record<string, number>, inv?: Record<string, number>) {
  return Object.entries(need).every(([k, v]) => (s.res[k] || 0) >= v) && Object.entries(inv || {}).every(([k, v]) => (s.inv[k] || 0) >= v);
}
function openNpc(who: Who) {
  npcWho = who;
  const line = LINES[who][(Math.random() * LINES[who].length) | 0];
  const opt = (id: string, name: string, desc: string, cost: string, ok: boolean, done = false) =>
    `<div class="item ${done ? 'maxed' : ''}"><div class="it"><b>${name}</b><p>${desc}</p><p class="costs">${cost}</p></div>${done ? '<div class="done">✔</div>' : `<button class="buy" data-a="npc" data-v="${id}" ${ok ? '' : 'disabled'}>${id.startsWith('w:') ? 'Construir' : id.startsWith('f:') ? 'Forjar' : 'Fazer'}</button>`}</div>`;
  let body = '';
  if (who === 'ana') body = ['eat', 'soup', 'bread', 'pie'].map((k) => { const r = RECIPES[k]; return opt('r:' + k, r.name, r.desc + (r.buff && s.buffs[r.buff] ? ' · <b>ativo</b>' : ''), costHtml(r.need, r.inv), canPay(r.need, r.inv) && !(r.buff && s.buffs[r.buff])); }).join('');
  if (who === 'bia' || who === 'leo') body = opt('r:fert', RECIPES.fert.name, RECIPES.fert.desc + (s.buffs.fert ? ' · <b>ativo</b>' : ''), costHtml(RECIPES.fert.need, RECIPES.fert.inv), canPay(RECIPES.fert.need, RECIPES.fert.inv) && !s.buffs.fert) + opt('w:kidcans', WORKSHOP.kidcans.name, WORKSHOP.kidcans.desc, costHtml(WORKSHOP.kidcans.need), canPay(WORKSHOP.kidcans.need), lv('kidcans') >= 1);
  if (who === 'ze') body = '<p class="note">⚔️ Forja — armas</p>' + Object.entries(WEAPONS).filter(([id]) => id !== 'pa').map(([id, w]) => opt('f:' + id, w.name, w.desc, costHtml(w.cost!), canPay(w.cost!), hasWeapon(id))).join('') + '<p class="note">🔧 Oficina — defesas da casa</p>' + ['plates', 'porch', 'spot', 'turret'].map((k) => { const w = WORKSHOP[k]; return opt('w:' + k, w.name + (w.max > 1 ? ` (nv ${lv(k)}/${w.max})` : ''), w.desc, costHtml(w.need), canPay(w.need), lv(k) >= w.max); }).join('')
    + opt('fix', 'Consertar todas as entradas', 'O Vô prega tábuas em tudo que está quebrado', costHtml({ wood: Math.max(1, missingPlanks()) }), missingPlanks() > 0 && (s.res.wood || 0) >= missingPlanks(), missingPlanks() === 0);
  ui.openPanel('npc', `<div class="npc"><div class="np ${who}">${icon(who === 'ana' ? 'food' : who === 'ze' ? 'hammer' : 'drop')}</div><div><b>${FAMILY[who].name}</b> <small>${FAMILY[who].role}</small><p class="say">“${line}”</p></div></div>${body}`);
}
function missingPlanks() { let n = 0; house.entries.forEach((e, i) => { n += maxPlanks(e) - Math.ceil(house.hp(i) / plankHp() - 0.001); }); return n; }
function npcAction(v: string) {
  if (v === 'fix') { const n = missingPlanks(); if (n && payRes({ wood: n })) { house.repairAll(); sfx.buy(); ui.toast(`🔨 Vô Zé consertou ${n} tábuas`, 'good'); } openNpc(npcWho); return; }
  const [kind, id] = v.split(':');
  if (kind === 'r') {
    const r = RECIPES[id];
    if (!canPay(r.need, r.inv)) { sfx.error(); return; }
    for (const [k, n] of Object.entries(r.need)) s.res[k] -= n;
    for (const [k, n] of Object.entries(r.inv || {})) { s.inv[k] -= n; if (s.inv[k] <= 0) delete s.inv[k]; }
    if (id === 'eat') playerHp = Math.min(playerMax(), playerHp + 60);
    if (r.buff) s.buffs[r.buff] = 1;
    if (id === 'soup') playerHp = playerMax();
    sfx.buy(); ui.toast(`🍲 ${r.name}! ${r.desc}`, 'good');
  } else if (kind === 'f') {
    const w = WEAPONS[id];
    if (hasWeapon(id) || !payRes(w.cost!)) return;
    s.up['w_' + id] = 1;
    s.weapon = id; player.setWeapon(id);
    sfx.buy(); ui.toast(`⚔️ ${w.name} forjada e equipada!`, 'good');
    ui.invalidateBars(); ui.renderToolbar(s.inTractor);
  } else if (kind === 'w') {
    const w = WORKSHOP[id];
    if (lv(id) >= w.max || !payRes(w.need)) return;
    s.up[id] = lv(id) + 1;
    house.refresh(); sfx.buy();
    ui.toast(`🔧 ${w.name} pronto!`, 'good');
  }
  hudDirty = true;
  openNpc(npcWho);
}

function gameOver() {
  if (over) return;
  over = true;
  s.baseHp = 0;
  const gain = legacyGain(s);
  let best = 0;
  try { best = Number(localStorage.getItem('tv-best') || 0); if (s.nights > best) localStorage.setItem('tv-best', String(s.nights)); } catch { /* */ }
  ui.openPanel('over', `<div class="over"><div class="ic big">🧟</div>
    <p>A horda invadiu a casa e pegou sua família na <b>noite ${s.nights + 1}</b>.</p>
    <p>Noites sobrevividas: <b>${s.nights}</b>${best ? ` · Recorde: <b>${Math.max(best, s.nights)}</b>` : ''}<br>Zumbis eliminados: <b>${s.stats.kills}</b></p>
    <p>Você ganha <b>+${gain} ponto${gain > 1 ? 's' : ''} de Legado</b> (permanentes: +10% vendas, +5% crescimento e +1 ponto de habilidade cada).</p>
    <button class="big" data-a="restart">🌱 Recomeçar com o Legado</button></div>`);
  sfx.gameover();
}

function restart() {
  const gain = legacyGain(s);
  const ns = newState(s.legacy + gain, s.prestiges + 1, s.settings);
  game.s = ns;
  farm.resetTiles();
  ns.tiles = farm.serialize();
  over = false;
  visDay = 0.05;
  applyState();
  ui.closePanel();
  if (s.inTractor) exitTractor();
  walls.clear();
  ui.banner('🌱 Uma nova chance', `Legado ${ns.legacy} · prepare-se para a primeira noite`);
  doSave();
}

function checkGoal() {
  const g = GOALS[s.goal];
  if (!g) return;
  const [cur, need] = g.prog(s);
  if (cur >= need) {
    s.goal++;
    if (g.reward) { earn(g.reward); }
    ui.toast(`🎯 Meta concluída! ${g.reward ? '+' + fmt(g.reward) : ''}`, 'good');
    if (g.reward) sfx.coin();
    ui.pulse('goal');
    hudDirty = true;
  }
}

// ------------------------------------------------------------------ entrada
initInput(canvas, document.getElementById('joy')!, document.getElementById('joyKnob')!, () => {
  if (playing && !ui.isPanelOpen()) canvas.requestPointerLock?.();
});
holdButton(document.getElementById('btnAction')!, (v) => { input.action = v; });
holdButton(document.getElementById('btnInteract')!, (v) => { if (v) press('KeyE'); });
holdButton(document.getElementById('btnSprint')!, (v) => { if (v) press('Dash'); });
document.getElementById('btnSprint')!.textContent = '💨';

function handleKeys() {
  for (let i = 0; i < 7; i++) if (consume('Digit' + (i + 1))) selectTool(i);
  if (consume('KeyN')) startNight();
  if (s.inTractor && s.tpCam) {
    if (consume('WheelDown')) camDist = Math.min(20, camDist + 1.2);
    if (consume('WheelUp')) camDist = Math.max(6, camDist - 1.2);
  }
  if (consume('KeyV')) toggleCam();
  if (consume('KeyQ')) toggleAerial();
  if (consume('KeyR')) { const ids = Object.keys(WEAPONS).filter(hasWeapon); const k = ids.indexOf(s.weapon); const id = ids[(k + 1) % ids.length]; s.weapon = id; player.setWeapon(id); ui.renderCropbar(s.inTractor); ui.toast(`⚔️ ${WEAPONS[id].name}`); }
  if (aerial) {
    if (consume('WheelDown')) aer.th = Math.min(140, aer.th * 1.15);
    if (consume('WheelUp')) aer.th = Math.max(22, aer.th / 1.15);
  }
  if (consume('KeyK')) ui.togglePanel('skills');
  if (consume('WheelDown')) selectTool(((s.inTractor ? s.implement : s.tool) + 1) % (s.inTractor ? IMPLEMENTS.length : 7));
  if (consume('WheelUp')) { const n = s.inTractor ? IMPLEMENTS.length : 7; selectTool(((s.inTractor ? s.implement : s.tool) + n - 1) % n); }
  if (consume('KeyC')) {
    const avail = CROPS.map((c, i) => [c, i] as const).filter(([c]) => c.level <= s.level);
    const k = avail.findIndex(([, i]) => i === s.crop);
    s.crop = avail[(k + 1) % avail.length][1];
    ui.renderCropbar(s.inTractor);
    ui.toast(`Semente: ${CROPS[s.crop].icon} ${CROPS[s.crop].name}`);
  }
  if (consume('KeyB') || consume('Tab')) ui.togglePanel('shop');
  if (consume('KeyM')) ui.togglePanel('market');
  if (consume('Escape')) ui.closePanel();
  if (consume('KeyE')) {
    if (ui.isPanelOpen()) return;
    if (s.inTractor) { if (Math.abs(tractor.speed) < 1.5) exitTractor(); }
    else if (currentInter) currentInter.act();
  }
}

// ------------------------------------------------------------------ tela inicial
let playing = false;
const startEl = document.getElementById('start')!;
document.getElementById('playBtn')!.textContent = s.tiles ? '▶ Continuar' : '▶ Jogar';
applyState();
offlineProgress();
ui.updateHud();

document.getElementById('playBtn')!.addEventListener('click', () => {
  initAudio();
  setSound(s.settings.sound);
  startEl.classList.add('hidden');
  document.getElementById('hud')!.classList.remove('hidden');
  playing = true;
  if (isTouch) toggleFullscreen();
  else canvas.requestPointerLock?.();
  if (s.inTractor) engine(true, 0);
  if (welcome) ui.openPanel('welcome', welcome);
  else if (s.stats.plowed === 0) ui.toast(isTouch ? '👋 Use o joystick para andar e o botão ⛏️ para arar a terra!' : '👋 WASD para andar, clique para usar a enxada ⛏️', 'good');
});

// ------------------------------------------------------------------ loop principal
let last = performance.now();
let hudT = 0, goalT = 0, saveT = 0, sparkleT = 0, clockT = 0, smokeT = 0, hintT = 20, tractorSfxT = 0;
let wasRaining = false, prevAction = false;
let camOrbit = 0, camPitch = 0.42, camDist = 11, lastLook = -10, camSnap = true;
const camWant = new THREE.Vector3(), camLook = new THREE.Vector3();
const lookTarget = new THREE.Vector3(0, 0, -28);

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  realTime += dt;
  uTime.value += dt;
  soundT -= dt;
  killSfxT -= dt;

  if (playing) {
    simStep(dt, {
      robotHarvest: (t) => world.droneTo(t),
      truck: (g) => { ui.toast(`🚚 O caminhão vendeu a colheita: +${fmt(g)}`, 'good'); sfx.coin(); },
      interest: (g) => { ui.toast(`🏦 Juros recebidos: +${fmt(g)}`, 'good'); },
    });
    updatePhase(dt);
    handleKeys();
    const [mx, my] = input.enabled ? moveVec() : [0, 0];
    if (aerial) aerialInput(dt, mx, my);
    else if (input.enabled) {
      if (s.inTractor) {
        if (s.tpCam) {
          camOrbit -= input.lookX * 1.4;
          camPitch = Math.max(0.06, Math.min(1.25, camPitch + input.lookY));
          if (input.lookX || input.lookY) lastLook = realTime;
        } else {
          tractor.headYaw = Math.max(-2.2, Math.min(2.2, tractor.headYaw - input.lookX));
          player.pitch = Math.max(-1.3, Math.min(1.0, player.pitch - input.lookY));
        }
      } else player.look(input.lookX, input.lookY);
    }
    input.lookX = input.lookY = 0;

    if (aerial) { aerialCamera(dt); view.setHighlight([], 0); ui.setTileInfo(''); walls.setGhost(-1, 0, 0, 0, false); }
    else if (s.inTractor) {
      tractor.update(dt, my, mx, tractorSpeed(), sk('m4') > 0);
      const seat = tractor.seatWorld();
      if (s.tpCam) {
        camOrbit = Math.atan2(Math.sin(camOrbit), Math.cos(camOrbit));
        if (realTime - lastLook > 1.6 && Math.abs(tractor.speed) > 1) camOrbit *= Math.exp(-dt * 1.8);
        const tpos = tractor.group.position;
        const ang = tractor.yaw + camOrbit;
        camWant.set(tpos.x + Math.sin(ang) * camDist * Math.cos(camPitch), 1.2 + Math.sin(camPitch) * camDist, tpos.z + Math.cos(ang) * camDist * Math.cos(camPitch));
        if (camSnap) { camera.position.copy(camWant); camSnap = false; } else camera.position.lerp(camWant, 1 - Math.exp(-dt * 9));
        camLook.set(tpos.x - Math.sin(tractor.yaw) * 2.5, 1.3, tpos.z - Math.cos(tractor.yaw) * 2.5);
        camera.lookAt(camLook);
      } else {
        camera.position.copy(seat);
        camera.rotation.set(player.pitch, tractor.yaw + tractor.headYaw, 0);
      }
      player.pos.set(seat.x, 0, seat.z);
      engine(true, tractor.speed / tractorSpeed());
      const act = input.action && input.enabled;
      if (act && !prevAction) { workOn = !workOn; updateActionIcon(); ui.toast(workOn ? '⬇️ Implemento baixado — trabalhando' : '⬆️ Implemento erguido'); sfx.click(); }
      prevAction = act;
      const w = implWidth();
      const pts = tractor.workPoints(s.implement, w);
      const tiles: number[] = [];
      for (const p of pts) { const t = farm.tileAt(p.x, p.z); if (t >= 0 && isOwned(t)) tiles.push(t); }
      view.setHighlight(workOn ? tiles : [], s.implement === 3 ? 0xffd23f : 0x9dff7a);
      if (workOn && Math.abs(tractor.speed) > 0.4) {
        let any = false;
        for (const t of tiles) if (applyTool(t, s.implement, true)) any = true;
        if (any && tractorSfxT <= 0 && s.implement !== 3) { actionSfx[s.implement](); tractorSfxT = 0.15; }
      }
      tractorSfxT -= dt;
      smokeT -= dt;
      if (smokeT <= 0) { smokeT = 0.12; const e = tractor.exhaustWorld(); fx.spawn(e.x, e.y, e.z, 0x8a8a8a, 1, 0.2, 1.5 + Math.abs(tractor.speed) * 0.2, -0.6, 1.4); }
      ui.setTileInfo('');
    } else {
      const sp = deadT > 0 ? 0 : walkSpeed() * (input.sprint || Math.hypot(input.joyX, input.joyY) > 0.93 ? 1.6 : 1);
      dashCd -= dt;
      if (consume('Space') || consume('Dash')) dash();
      if (dashT > 0) { dashT -= dt; player.pos.addScaledVector(dashDir, 17 * dt); resolve(player.pos, 0.4); if (Math.random() < 0.5) fx.spawn(player.pos.x, 0.2, player.pos.z, 0xd8c8a0, 2, 0.6, 1, 6, 0.4); }
      player.update(dt, mx, my, sp);
      cooldown -= dt;
      if (sk('m5') && s.can < canCap()) { canAcc += dt * 0.6; if (canAcc >= 1) { canAcc -= 1; s.can++; hudDirty = true; } }
      if (input.action && input.enabled && cooldown <= 0 && deadT <= 0) useHand();
      if (s.tool === 6) { const o = buildTarget(); walls.setGhost(o ? -1 : buildType, buildPt.x, buildPt.z, buildRot, buildOk); } else walls.setGhost(-1, 0, 0, 0, false);
      const t0 = s.tool === 6 ? -1 : targetTile();
      if (t0 >= 0) {
        const tiles = isOwned(t0) ? farm.area(t0, lv('tool')) : [t0];
        const c = !isOwned(t0) ? 0xff6b6b : farm.isRipe(t0) ? 0xffd23f : 0xffffff;
        view.setHighlight(tiles, c);
      } else view.setHighlight([], 0);
      ui.setTileInfo(tileInfo(t0));
    }
    player.syncView(dt);

    if (realTime - lastHarvest > 1.7 && combo) { combo = 0; ui.setCombo(0); }

    findInter();
    hudT -= dt; goalT -= dt; saveT -= dt; sparkleT -= dt; clockT -= dt; hintT -= dt;
    if (hudDirty && hudT <= 0) { hudDirty = false; hudT = 0.1; ui.updateHud(); ui.refreshPanel(); }
    if (goalT <= 0) { goalT = 0.4; checkGoal(); }
    if (saveT <= 0) { saveT = 10; doSave(); }
    if (clockT <= 0) { clockT = 0.25; ui.setPhase(s.phase, s.nights + 1, s.phaseT, spawnQueue.length + horde.alive(), world.rainF > 0.3, s.phase === 'day' ? 1 - s.phaseT / dayLen(s.nights) : 1 - (spawnQueue.length + horde.alive()) / Math.max(1, waveTotal)); ui.setVitals(playerHp / playerMax(), s.baseHp / baseMax(), playerHp, s.baseHp); hudDirty = true; }
    if (sparkleT <= 0) {
      sparkleT = 0.08;
      const t = farm.randomRipe();
      if (t >= 0 && Math.hypot(tileX(t) - player.pos.x, tileZ(t) - player.pos.z) < 50) fx.spawn(tileX(t) + (Math.random() - 0.5) * 1.5, 1 + Math.random(), tileZ(t) + (Math.random() - 0.5) * 1.5, 0xfff2a0, 1, 0.1, 0.6, -0.3, 1.2);
    }
    if (hintT <= 0) {
      hintT = 35;
      const c = farm.countState();
      if (c.dry >= 5 && !lv('sprinkler')) ui.toast(`💧 ${c.dry} plantas estão com sede!`);
      else if (c.ripe >= 10 && !lv('robots')) ui.toast(`🌾 ${c.ripe} canteiros prontos para colher!`);
      else if (siloUsed() >= siloCap() * 0.9) ui.toast('🏚️ Silo quase cheio — venda no mercado 📈');
    }
    const raining = world.rainF > 0.3;
    if (raining && !wasRaining) ui.toast('🌧️ Começou a chover — as plantas estão sendo regadas!');
    wasRaining = raining;
  } else {
    // câmera de apresentação
    s.dayTime = 0.12;
    const a = realTime * 0.05;
    camera.position.set(Math.sin(a) * 55, 20 + Math.sin(a * 0.7) * 4, -30 + Math.cos(a) * 55);
    camera.lookAt(lookTarget);
  }

  view.cam.copy(camera.position);
  view.update(dt);
  life.update(dt, realTime, camera.position);
  if (playing && !over) {
    const simDt = hitStop > 0 ? dt * 0.08 : dt;
    hitStop -= dt;
    horde.update(simDt, realTime, {
      player: player.pos, tractor: lv('tractor') ? tractor.group.position : null, tractorSpeed: s.inTractor ? tractor.speed : 0, camera,
      hurtPlayer, hurtBase, kill: (z) => onKill(z, 'plant'), ramHit, house,
      walls, speedMult: nightMod === 'blood' ? 1.3 : 1,
    });
    walls.update(dt, realTime, camera);
    defense.update(simDt, s.phase === 'night', camera.position);
    shotT -= dt;
  }
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.6; camera.position.y += (Math.random() - 0.5) * shake * 0.6; }
  creatures.update(dt, s.phase === 'night' && playing, realTime, camera.position);
  if (playing) {
    family.update(dt, realTime, player.pos, lv('kidcans') ? 1.8 : 1);
    if (!over) house.update(dt, realTime, s.phase === 'night', (z) => onKill(z, 'plant'), (a, b) => { fx.spawn(a.x, a.y, a.z, 0xffe066, 3, 0.3, 1, 0, 0.15); fx.spawn(b.x, b.y, b.z, 0xffe066, 5, 0.6, 2, 5, 0.3); if (shotT <= 0) { shotT = 0.07; sfx.shoot(3); } });
  }
  renderer.toneMappingExposure = 1.05 + world.night * 0.12;
  {
    const on = world.night > 0.3 && playing;
    flashlight.intensity = on ? world.night * (aerial ? 700 : s.inTractor ? 120 : 30) : 0;
    if (aerial) {
      flashlight.position.copy(camera.position);
      flashlight.target.position.set(aer.x, 0, aer.z);
      flashlight.angle = 0.7;
      flashlight.distance = 260;
    } else if (s.inTractor) {
      flashlight.distance = 45;
      flashlight.position.copy(tractor.group.localToWorld(new THREE.Vector3(0, 2.2, -2.6)));
      flashlight.target.position.copy(tractor.group.localToWorld(new THREE.Vector3(0, 0, -16)));
      flashlight.angle = 0.75;
    } else {
      flashlight.distance = 45;
      camera.getWorldDirection(ray);
      flashlight.position.copy(camera.position).addScaledVector(ray, 0.3);
      flashlight.position.y -= 0.25;
      flashlight.target.position.copy(camera.position).addScaledVector(ray, 12);
      flashlight.angle = 0.55;
    }
  }
  laneView.update(dt, realTime);
  if (playing) {
    const live: Record<string, number> = {};
    if (s.phase === 'night') { for (const e of spawnQueue) live[e.lane] = (live[e.lane] || 0) + 1; for (const z of horde.list) if (!z.dead && z.path) { const id = laneOf(z.path); if (id) live[id] = (live[id] || 0) + 1; } }
    minimap.update(dt, horde, walls, player.pos.x, player.pos.z, s.inTractor ? tractor.yaw : player.yaw, { x: tractor.group.position.x, z: tractor.group.position.z, on: lv('tractor') > 0 }, s.phase === 'night' ? live : plan.counts, realTime);
  }
  world.update(dt, camera.position, realTime);
  fx.update(dt);

  vmHemi.intensity = world.hemi.intensity;
  vmSun.intensity = world.sun.intensity * 0.8;
  vmSun.color.copy(world.sun.color);
  vmSun.position.copy(camera.position).addScaledVector(world.sunDir, 10);
  vmSun.target.position.copy(camera.position);

  post.setVM(playing && !s.inTractor && !aerial);
  post.render(world.night, world.danger, 0);
}
renderer.setAnimationLoop(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });
window.addEventListener('pagehide', doSave);
window.addEventListener('beforeunload', doSave);

// debug para testes
(window as any).__tv = { game, farm, player, tractor, horde, walls, defense, endNight, family, house, openNpc, setLoot: (l: Record<string, number>) => { nightLoot = l; }, startNight, planNext, toggleCam, enterTractor, buyUpgrade, sim: runSim, earn };
