import { CROPS, ITEMS, PRODUCTS } from './data';
import { game, bus, earn, sellMult, siloCap, siloUsed, lv, sk, pct } from './state';
import * as farm from './farm';

function hash(s: string) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000; return h / 1000; }

export function marketMult(id: string, t = game.s.clock): number {
  const h = hash(id);
  return 1 + 0.18 * Math.sin(t / 75 + h * 6.283) + 0.07 * Math.sin(t / 21 + h * 17);
}
export const price = (id: string) => ITEMS[id].price * marketMult(id) * sellMult();
export const trend = (id: string) => marketMult(id) - marketMult(id, game.s.clock - 10);

export function sell(id: string, qty?: number, mult = 1): number {
  const inv = game.s.inv;
  const q = Math.min(inv[id] || 0, qty ?? Infinity);
  if (q <= 0) return 0;
  const gain = Math.round(price(id) * q * mult);
  inv[id] -= q;
  if (inv[id] <= 0) delete inv[id];
  game.s.stats.sold += q;
  earn(gain);
  return gain;
}

export function sellAll(mult = 1): number {
  let g = 0;
  for (const id of Object.keys(game.s.inv)) g += sell(id, undefined, mult);
  return g;
}

export function availableItems(): string[] {
  const s = game.s;
  const out = CROPS.filter((c) => c.level <= s.level).map((c) => c.id);
  for (const p of PRODUCTS) if (lv(p.building)) out.push(p.id);
  return out;
}

export function newOrder() {
  const items = availableItems();
  const item = items[Math.floor(Math.random() * items.length)];
  const base = 8 + game.s.level * 3;
  const qty = Math.round(base * (0.7 + Math.random() * 0.8) / (ITEMS[item].price > 60 ? 2 : 1));
  game.s.order = { item, qty: Math.max(5, Math.min(qty, Math.floor(siloCap() * 0.8))), bonus: 1.5 + Math.round(Math.random() * 7) / 10 , time: 300 };
  game.s.order.bonus *= pct('order');
}

export function deliver(): number {
  const o = game.s.order;
  if (!o || (game.s.inv[o.item] || 0) < o.qty) return 0;
  const g = sell(o.item, o.qty, o.bonus);
  newOrder();
  return g;
}

// ------------------------------------------------------- Simulação geral
let robotAcc = 0, truckAcc = 0, interestAcc = 0;
const procAcc: Record<string, number> = {};

export interface SimEvents { robotHarvest?: (t: number, units: number) => void; truck?: (gain: number) => void; interest?: (gain: number) => void }

export function simStep(dt: number, ev: SimEvents = {}) {
  const s = game.s;
  s.clock += dt;
  farm.step(dt);

  // Drones colhedores
  const rate = lv('robots') * 0.6;
  if (rate > 0) {
    robotAcc += dt * rate;
    while (robotAcc >= 1) {
      robotAcc -= 1;
      const t = farm.findRipe();
      if (t < 0) { robotAcc = 0; break; }
      const c = farm.T.c[t];
      const r = farm.harvest(t, 1);
      if (r === 'full' || !r) { robotAcc = 0; break; }
      ev.robotHarvest?.(t, r.units);
      if (lv('planter')) {
        farm.T.s[t] = 1;
        farm.plant(t, c);
      }
    }
  }

  // Processamento
  for (const p of PRODUCTS) {
    if (!lv(p.building)) continue;
    if ((s.inv[p.from] || 0) < p.ratio) { procAcc[p.id] = 0; continue; }
    procAcc[p.id] = (procAcc[p.id] || 0) + dt;
    while (procAcc[p.id] >= p.time && (s.inv[p.from] || 0) >= p.ratio) {
      procAcc[p.id] -= p.time;
      s.inv[p.from] -= p.ratio;
      if (s.inv[p.from] <= 0) delete s.inv[p.from];
      s.inv[p.id] = (s.inv[p.id] || 0) + 1;
      if (p.id === 'flour') s.stats.flour++; else s.stats.oil++;
    }
  }

  // Caminhão
  if (lv('truck')) {
    truckAcc += dt;
    if (truckAcc > 15) {
      truckAcc = 0;
      if (siloUsed() >= siloCap() * 0.75) { const g = sellAll(0.9); if (g > 0) ev.truck?.(g); }
    }
  }

  // Juros (habilidade Investidor)
  if (sk('c5')) {
    interestAcc += dt;
    if (interestAcc >= 60) { interestAcc -= 60; const g = Math.round(Math.min(s.money * 0.005, 400 * s.level)); if (g > 0) { earn(g); ev.interest?.(g); } }
  }

  // Pedido
  if (!s.order) newOrder();
  else {
    s.order.time -= dt;
    if (s.order.time <= 0) { newOrder(); bus.emit('order'); }
  }
}

export function isProcessing(building: string): boolean {
  const p = PRODUCTS.find((x) => x.building === building);
  return !!p && lv(building) > 0 && (game.s.inv[p.from] || 0) >= p.ratio;
}
