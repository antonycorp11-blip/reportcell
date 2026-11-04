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

const DAY = 480;
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
  if (s.tool === 4 && !lv('multi')) s.tool = 0;
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
  crop(i) { if (s.level >= CROPS[i].level) { s.crop = i; sfx.click(); ui.renderCropbar(s.inTractor); } },
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
    if (i >= HAND_TOOLS.length || (i === 4 && !lv('multi'))) return;
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
  const t0 = targetTile();
  if (t0 < 0) return;
  if (!isOwned(t0)) { ui.toast('🪧 Este terreno está à venda — compre na placa'); cooldown = 0.5; return; }
  const tiles = farm.area(t0, lv('tool'));
  const done = new Set<number>();
  for (const t of tiles) {
    const a = s.tool === 4 ? smartAction(t) : s.tool;
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
  if (T.g[t] >= 1) return `✅ ${C.icon} ${C.name} pronto para colher!`;
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
  { pos: () => houseDoor, r: 3, label: () => (world.night > 0.5 ? 'Dormir até amanhecer 🛏️' : null), act: sleep },
  ...PARCELS.map((p): Inter => {
    const pos = parcelSignPos(p.id);
    return { pos: () => pos, r: 3.2, label: () => (farm.owned[p.id] ? null : `Comprar terreno ${fmt(parcelPrice(s.parcels.length))}`), act: () => buyParcel(p.id) };
  }),
];

function sleep() {
  const toMorning = (1 - s.dayTime) * DAY;
  runSim(toMorning, 1);
  ui.banner('🌅 Bom dia!', 'Suas plantas cresceram durante a noite');
  sfx.level();
}

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
  const unlocks = CROPS.filter((c) => c.level === l).map((c) => `${c.icon} ${c.name}`);
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
  for (let i = 0; i < 5; i++) if (consume('Digit' + (i + 1))) selectTool(i);
  if (s.inTractor && s.tpCam) {
    if (consume('WheelDown')) camDist = Math.min(20, camDist + 1.2);
    if (consume('WheelUp')) camDist = Math.max(6, camDist - 1.2);
  }
  if (consume('KeyV')) toggleCam();
  if (consume('KeyK')) ui.togglePanel('skills');
  if (consume('WheelDown')) selectTool(((s.inTractor ? s.implement : s.tool) + 1) % (s.inTractor ? IMPLEMENTS.length : lv('multi') ? 5 : 4));
  if (consume('WheelUp')) { const n = s.inTractor ? IMPLEMENTS.length : lv('multi') ? 5 : 4; selectTool(((s.inTractor ? s.implement : s.tool) + n - 1) % n); }
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

  if (playing) {
    simStep(dt, {
      robotHarvest: (t) => world.droneTo(t),
      truck: (g) => { ui.toast(`🚚 O caminhão vendeu a colheita: +${fmt(g)}`, 'good'); sfx.coin(); },
      interest: (g) => { ui.toast(`🏦 Juros recebidos: +${fmt(g)}`, 'good'); },
    });
    s.dayTime = (s.clock / DAY + 0.06) % 1;
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
      const sp = walkSpeed() * (input.sprint ? 1.6 : 1);
      player.update(dt, mx, my, sp);
      cooldown -= dt;
      if (sk('m5') && s.can < canCap()) { canAcc += dt * 0.6; if (canAcc >= 1) { canAcc -= 1; s.can++; hudDirty = true; } }
      if (input.action && input.enabled && cooldown <= 0) useHand();
      const t0 = targetTile();
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
    if (clockT <= 0) { clockT = 0.5; ui.setClock(s.dayTime, Math.floor(s.clock / DAY + 0.06) + 1, world.rainF > 0.3); hudDirty = true; }
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
    s.dayTime = (s.clock / DAY + 0.06) % 1;
    const a = realTime * 0.05;
    camera.position.set(Math.sin(a) * 55, 20 + Math.sin(a * 0.7) * 4, -30 + Math.cos(a) * 55);
    camera.lookAt(lookTarget);
  }

  view.update(dt);
  life.update(dt, realTime, camera.position);
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
(window as any).__tv = { game, farm, player, tractor, toggleCam, enterTractor, buyUpgrade, sim: runSim, earn };
