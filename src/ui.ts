import * as THREE from 'three';
import { game, fmt, xpNeed, era, siloCap, siloUsed, canCap, lv, legacyGain, vitality } from './state';
import { CROPS, isCropUnlocked, ERAS, ERA_ICONS, GOALS, HAND_TOOLS, IMPLEMENTS, ITEMS, UPGRADES, upCost, type Tab } from './data';
import { price, trend } from './economy';
import { PARCELS, owned, isNextParcel } from './farm';
import { parcelPrice, parcelLevel } from './world';
import { NODES, NMAP, BRANCHES, freePoints, lockReason, has, available, type SNode } from './skills';
import { WALLS } from './walls';
import { icon, RES } from './icons';

const $ = (id: string) => document.getElementById(id)!;

export interface Handlers {
  buy(id: string): void; buyParcel(id: number): void;
  sell(id: string): void; sellAll(): void; deliver(): void; prestige(): void;
  tool(i: number): void; crop(i: number): void;
  open(): void; close(): void;
  setting(k: string, v: unknown): void; reset(): void; fullscreen(): void;
  learn(id: string): void; toggleCam(): void;
  startNight(): void; restart(): void; wall(i: number): void; npc(v: string): void; weapon(id: string): void;
  aerial(): void; zoom(d: number): void;
}
let H: Handlers;
let panel: '' | 'shop' | 'market' | 'menu' | 'welcome' | 'skills' | 'over' | 'hub' | 'grade' | 'npc' = '';
export const blocking = () => panel === 'grade' || panel === 'over' || panel === 'welcome';
let selSkill = 'root';
let shopTab: Tab | 'land' | 'legacy' = 'def';
let welcomeHtml = '';

let lastTap = 0;
const tap = (el: HTMLElement, f: (e: Event) => void) => {
  let down = false;
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); down = true; });
  el.addEventListener('pointerup', (e) => { e.stopPropagation(); if (!down) return; down = false; lastTap = performance.now(); f(e); });
  el.addEventListener('pointercancel', () => { down = false; });
  el.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });
};

export function initUI(h: Handlers) {
  H = h;
  tap($('btnShop'), () => openPanel('shop'));
  tap($('btnMarket'), () => openPanel('market'));
  tap($('btnMenu'), () => openPanel('menu'));
  tap($('btnSkills'), () => openPanel('skills'));
  tap($('btnCam'), () => H.toggleCam());
  tap($('btnNight'), () => H.startNight());
  tap($('btnAerial'), () => H.aerial());
  tap($('btnHub'), () => togglePanel('hub'));
  tap($('btnAerialBack'), () => H.aerial());
  tap($('btnZoomIn'), () => H.zoom(-1));
  tap($('btnZoomOut'), () => H.zoom(1));
  $('panelWrap').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'panelWrap') { if (panel !== 'over' && performance.now() - lastTap > 500) closePanel(); return; }
    const b = t.closest('[data-a]') as HTMLElement | null;
    if (!b || (b as HTMLButtonElement).disabled) return;
    const a = b.dataset.a!, v = b.dataset.v!;
    switch (a) {
      case 'close': closePanel(); break;
      case 'restart': H.restart(); return;
      case 'npc': H.npc(v); return;
      case 'node': if (dragged) { dragged = false; return; } selSkill = v; break;
      case 'go': openPanel(v as typeof panel); return;
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
  if (p === 'welcome' || p === 'over' || p === 'grade' || p === 'npc') welcomeHtml = html;
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
  if (!panel || panel === 'welcome' || panel === 'menu' || panel === 'hub') return;
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
    const T: [string, string][] = [['def', '🛡️ Defesa'], ['agro', '🌱 Agronomia'], ['mec', '🔧 Mecânica'], ['com', '💰 Comércio'], ['auto', '🤖 Automação'], ['build', '🏗️ Construções'], ['land', '🏗️ Expansões'], ['legacy', '🌳 Legado']];
    tabs = `<div class="tabs scroll">${T.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${shopTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (shopTab === 'land') content = landTab();
    else if (shopTab === 'legacy') content = legacyTab();
    else content = UPGRADES.filter((u) => u.tab === shopTab && u.id !== 'seedgun').map((u) => {
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
    const prices = CROPS.filter((c, i) => isCropUnlocked(s, i)).map((c) => {
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
    head = `🌳 Árvore da Vida <span class="pts">⭐ ${freePoints()}</span>`;
    content = skillTree();
  } else if (panel === 'hub') {
    head = '☰ Fazenda';
    const fp = freePoints();
    const used = siloUsed(), cap = siloCap();
    content = `<div class="hub">
      <button data-a="go" data-v="shop"><span>🛒</span><b>Loja</b><small>Defesas, melhorias, expansões</small></button>
      <button data-a="go" data-v="skills"><span>⭐</span><b>Habilidades</b><small>${fp > 0 ? `<em>${fp} ponto${fp > 1 ? 's' : ''} livre${fp > 1 ? 's' : ''}!</em>` : 'Árvore de talentos'}</small></button>
      <button data-a="go" data-v="market"><span>📈</span><b>Mercado</b><small>Silo ${used}/${cap}</small></button>
      <button data-a="go" data-v="menu"><span>⚙️</span><b>Ajustes</b><small>Som, gráficos, dificuldade</small></button>
    </div>`;
  } else if (panel === 'npc') {
    head = '💬 Família';
    content = welcomeHtml;
  } else if (panel === 'grade') {
    head = '🌅 Amanhecer';
    content = welcomeHtml;
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
  if (panel === 'skills') bindTree();
}

const TW = 2200;
const tv = { x: 0, y: 0, z: 0.9, init: false };
let dragged = false;
function skillTree(): string {
  const s = game.s;
  const fp = freePoints();
  const C = (n: SNode) => (n.branch < 0 ? '#ffffff' : BRANCHES[n.branch].color);
  let lines = '';
  for (const n of NODES) {
    if (!n.parent) continue;
    const p = NMAP[n.parent];
    const on = has(n.id);
    const av = !on && has(p.id);
    lines += `<line x1="${p.x}" y1="${p.y}" x2="${n.x}" y2="${n.y}" class="${on ? 'on' : av ? 'av' : ''}" style="--c:${C(n)}"/>`;
  }
  const nodes = NODES.map((n) => {
    const own = has(n.id);
    const av = available(n.id);
    const st = own ? 'own' : av ? (fp >= n.cost ? 'canbuy' : 'reach') : 'lock';
    return `<button class="sn ${st} ${n.key ? 'key' : ''} ${n.id === 'root' ? 'root' : ''} ${selSkill === n.id ? 'sel' : ''}" data-a="node" data-v="${n.id}" style="left:${n.x + TW / 2}px;top:${n.y + TW / 2}px;--c:${C(n)}"><span>${n.icon}</span>${n.key && !own ? `<i>${n.cost}⭐</i>` : ''}</button>`;
  }).join('');
  const labels = BRANCHES.map((b) => `<div class="blabel" style="left:${Math.cos(b.angle) * 830 + TW / 2}px;top:${Math.sin(b.angle) * 830 + TW / 2}px;color:${b.color}">${b.icon} ${b.name}</div>`).join('');
  const n = NMAP[selSkill] ?? NMAP.root;
  const own = has(n.id);
  const lock = own ? null : lockReason(n.id);
  const info = `<div class="sinfo" style="--c:${C(n)}"><div class="si">${n.icon}</div><div class="it"><b>${n.name}${n.key ? ' <span class="kt">NÓ-CHAVE</span>' : ''}</b><p>${n.desc}</p></div>
    ${own ? '<div class="done">✔</div>' : `<button class="buy" data-a="learn" data-v="${n.id}" ${lock ? 'disabled' : ''}>${lock && lock.startsWith('Requer') ? '🔒' : 'Desbloquear'}<br>${n.cost} ⭐</button>`}</div>`;
  void s;
  return `<div class="stree" id="stree"><div class="sworld" id="sworld" style="width:${TW}px;height:${TW}px">
      <svg width="${TW}" height="${TW}" viewBox="${-TW / 2} ${-TW / 2} ${TW} ${TW}">${lines}</svg>${labels}${nodes}</div>
      <div class="shint">Arraste para explorar · pinça ou roda para zoom</div></div>${info}`;
}

function bindTree() {
  const el = document.getElementById('stree');
  const w = document.getElementById('sworld');
  if (!el || !w) return;
  const apply = () => { w.style.transform = `translate(${tv.x}px, ${tv.y}px) scale(${tv.z})`; };
  if (!tv.init) { tv.init = true; tv.z = Math.min(1, el.clientHeight / 900); tv.x = el.clientWidth / 2 - (TW / 2) * tv.z; tv.y = el.clientHeight / 2 - (TW / 2) * tv.z + 40 * tv.z; }
  apply();
  const pts = new Map<number, { x: number; y: number }>();
  let start = { x: 0, y: 0 }, pinch = 0;
  el.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { x: e.clientX, y: e.clientY }; dragged = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  el.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
      pinch = d; dragged = true;
      return;
    }
    tv.x += e.clientX - p.x; tv.y += e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) dragged = true;
    apply();
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  el.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 0.88 : 1.14); }, { passive: false });
  function zoomAt(cx: number, cy: number, k: number) {
    const r = el!.getBoundingClientRect();
    const nz = Math.max(0.35, Math.min(1.8, tv.z * k));
    const px = cx - r.left, py = cy - r.top;
    tv.x = px - (px - tv.x) * (nz / tv.z); tv.y = py - (py - tv.y) * (nz / tv.z); tv.z = nz;
    apply();
  }
}

function landTab(): string {
  const s = game.s; const n = s.parcels.length;
  const cost = parcelPrice(n), lvlReq = parcelLevel(n);
  const free = PARCELS.filter((p) => !owned[p.id]);
  if (!free.length) return '<p class="empty">Sua fazenda ocupa todo o vale! 🏆</p>';
  return `<p class="note">Limpe e cerque novas áreas ao lado da fazenda (100 canteiros cada). Também dá para construir pelas estacas no campo.</p>` + free.filter((p) => isNextParcel(p.id)).map((p) => {
    const lock = s.level < lvlReq ? `🔒 Requer nível ${lvlReq}` : '';
    return `<div class="item ${lock ? 'locked' : ''}"><div class="ic">🏗️</div><div class="it"><b>Expansão ${p.id + 1}</b><p>${lock || (p.fert > 1 ? `Solo fértil: +${Math.round((p.fert - 1) * 100)}% de produção` : 'Solo comum')}</p></div>
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
  const C = 2 * Math.PI * 19;
  const ring = $('xpRing') as unknown as SVGCircleElement;
  ring.style.strokeDasharray = String(C);
  ring.style.strokeDashoffset = String(C * (1 - Math.min(1, s.xp / xpNeed(s.level))));
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
  $('canTxt').textContent = `${s.can}/${canCap()}`;
  const rr = $('resRow');
  const rk = RES.map((r) => s.res[r.id] || 0).join(',');
  if (rr.dataset.k !== rk) { rr.dataset.k = rk; rr.innerHTML = RES.map((r) => `<span class="rc" style="--c:${r.color}" title="${r.name}">${icon(r.icon)}<b>${s.res[r.id] || 0}</b></span>`).join(''); }
  const cn = document.getElementById('canNum');
  if (cn) { cn.textContent = String(s.can); cn.classList.toggle('empty', s.can === 0); }
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

export function setPhase(phase: 'day' | 'night', n: number, left: number, zombies: number, raining: boolean, prog = 0) {
  const night = phase === 'night';
  document.body.classList.toggle('isNight', night);
  ($('phaseBar') as HTMLElement).style.width = Math.max(0, Math.min(1, prog)) * 100 + '%';
  $('phase').classList.toggle('night', night);
  $('clockIcon').textContent = night ? '🧟' : raining ? '🌧️' : '☀️';
  const m = Math.floor(Math.max(0, left) / 60), sec = Math.floor(Math.max(0, left) % 60);
  $('clockTxt').innerHTML = night ? `<span class="cl">NOITE ${n}</span><b class="cd">🧟 ${zombies}</b>` : `<span class="cl">DIA ${n} · ANOITECE EM</span><b class="cd ${left <= 30 ? 'hot' : ''}">${m}:${String(sec).padStart(2, '0')}</b>`;
  $('btnNight').classList.toggle('hidden', night);
}

let bigT: ReturnType<typeof setTimeout> | undefined;
export function bigCount(n: number) {
  const el = $('bigCount');
  el.textContent = String(n);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(bigT); bigT = setTimeout(() => el.classList.remove('show'), 900);
}

export function setPreview(html: string) {
  const el = $('wavePreview');
  if (el.dataset.h === html) return;
  el.dataset.h = html;
  el.innerHTML = html;
  el.classList.toggle('hidden', !html);
}

export function setVitals(hp: number, base: number, hpV = 0, baseV = 0) {
  $('mHp').classList.toggle('hidden', hp >= 0.999);
  $('hpTxt').textContent = String(Math.ceil(hpV));
  $('baseTxt').textContent = String(Math.ceil(baseV));
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
    tb.innerHTML = list.map((t) => `<button class="slot ${t.i === sel ? 'on' : ''}" data-i="${t.i}"><span class="ti">${t.icon}</span><span class="tn">${t.name}</span><span class="tk">${t.i + 1}</span>${!inTractor && t.i === 2 ? '<i id="canNum" class="cnum"></i>' : ''}</button>`).join('');
    tb.querySelectorAll('button').forEach((b) => tap(b as HTMLElement, () => H.tool(Number((b as HTMLElement).dataset.i))));
  }
  renderCropbar(inTractor);
}

let cropKey = '';
let lastWall = 0;
export function renderCropbar(inTractor: boolean, wallSel = lastWall) {
  const s = game.s;
  lastWall = wallSel;
  const building = document.body.classList.contains('aerial') || (!inTractor && s.tool === 6);
  const arming = !inTractor && s.tool === 4 && !building;
  const show = building || arming || (inTractor ? s.implement === 1 : s.tool === 1 || s.tool === 5);
  const cb = $('cropbar');
  cb.classList.toggle('hidden', !show);
  const key = `${show}|${building}|${arming}|${s.weapon}|${Object.keys(s.up).join()}|${s.crop}|${s.level}|${wallSel}`;
  if (!show || key === cropKey) return;
  cropKey = key;
  if (arming) {
    const W: [string, string, string][] = [['pa', 'Pá', 'hammer'], ['axe', 'Machado', 'hammer'], ['scythe', 'Foice', 'sword'], ['gun', 'Espingarda', 'target'], ['flame', 'Chamas', 'flame']];
    cb.innerHTML = W.map(([id, n, ic]) => { const own = id === 'pa' || (s.up['w_' + id] || 0) > 0; return `<button class="crop wide ${s.weapon === id ? 'on' : ''} ${own ? '' : 'locked'}" data-w="${id}" ${own ? '' : 'disabled'}><span>${icon(own ? ic : 'chain')}</span><small>${own ? n : 'Vô Zé'}</small></button>`; }).join('');
    cb.querySelectorAll('button').forEach((b) => tap(b as HTMLElement, () => H.weapon((b as HTMLElement).dataset.w!)));
    return;
  }
  if (building) {
    cb.innerHTML = WALLS.map((w, i) => {
      const lock = s.level < w.level;
      return `<button class="crop wide ${i === wallSel ? 'on' : ''} ${lock ? 'locked' : ''}" data-i="${i}" ${lock ? 'disabled' : ''}><span>${lock ? '🔒' : w.icon}</span><small>${lock ? 'Nv ' + w.level : w.name}</small><em class="wcost">${Object.entries(w.cost).map(([k, v]) => `${v}${icon(k)}`).join(' ')}</em></button>`;
    }).join('');
    cb.querySelectorAll('button').forEach((b) => tap(b as HTMLElement, () => H.wall(Number((b as HTMLElement).dataset.i))));
    return;
  }
  cb.innerHTML = CROPS.map((c, i) => {
    if (c.mut && !isCropUnlocked(s, i)) return '';
    const lock = !isCropUnlocked(s, i);
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
