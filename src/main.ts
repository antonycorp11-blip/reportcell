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
import { uTime } from './gfx';
import * as ui from './ui';
import { Life } from './life';
import { learn, SKMAP } from './skills';
import { Horde, ZDEF, eyeMat as zEyeMat, type Zombie, type ZKind } from './zombies';
import { Defense } from './defense';
import { LaneView, LMAP, lanesFor } from './lanes';
import { Creatures } from './creatures';
import { faceMats } from './zmodels';
import { Minimap } from './minimap';
import { Walls, WALLS } from './walls';
import { rng } from './gfx';
import { colliders } from './physics';
import { DAY_LEN, baseMax, playerMax, addXp } from './state';

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

const fx = new FX(scene);
const world = new World(scene, fx, high);
const view = new FarmView(scene, high);
const player = new Player(camera);
vmScene.add(player.view);
const tractor = new Tractor(scene);
const life = new Life(scene, fx);
life.onUnlock = (name) => { if (playing) { ui.banner('✨ A fazenda evoluiu!', name); sfx.level(); } };
const horde = new Horde(scene, fx);
const defense = new Defense(scene, horde, fx);
const laneView = new LaneView(scene);
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
let spawnQueue: WaveEntry[] = [], spawnT = 0, waveTotal = 0, visDay = 0.05;

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
  planNext();
  player.setTool(s.tool);
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
  const n = s.parcels.length;
  const need = parcelLevel(n);
  if (s.level < need) { ui.toast(`🔒 Requer nível ${need}`, 'warn'); sfx.error(); return; }
  const cost = parcelPrice(n);
  if (!spend(cost)) { ui.toast(`💸 Faltam ${fmt(cost - s.money)}`, 'warn'); sfx.error(); return; }
  s.parcels.push(id);
  farm.syncOwned();
  world.refresh();
  sfx.buy();
  const p = parcelSignPos(id);
  fx.spawn(p.x, 2, p.z - 5, 0x9dff7a, 60, 6, 5, 5, 1.6);
  ui.banner('🗺️ Novo terreno!', `+100 canteiros${PARCELS[id].fert > 1 ? ` · solo fértil +${Math.round((PARCELS[id].fert - 1) * 100)}%` : ''}`);
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
    ui.toast(`${SKMAP[id].icon} ${SKMAP[id].name} aprendida!`, 'good');
    tractor.setMode(s.implement, implWidth());
    fx.spawn(player.pos.x, 2, player.pos.z, 0xffd23f, 25, 1.5, 5, 6, 1.2);
    hudDirty = true;
  },
  toggleCam,
  tool: selectTool,
  wall(i) { buildType = i; sfx.click(); ui.renderCropbar(s.inTractor, buildType); ui.toast(`${WALLS[i].icon} <b>${WALLS[i].name}</b> · ${fmt(WALLS[i].cost)} · ${WALLS[i].desc}`); },
  crop(i) { if (s.level >= CROPS[i].level) { s.crop = i; sfx.click(); ui.renderCropbar(s.inTractor); ui.toast(`${CROPS[i].icon} <b>${CROPS[i].def}</b> · ${CROPS[i].role}`); } },
  startNight: () => startNight(),
  restart: () => restart(),
  open() { input.enabled = false; input.action = false; if (document.pointerLockElement) document.exitPointerLock(); },
  close() { input.enabled = true; if (!isTouch && playing) canvas.requestPointerLock?.(); },
  setting(k, v) {
    if (k === 'sound') { s.settings.sound = !!v; setSound(!!v); }
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
    cooldown = (s.tool === 3 ? 0.16 : s.tool === 2 ? 0.2 : 0.26) / (1 + 0.15 * sk('m1'));
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
  ...PARCELS.map((p): Inter => {
    const pos = parcelSignPos(p.id);
    return { pos: () => pos, r: 3.2, label: () => (farm.owned[p.id] ? null : `Comprar terreno ${fmt(parcelPrice(s.parcels.length))}`), act: () => buyParcel(p.id) };
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
  const total = Math.min(170, Math.round((5 + n * 3.3) * (mod === 'double' ? 1.6 : 1)));
  const list: WaveEntry[] = [];
  const newest = lanes[lanes.length - 1];
  for (let i = 0; i < total; i++) {
    const v = r();
    let kind: ZKind = 'walker';
    if (n >= 2 && v < 0.2) kind = 'runner';
    else if (n >= 3 && v < 0.3) kind = 'brute';
    else if (n >= 4 && v < 0.4) kind = 'digger';
    else if (n >= 5 && v < 0.5) kind = 'crow';
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
  const lanes = Object.keys(plan.counts).map((id) => `${LMAP[id].arrow} ${LMAP[id].name} <b>${plan.counts[id]}</b>`).join(' · ');
  const kinds = Object.keys(plan.kinds).map((k) => `${KIND_ICON[k]}${plan.kinds[k]}`).join(' ');
  const newLane = lanesFor(n).find((l) => l.unlock === n && n > 1);
  const mod = plan.mod ? `<div class="pmod">${MODS[plan.mod].name} — ${MODS[plan.mod].desc}</div>` : '';
  ui.setPreview(`<div class="ptitle">📋 Próxima noite ${n}${newLane ? ` · <span class="new">NOVA ROTA: ${newLane.arrow} ${newLane.name}!</span>` : ''}</div><div>${lanes}</div><div class="pk">${kinds}</div>${mod}`);
}

function laneOf(path: [number, number][]): string | null { for (const id in LMAP) if (LMAP[id].pts === path) return id; return null; }

function spawnOne(e: WaveEntry) {
  const n = s.nights + 1;
  const lane = LMAP[e.lane];
  const [x, z] = lane.pts[0];
  horde.spawn(e.kind, x + (Math.random() - 0.5) * 4, z + (Math.random() - 0.5) * 4, 1 + 0.13 * (n - 1), lane.pts);
}

function startNight() {
  if (s.phase === 'night' || over) return;
  s.phase = 'night';
  const n = s.nights + 1;
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
  s.phase = 'day';
  s.phaseT = DAY_LEN;
  s.nights++;
  const perfect = s.baseHp >= baseAtDusk - 0.5;
  const reward = Math.round((40 + s.nights * 35) * (nightMod === 'blood' || nightMod === 'double' ? 1.5 : 1) * (perfect ? 1.5 : 1));
  earn(reward);
  addXp(10 + s.nights * 5);
  s.baseHp = Math.min(baseMax(), s.baseHp + baseMax() * 0.5);
  playerHp = playerMax();
  ui.banner(`🌅 Você sobreviveu à noite ${s.nights}!`, `+${fmt(reward)}${perfect ? ' · 🛡️ DEFESA PERFEITA ×1,5' : ''} · veja as rotas da próxima noite`);
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
    s.phaseT -= dt;
    if (s.phaseT <= 0) startNight();
    const p = 1 - Math.max(0, s.phaseT) / DAY_LEN;
    visDay += (0.03 + 0.66 * p - visDay) * Math.min(1, dt * 1.5);
  } else {
    spawnT -= dt;
    const n = s.nights + 1;
    if (spawnT <= 0 && spawnQueue.length && horde.alive() < 34) {
      spawnOne(spawnQueue.shift()!);
      spawnT = Math.max(0.3, 2.3 - n * 0.12) * (0.6 + Math.random() * 0.8);
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
  if (s.phase === 'day' && visDay > 0.9) visDay = 0.03;
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
  } else if (hurtT > 4 && playerHp < playerMax()) playerHp = Math.min(playerMax(), playerHp + dt * 8 * (1 + 0.5 * lv('medkit')));
  if (s.phase === 'night' && s.baseHp < baseMax() * 0.5 && Math.random() < dt * 4) fx.spawn(POS.house.x + (Math.random() - 0.5) * 8, 4 + Math.random() * 2, POS.house.z + (Math.random() - 0.5) * 6, Math.random() < 0.5 ? 0xff7a2a : 0x555555, 2, 1, 2, -1, 1.5);
}

function eyeTint() {
  zEyeMat.color.set(nightMod === 'blood' ? 0xff1a1a : 0xffb02a);
  for (const m of faceMats) m.color.set(nightMod === 'blood' ? 0xffa0a0 : 0xffffff);
  world.fogMult = nightMod === 'fog' ? 0.4 : 1;
}

function hurtPlayer(d: number) {
  if (deadT > 0 || over) return;
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
  s.baseHp -= d;
  baseAlertT -= 1 / 60;
  if (baseAlertT <= 0) { baseAlertT = 6; ui.toast('🏠 A casa está sendo atacada!', 'warn'); }
  if (s.baseHp <= 0) gameOver();
}

function onKill(z: Zombie, by: 'plant' | 'player') {
  s.stats.kills++;
  earn(z.reward);
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

function attack() {
  player.use();
  camera.getWorldDirection(aimDir);
  const fwd = new THREE.Vector3(aimDir.x, 0, aimDir.z).normalize();
  let hitAny = false;
  horde.each(player.pos.x, player.pos.z, 3.2, (z) => {
    const v = new THREE.Vector3(z.g.position.x - player.pos.x, 0, z.g.position.z - player.pos.z);
    if (v.length() > 0.01 && v.normalize().dot(fwd) < 0.35) return;
    if (z.kind === 'crow' && player.pitch < 0.2) return;
    hitAny = true;
    if (horde.hit(z, 30 * (1 + 0.3 * lv('blade')), { knock: fwd.clone().multiplyScalar(7) })) onKill(z, 'player');
  });
  if (hitAny) { sfx.whack(); shake = Math.max(shake, 0.08); }
  if (lv('seedgun')) {
    const from = camera.position.clone().addScaledVector(aimDir, 0.8);
    from.y -= 0.2;
    defense.fireSeed(from, aimTarget(0.35, 34), aimDir.clone(), 16 * (1 + 0.25 * lv('ammo')));
    sfx.shoot(3);
    cooldown = 0.3 / (1 + 0.15 * sk('m1'));
  } else {
    if (!hitAny) sfx.swing();
    cooldown = 0.45 / (1 + 0.15 * sk('m1'));
  }
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
    const cost = Math.ceil(WALLS[other.type].cost * 0.5 * (1 - other.hp / max));
    if (!spend(cost)) { ui.toast(`💸 Reparo custa ${fmt(cost)}`, 'warn'); sfx.error(); return; }
    other.hp = max; sfx.plow(); player.use();
    ui.toast(`🔨 Reparado por ${fmt(cost)}`);
    return;
  }
  const W = WALLS[buildType];
  if (s.level < W.level) { ui.toast(`🔒 ${W.name} requer nível ${W.level}`, 'warn'); return; }
  if (!buildOk) { ui.toast('🚫 Não dá para construir aqui', 'warn'); sfx.error(); return; }
  if (!spend(W.cost)) { ui.toast(`💸 ${W.name} custa ${fmt(W.cost)}`, 'warn'); sfx.error(); return; }
  walls.add(buildType, buildPt.x, buildPt.z, buildRot);
  player.use(); sfx.plow();
  fx.spawn(buildPt.x, 0.5, buildPt.z, 0x9a6a3c, 12, 1.5, 3, 9, 0.7);
  s.stats.plowed += 0;
}

function gameOver() {
  if (over) return;
  over = true;
  s.baseHp = 0;
  const gain = legacyGain(s);
  let best = 0;
  try { best = Number(localStorage.getItem('tv-best') || 0); if (s.nights > best) localStorage.setItem('tv-best', String(s.nights)); } catch { /* */ }
  ui.openPanel('over', `<div class="over"><div class="ic big">🧟</div>
    <p>A horda invadiu sua casa na <b>noite ${s.nights + 1}</b>.</p>
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
holdButton(document.getElementById('btnSprint')!, (v) => { if (v) { input.sprint = !input.sprint; document.getElementById('btnSprint')!.classList.toggle('on', input.sprint); } });

function handleKeys() {
  for (let i = 0; i < 7; i++) if (consume('Digit' + (i + 1))) selectTool(i);
  if (consume('KeyN')) startNight();
  if (s.inTractor && s.tpCam) {
    if (consume('WheelDown')) camDist = Math.min(20, camDist + 1.2);
    if (consume('WheelUp')) camDist = Math.max(6, camDist - 1.2);
  }
  if (consume('KeyV')) toggleCam();
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
    if (input.enabled) {
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

    if (s.inTractor) {
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
      const sp = deadT > 0 ? 0 : walkSpeed() * (input.sprint ? 1.6 : 1);
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
    if (clockT <= 0) { clockT = 0.25; ui.setPhase(s.phase, s.nights + 1, s.phaseT, spawnQueue.length + horde.alive(), world.rainF > 0.3); ui.setVitals(playerHp / playerMax(), s.baseHp / baseMax()); hudDirty = true; }
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

  view.update(dt);
  life.update(dt, realTime, camera.position);
  if (playing && !over) {
    horde.update(dt, realTime, {
      player: player.pos, tractor: lv('tractor') ? tractor.group.position : null, tractorSpeed: s.inTractor ? tractor.speed : 0, camera,
      hurtPlayer, hurtBase, kill: (z) => onKill(z, 'plant'), ramHit,
      walls, speedMult: nightMod === 'blood' ? 1.3 : 1,
    });
    walls.update(dt, realTime, camera);
    defense.update(dt, s.phase === 'night', camera.position);
    shotT -= dt;
  }
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.6; camera.position.y += (Math.random() - 0.5) * shake * 0.6; }
  creatures.update(dt, s.phase === 'night' && playing, realTime, camera.position);
  renderer.toneMappingExposure = 1.05 + world.night * 0.12;
  {
    const on = world.night > 0.3 && playing;
    flashlight.intensity = on ? world.night * (s.inTractor ? 160 : 55) : 0;
    if (s.inTractor) {
      flashlight.position.copy(tractor.group.localToWorld(new THREE.Vector3(0, 2.2, -2.6)));
      flashlight.target.position.copy(tractor.group.localToWorld(new THREE.Vector3(0, 0, -16)));
      flashlight.angle = 0.75;
    } else {
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

  renderer.clear();
  renderer.render(scene, camera);
  if (playing && !s.inTractor) { renderer.clearDepth(); renderer.render(vmScene, camera); }
}
renderer.setAnimationLoop(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });
window.addEventListener('pagehide', doSave);
window.addEventListener('beforeunload', doSave);

// debug para testes
(window as any).__tv = { game, farm, player, tractor, horde, walls, startNight, planNext, toggleCam, enterTractor, buyUpgrade, sim: runSim, earn };
