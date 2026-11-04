import * as THREE from 'three';
import { game, fmt, xpNeed, era, siloCap, siloUsed, canCap, lv, legacyGain, vitality } from './state';
import { CROPS, ERAS, ERA_ICONS, GOALS, HAND_TOOLS, IMPLEMENTS, ITEMS, UPGRADES, upCost, type Tab } from './data';
import { price, trend } from './economy';
import { PARCELS, owned } from './farm';
import { parcelPrice, parcelLevel } from './world';
import { SKILLS, SKMAP, BRANCHES, freePoints, lockReason } from './skills';
import { WALLS } from './walls';

const $ = (id: string) => document.getElementById(id)!;

export interface Handlers {
  buy(id: string): void; buyParcel(id: number): void;
  sell(id: string): void; sellAll(): void; deliver(): void; prestige(): void;
  tool(i: number): void; crop(i: number): void;
  open(): void; close(): void;
  setting(k: string, v: unknown): void; reset(): void; fullscreen(): void;
  learn(id: string): void; toggleCam(): void;
  startNight(): void; restart(): void; wall(i: number): void;
}
let H: Handlers;
let panel: '' | 'shop' | 'market' | 'menu' | 'welcome' | 'skills' | 'over' = '';
let selSkill = 'a1';
let shopTab: Tab | 'land' | 'legacy' = 'def';
let welcomeHtml = '';

const tap = (el: HTMLElement, f: (e: Event) => void) => {
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
  el.addEventListener('click', (e) => { e.stopPropagation(); f(e); });
};

export function initUI(h: Handlers) {
  H = h;
  tap($('btnShop'), () => openPanel('shop'));
  tap($('btnMarket'), () => openPanel('market'));
  tap($('btnMenu'), () => openPanel('menu'));
  tap($('btnSkills'), () => openPanel('skills'));
  tap($('btnCam'), () => H.toggleCam());
  tap($('btnNight'), () => H.startNight());
  $('panelWrap').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'panelWrap') { if (panel !== 'over') closePanel(); return; }
    const b = t.closest('[data-a]') as HTMLElement | null;
    if (!b || (b as HTMLButtonElement).disabled) return;
    const a = b.dataset.a!, v = b.dataset.v!;
    switch (a) {
      case 'close': closePanel(); break;
      case 'restart': H.restart(); return;
      case 'node': selSkill = v; break;
      case 'learn': H.learn(v); break;
      case 'tab': shopTab = v as Tab; renderPanel(); break;
      case 'buy': H.buy(v); break;
      case 'parcel': H.buyParcel(Number(v)); break;
      case 'sell': H.sell(v); break;
      case 'sellAll': H.sellAll(); break;
      case 'deliver': H.deliver(); break;
      case 'prestige': H.prestige(); break;
      case 'sound': H.setting('sound', !game.s.settings.sound); break;
      case 'quality': H.setting('quality', v); break;
      case 'fs': H.fullscreen(); break;
      case 'diff': H.setting('diff', v); break;
      case 'reset': if (confirm('Apagar todo o progresso e começar do zero?')) H.reset(); break;
    }
    renderPanel();
  });
  $('panelWrap').addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'sens') { try { localStorage.setItem('tv-sens', t.value); } catch { /* */ } }
  });
}

export const isPanelOpen = () => panel !== '';

export function openPanel(p: typeof panel, html = '') {
  if (p === 'welcome' || p === 'over') welcomeHtml = html;
  panel = p;
  $('panelWrap').classList.remove('hidden');
  H.open();
  renderPanel();
}
export function closePanel() {
  if (!panel) return;
  panel = '';
  $('panelWrap').classList.add('hidden');
  H.close();
}
export function togglePanel(p: typeof panel) { if (panel === p) closePanel(); else openPanel(p); }

let lastPanelRender = 0;
export function refreshPanel(force = false) {
  if (!panel || panel === 'welcome' || panel === 'menu') return;
  const now = performance.now();
  if (!force && now - lastPanelRender < 300) return;
  renderPanel();
}

function renderPanel() {
  lastPanelRender = performance.now();
  const el = $('panel');
  const body = el.querySelector('.pbody') as HTMLElement | null;
  const scroll = body?.scrollTop ?? 0;
  const prevKind = el.dataset.kind + '|' + (panel === 'shop' ? shopTab : '');
  let head = '', tabs = '', content = '';
  const s = game.s;
  if (panel === 'shop') {
    head = '🛒 Loja da Fazenda';
    const T: [string, string][] = [['def', '🛡️ Defesa'], ['agro', '🌱 Agronomia'], ['mec', '🔧 Mecânica'], ['com', '💰 Comércio'], ['auto', '🤖 Automação'], ['build', '🏗️ Construções'], ['land', '🗺️ Terras'], ['legacy', '🌳 Legado']];
    tabs = `<div class="tabs scroll">${T.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${shopTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (shopTab === 'land') content = landTab();
    else if (shopTab === 'legacy') content = legacyTab();
    else content = UPGRADES.filter((u) => u.tab === shopTab).map((u) => {
      const l = lv(u.id); const maxed = l >= u.max; const lock = u.req?.(s) ?? null; const cost = upCost(u, l);
      return `<div class="item ${maxed ? 'maxed' : ''} ${lock ? 'locked' : ''}">
        <div class="ic">${u.icon}</div>
        <div class="it"><b>${u.name}</b> <span class="lvl">${u.max > 1 ? `Nv ${l}/${u.max}` : maxed ? 'Adquirido' : ''}</span><p>${lock && !maxed ? '🔒 ' + lock : u.desc(l)}</p></div>
        ${maxed ? '<div class="done">✔</div>' : `<button class="buy" data-a="buy" data-v="${u.id}" ${lock || s.money < cost ? 'disabled' : ''}>${fmt(cost)}</button>`}
      </div>`;
    }).join('');
  } else if (panel === 'market') {
    head = '📈 Mercado';
    const o = s.order;
    let orderHtml = '';
    if (o) {
      const have = s.inv[o.item] || 0; const it = ITEMS[o.item];
      const pay = Math.round(price(o.item) * o.qty * o.bonus);
      orderHtml = `<div class="order"><div class="ic">📦</div><div class="it"><b>Pedido especial</b><p>${o.qty}× ${it.icon} ${it.name} · bônus <b>×${o.bonus.toFixed(1)}</b> · ${Math.ceil(o.time / 60)} min</p>
        <div class="bar"><i style="width:${Math.min(100, (have / o.qty) * 100)}%"></i></div></div>
        <button class="buy" data-a="deliver" ${have < o.qty ? 'disabled' : ''}>Entregar<br>${fmt(pay)}</button></div>`;
    }
    const ids = Object.keys(s.inv).filter((k) => s.inv[k] > 0);
    let total = 0;
    const rows = ids.map((id) => {
      const it = ITEMS[id]; const p = price(id); const q = s.inv[id]; total += p * q;
      const tr = trend(id);
      const arrow = tr > 0.004 ? '<span class="up">▲</span>' : tr < -0.004 ? '<span class="dn">▼</span>' : '<span>■</span>';
      return `<div class="item"><div class="ic">${it.icon}</div><div class="it"><b>${it.name}</b> <span class="lvl">${q} un.</span><p>${fmt(p)} / un. ${arrow}</p></div>
        <button class="buy" data-a="sell" data-v="${id}">Vender<br>${fmt(p * q)}</button></div>`;
    }).join('');
    const prices = CROPS.filter((c) => c.level <= s.level).map((c) => {
      const tr = trend(c.id);
      return `<span class="chip">${c.icon} ${fmt(price(c.id))} ${tr > 0.004 ? '<span class="up">▲</span>' : tr < -0.004 ? '<span class="dn">▼</span>' : ''}</span>`;
    }).join('');
    content = orderHtml + `<div class="chips">${prices}</div>` + (rows || '<p class="empty">Silo vazio. Colha algo para vender! 🌾</p>') +
      (ids.length ? `<button class="big" data-a="sellAll">Vender tudo · ${fmt(total)}</button>` : '');
  } else if (panel === 'menu') {
    head = '⚙️ Menu';
    const q = s.settings.quality;
    let sens = '1';
    try { sens = localStorage.getItem('tv-sens') || '1'; } catch { /* */ }
    content = `
      <div class="row"><span>🔊 Som</span><button data-a="sound" class="tg ${s.settings.sound ? 'on' : ''}">${s.settings.sound ? 'Ligado' : 'Desligado'}</button></div>
      <div class="row"><span>💀 Dificuldade</span><span class="seg">${(['easy', 'normal', 'hard'] as const).map((k) => `<button data-a="diff" data-v="${k}" class="${(s.settings.diff ?? 'normal') === k ? 'on' : ''}">${{ easy: 'Fácil', normal: 'Normal', hard: 'Pesadelo' }[k]}</button>`).join('')}</span></div>
      <div class="row"><span>🎨 Gráficos</span><span class="seg">${(['auto', 'low', 'high'] as const).map((k) => `<button data-a="quality" data-v="${k}" class="${q === k ? 'on' : ''}">${{ auto: 'Auto', low: 'Leve', high: 'Bonito' }[k]}</button>`).join('')}</span></div>
      <div class="row"><span>👆 Sensibilidade</span><input id="sens" type="range" min="0.4" max="2.2" step="0.1" value="${sens}"></div>
      <div class="row"><span>⛶ Tela cheia</span><button data-a="fs">Alternar</button></div>
      <div class="help">
        <b>Toque:</b> joystick à esquerda para andar · arraste à direita para olhar · botão grande para usar a ferramenta (segure para repetir) · botão de cima para interagir.<br>
        <b>PC:</b> WASD anda · mouse olha · clique usa · E interage · 1-5 ferramentas · C troca semente · Shift corre · B loja · M mercado.
      </div>
      <div class="stats">Total ganho: <b>${fmt(s.totalEarned)}</b> · Colheitas: <b>${s.stats.harvested}</b> · Legado: <b>${s.legacy}</b> · Vitalidade: <b>${Math.round(vitality(s) * 100)}%</b></div>
      <div class="row"><span>🗑️ Recomeçar</span><button data-a="reset" class="danger">Apagar progresso</button></div>`;
  } else if (panel === 'skills') {
    head = `🌟 Habilidades <span class="pts">${freePoints()} ponto${freePoints() === 1 ? '' : 's'}</span>`;
    content = skillTree();
  } else if (panel === 'over') {
    head = '💀 A fazenda caiu';
    content = welcomeHtml;
  } else if (panel === 'welcome') {
    head = '🌅 Bem-vindo de volta!';
    content = welcomeHtml + '<button class="big" data-a="close">Continuar</button>';
  }
  const kind = panel + '|' + (panel === 'shop' ? shopTab : '');
  el.dataset.kind = panel;
  el.innerHTML = `<div class="phead"><h2>${head}</h2>${panel === 'over' ? '' : '<button class="x" data-a="close">✕</button>'}</div>${tabs}<div class="pbody scroll">${content}</div>`;
  if (kind === prevKind) (el.querySelector('.pbody') as HTMLElement).scrollTop = scroll;
}

function skillTree(): string {
  const s = game.s;
  const X = (b: number, x: number) => ((b + 0.5) / 3) * 100 + x * 9.5;
  const Y = (row: number) => 18 + row * 23;
  let lines = '';
  for (const k of SKILLS) for (const r of k.req) {
    const p = SKMAP[r];
    const on = (s.skills[r] || 0) > 0;
    lines += `<line x1="${X(p.branch, p.x)}" y1="${Y(p.row)}" x2="${X(k.branch, k.x)}" y2="${Y(k.row)}" stroke="${on ? BRANCHES[k.branch].color : '#d9cfb8'}" stroke-width="${on ? 4 : 3}" vector-effect="non-scaling-stroke" stroke-linecap="round"/>`;
  }
  const heads = BRANCHES.map((b, i) => `<div class="bhead" style="left:${((i + 0.5) / 3) * 100}%;color:${b.color}">${b.icon} ${b.name}</div>`).join('');
  const nodes = SKILLS.map((k) => {
    const r = s.skills[k.id] || 0;
    const lock = lockReason(k.id);
    const st = r >= k.ranks ? 'max' : r > 0 ? 'part' : lock ? 'lock' : freePoints() > 0 ? 'avail' : '';
    return `<button class="node ${st} ${selSkill === k.id ? 'sel' : ''}" data-a="node" data-v="${k.id}" style="left:${X(k.branch, k.x)}%;top:${Y(k.row)}%;--c:${BRANCHES[k.branch].color}"><span>${lock && !r ? '🔒' : k.icon}</span><i>${r}/${k.ranks}</i></button>`;
  }).join('');
  const k = SKMAP[selSkill];
  const r = s.skills[k.id] || 0;
  const lock = lockReason(k.id);
  const can = !lock && r < k.ranks && freePoints() > 0;
  const info = `<div class="nodeInfo"><div class="ic">${k.icon}</div><div class="it"><b>${k.name}</b> <span class="lvl">${r}/${k.ranks}</span><p>${k.desc(r)}${lock ? ' · 🔒 ' + lock : ''}</p></div>
    ${r >= k.ranks ? '<div class="done">✔</div>' : `<button class="buy" data-a="learn" data-v="${k.id}" ${can ? '' : 'disabled'}>Aprender<br>1 ⭐</button>`}</div>`;
  return `<p class="note">Você ganha 1 ponto ⭐ a cada nível (e mais com o Legado). Toque num nó para ver os detalhes.</p>
    <div class="tree"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${heads}${nodes}</div>${info}`;
}

function landTab(): string {
  const s = game.s; const n = s.parcels.length;
  const cost = parcelPrice(n), lvlReq = parcelLevel(n);
  const free = PARCELS.filter((p) => !owned[p.id]);
  if (!free.length) return '<p class="empty">Você já é dono de todas as terras! 🏆</p>';
  return `<p class="note">Cada terreno tem 100 canteiros. Também dá para comprar pelas placas no campo.</p>` + free.map((p) => {
    const lock = s.level < lvlReq ? `🔒 Requer nível ${lvlReq}` : '';
    return `<div class="item ${lock ? 'locked' : ''}"><div class="ic">🗺️</div><div class="it"><b>Terreno ${p.id + 1}</b><p>${lock || (p.fert > 1 ? `Solo fértil: +${Math.round((p.fert - 1) * 100)}% de produção` : 'Solo comum')}</p></div>
      <button class="buy" data-a="parcel" data-v="${p.id}" ${lock || s.money < cost ? 'disabled' : ''}>${fmt(cost)}</button></div>`;
  }).join('');
}

function legacyTab(): string {
  const s = game.s; const gain = legacyGain(s);
  const ok = s.level >= 12 && gain > 0;
  return `<div class="legacy"><div class="ic big">🌳</div>
    <p><b>Legado da Terra</b>: venda a fazenda e recomece com bônus permanentes.</p>
    <p>Cada ponto de legado dá <b>+10% no preço de venda</b>, <b>+5% de crescimento</b> e <b>+$100</b> iniciais. A fazenda renasce mais viva.</p>
    <p>Pontos atuais: <b>${s.legacy}</b> · Ganharia agora: <b>+${gain}</b></p>
    <button class="big" data-a="prestige" ${ok ? '' : 'disabled'}>${ok ? `Plantar Legado (+${gain})` : '🔒 Requer nível 12'}</button></div>`;
}

// ------------------------------------------------------------------ HUD
export function updateHud() {
  const s = game.s;
  $('money').textContent = fmt(s.money);
  $('lvlNum').textContent = String(s.level);
  ($('xpBar') as HTMLElement).style.width = Math.min(100, (s.xp / xpNeed(s.level)) * 100) + '%';
  const e = era(s);
  $('era').textContent = `${ERA_ICONS[e]} ${ERAS[e]}`;
  const g = GOALS[s.goal];
  if (g) {
    const [cur, need] = g.prog(s);
    $('goalText').textContent = g.text;
    ($('goalBar') as HTMLElement).style.width = Math.min(100, (cur / need) * 100) + '%';
    $('goalReward').textContent = `${Math.min(cur, need).toLocaleString('pt-BR')}/${need.toLocaleString('pt-BR')}${g.reward ? ' · 🎁 ' + fmt(g.reward) : ''}`;
  } else {
    $('goalText').textContent = 'Fazenda lendária! Continue crescendo 🌟';
    ($('goalBar') as HTMLElement).style.width = '100%';
    $('goalReward').textContent = '';
  }
  ($('canBar') as HTMLElement).style.width = (s.can / canCap()) * 100 + '%';
  const used = siloUsed(), cap = siloCap();
  ($('siloBar') as HTMLElement).style.width = Math.min(100, (used / cap) * 100) + '%';
  $('mSilo').classList.toggle('full', used >= cap);
  $('siloTxt').textContent = `${used}/${cap}`;
  $('mCan').style.display = s.inTractor ? 'none' : '';
  const fp = freePoints();
  const b = $('skBadge');
  b.textContent = String(fp);
  b.classList.toggle('hidden', fp <= 0);
  $('btnCam').classList.toggle('hidden', !s.inTractor);
}

export function setPhase(phase: 'day' | 'night', n: number, left: number, zombies: number, raining: boolean) {
  const night = phase === 'night';
  document.body.classList.toggle('isNight', night);
  $('clockIcon').textContent = night ? '🧟' : raining ? '🌧️' : '☀️';
  const m = Math.floor(Math.max(0, left) / 60), sec = Math.floor(Math.max(0, left) % 60);
  $('clockTxt').textContent = night ? `Noite ${n} · ${zombies} restantes` : `Dia ${n} · noite em ${m}:${String(sec).padStart(2, '0')}`;
  $('btnNight').classList.toggle('hidden', night);
}

export function setPreview(html: string) {
  const el = $('wavePreview');
  if (el.dataset.h === html) return;
  el.dataset.h = html;
  el.innerHTML = html;
  el.classList.toggle('hidden', !html);
}

export function setVitals(hp: number, base: number) {
  ($('hpBar') as HTMLElement).style.width = Math.max(0, hp) * 100 + '%';
  ($('baseBar') as HTMLElement).style.width = Math.max(0, base) * 100 + '%';
  $('mBase').classList.toggle('danger', base < 0.35);
  $('mHp').classList.toggle('danger', hp < 0.35);
}

let hurtV = 0;
export function hurt(k: number) {
  hurtV = Math.min(1, hurtV + k);
  const el = $('hurt');
  el.style.opacity = String(hurtV);
  clearTimeout((hurt as any).t);
  (hurt as any).t = setTimeout(function fade() { hurtV *= 0.8; el.style.opacity = String(hurtV); if (hurtV > 0.02) (hurt as any).t = setTimeout(fade, 50); else el.style.opacity = '0'; }, 120);
}

export function setClock(dayTime: number, day: number, raining: boolean) {
  const h = dayTime < 0.7 ? 6 + (dayTime / 0.7) * 12 : 18 + ((dayTime - 0.7) / 0.3) * 12;
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 6) * 10;
  const night = hh >= 19 || hh < 6;
  $('clockIcon').textContent = raining ? '🌧️' : night ? '🌙' : hh < 8 || hh >= 17 ? '🌅' : '☀️';
  $('clockTxt').textContent = `Dia ${day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

let toolKey = '';
export function renderToolbar(inTractor: boolean) {
  const s = game.s;
  const list = (inTractor ? IMPLEMENTS : HAND_TOOLS).map((t, i) => ({ ...t, i })).filter((t) => inTractor || t.i !== 5 || lv('multi'));
  const sel = inTractor ? s.implement : s.tool;
  const key = `${inTractor}|${sel}|${list.length}`;
  if (key !== toolKey) {
    toolKey = key;
    const tb = $('toolbar');
    tb.innerHTML = list.map((t) => `<button class="slot ${t.i === sel ? 'on' : ''}" data-i="${t.i}"><span class="ti">${t.icon}</span><span class="tn">${t.name}</span><span class="tk">${t.i + 1}</span></button>`).join('');
    tb.querySelectorAll('button').forEach((b) => tap(b as HTMLElement, () => H.tool(Number((b as HTMLElement).dataset.i))));
  }
  renderCropbar(inTractor);
}

let cropKey = '';
let lastWall = 0;
export function renderCropbar(inTractor: boolean, wallSel = lastWall) {
  const s = game.s;
  lastWall = wallSel;
  const building = !inTractor && s.tool === 6;
  const show = building || (inTractor ? s.implement === 1 : s.tool === 1 || s.tool === 5);
  const cb = $('cropbar');
  cb.classList.toggle('hidden', !show);
  const key = `${show}|${building}|${s.crop}|${s.level}|${wallSel}`;
  if (!show || key === cropKey) return;
  cropKey = key;
  if (building) {
    cb.innerHTML = WALLS.map((w, i) => {
      const lock = s.level < w.level;
      return `<button class="crop wide ${i === wallSel ? 'on' : ''} ${lock ? 'locked' : ''}" data-i="${i}" ${lock ? 'disabled' : ''}><span>${lock ? '🔒' : w.icon}</span><small>${lock ? 'Nv ' + w.level : w.name + ' $' + w.cost}</small></button>`;
    }).join('');
    cb.querySelectorAll('button').forEach((b) => tap(b as HTMLElement, () => H.wall(Number((b as HTMLElement).dataset.i))));
    return;
  }
  cb.innerHTML = CROPS.map((c, i) => {
    const lock = s.level < c.level;
    return `<button class="crop ${i === s.crop ? 'on' : ''} ${lock ? 'locked' : ''}" data-i="${i}" ${lock ? 'disabled' : ''}><span>${lock ? '🔒' : c.icon}</span><small>${lock ? 'Nv ' + c.level : '$' + c.seed}</small></button>`;
  }).join('');
  cb.querySelectorAll('button').forEach((b) => tap(b as HTMLElement, () => H.crop(Number((b as HTMLElement).dataset.i))));
}
export function invalidateBars() { toolKey = ''; cropKey = ''; }

export function setActionIcon(icon: string) { $('btnAction').textContent = icon; }

let interactLabel: string | null = '';
export function setInteract(label: string | null, touch: boolean) {
  if (label === interactLabel) return;
  interactLabel = label;
  const b = $('btnInteract');
  b.classList.toggle('hidden', !label);
  b.textContent = label || '';
  const hint = $('hint');
  hint.textContent = label && !touch ? `[E] ${label}` : '';
  hint.classList.toggle('hidden', !label || touch);
}

let tileKey = '';
export function setTileInfo(html: string) {
  if (html === tileKey) return;
  tileKey = html;
  const el = $('tileInfo');
  el.innerHTML = html;
  el.classList.toggle('hidden', !html);
}

// ------------------------------------------------------------------ efeitos de texto
const v3 = new THREE.Vector3();
let floatCount = 0;
export function float3d(text: string, pos: THREE.Vector3, camera: THREE.Camera, cls = '') {
  if (floatCount > 40) return;
  v3.copy(pos).project(camera);
  if (v3.z > 1) return;
  const x = (v3.x * 0.5 + 0.5) * window.innerWidth, y = (-v3.y * 0.5 + 0.5) * window.innerHeight;
  floatAt(text, x, y, cls);
}
export function floatAt(text: string, x: number, y: number, cls = '') {
  const d = document.createElement('div');
  d.className = 'float ' + cls;
  d.textContent = text;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  $('floaters').appendChild(d);
  floatCount++;
  setTimeout(() => { d.remove(); floatCount--; }, 1300);
}

const recent = new Map<string, number>();
export function toast(msg: string, kind = '') {
  const now = performance.now();
  if ((recent.get(msg) || 0) > now - 1800) return;
  recent.set(msg, now);
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.innerHTML = msg;
  const box = $('toasts');
  box.appendChild(d);
  while (box.children.length > 3) box.firstChild!.remove();
  setTimeout(() => d.classList.add('out'), 2600);
  setTimeout(() => d.remove(), 3000);
}

let bannerT: ReturnType<typeof setTimeout> | undefined;
export function banner(title: string, sub: string) {
  const b = $('banner');
  b.innerHTML = `<div class="bt">${title}</div><div class="bs">${sub}</div>`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.remove('show'), 3200);
}

let comboShown = 0;
export function setCombo(n: number) {
  const c = $('combo');
  if (n < 3) { if (comboShown) { c.classList.remove('show'); comboShown = 0; } return; }
  if (n === comboShown) return;
  comboShown = n;
  c.innerHTML = `COMBO <b>×${n}</b>`;
  c.classList.remove('pop'); void c.offsetWidth; c.classList.add('show', 'pop');
}

export function pulse(id: string) {
  const e = $(id); e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse');
}
