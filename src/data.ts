import type { State } from './state';

export interface CropDef {
  id: string; name: string; icon: string;
  seed: number; price: number; time: number; xp: number; level: number;
}

export const CROPS: CropDef[] = [
  { id: 'wheat', name: 'Trigo', icon: '🌾', seed: 2, price: 7, time: 30, xp: 2, level: 1 },
  { id: 'corn', name: 'Milho', icon: '🌽', seed: 6, price: 18, time: 55, xp: 4, level: 2 },
  { id: 'sunflower', name: 'Girassol', icon: '🌻', seed: 12, price: 34, time: 80, xp: 7, level: 4 },
  { id: 'pumpkin', name: 'Abóbora', icon: '🎃', seed: 25, price: 70, time: 115, xp: 12, level: 6 },
  { id: 'strawberry', name: 'Morango', icon: '🍓', seed: 40, price: 105, time: 140, xp: 18, level: 8 },
  { id: 'lavender', name: 'Lavanda', icon: '💜', seed: 70, price: 180, time: 180, xp: 28, level: 10 },
];

export interface ProductDef {
  id: string; name: string; icon: string; from: string; ratio: number;
  price: number; time: number; building: string;
}

export const PRODUCTS: ProductDef[] = [
  { id: 'flour', name: 'Farinha', icon: '🍞', from: 'wheat', ratio: 2, price: 30, time: 3, building: 'mill' },
  { id: 'oil', name: 'Óleo', icon: '🧴', from: 'sunflower', ratio: 2, price: 120, time: 4, building: 'press' },
];

export interface ItemDef { id: string; name: string; icon: string; price: number }
export const ITEMS: Record<string, ItemDef> = {};
for (const c of CROPS) ITEMS[c.id] = { id: c.id, name: c.name, icon: c.icon, price: c.price };
for (const p of PRODUCTS) ITEMS[p.id] = { id: p.id, name: p.name, icon: p.icon, price: p.price };

export type Tab = 'agro' | 'mec' | 'com' | 'auto' | 'build';

export interface UpDef {
  id: string; tab: Tab; name: string; icon: string; max: number;
  base: number; mult: number; desc: (l: number) => string;
  req?: (s: State) => string | null;
}

const L = (n: number) => (s: State) => (s.level >= n ? null : `Requer nível ${n}`);
const U = (id: string, name: string) => (s: State) => ((s.up[id] || 0) >= 1 ? null : `Requer ${name}`);
const all = (...fs: ((s: State) => string | null)[]) => (s: State) => {
  for (const f of fs) { const r = f(s); if (r) return r; }
  return null;
};

export const UPGRADES: UpDef[] = [
  // Agronomia
  { id: 'growth', tab: 'agro', name: 'Adubo Orgânico', icon: '🧪', max: 10, base: 60, mult: 1.75, desc: (l) => `Plantas crescem +12% mais rápido por nível (atual: +${l * 12}%)` },
  { id: 'yield', tab: 'agro', name: 'Sementes Selecionadas', icon: '🌱', max: 10, base: 120, mult: 1.8, desc: (l) => `+15% de produção por colheita (atual: +${l * 15}%)` },
  { id: 'retain', tab: 'agro', name: 'Solo Retentor', icon: '💧', max: 5, base: 90, mult: 2, desc: (l) => `A água evapora 15% mais devagar (atual: -${l * 15}%)` },
  // Mecânica
  { id: 'tool', tab: 'mec', name: 'Ferramentas Largas', icon: '🔧', max: 2, base: 150, mult: 6, desc: (l) => `Área das ferramentas: ${['1 canteiro', '5 em cruz', '3×3'][l]}${l < 2 ? ' → ' + ['5 em cruz', '3×3'][l] : ''}`, req: L(2) },
  { id: 'can', tab: 'mec', name: 'Regador Grande', icon: '🪣', max: 5, base: 50, mult: 2, desc: (l) => `Capacidade do regador: ${12 + 12 * l} → ${12 + 12 * (l + 1)}` },
  { id: 'boots', tab: 'mec', name: 'Botas Leves', icon: '👢', max: 5, base: 80, mult: 2, desc: (l) => `+10% velocidade de caminhada (atual: +${l * 10}%)` },
  { id: 'multi', tab: 'mec', name: 'Kit Multiuso', icon: '✨', max: 1, base: 500, mult: 1, desc: () => 'Nova ferramenta que faz a ação certa sozinha (arar, plantar, regar ou colher)', req: L(4) },
  { id: 'engine', tab: 'mec', name: 'Motor Turbo', icon: '⚙️', max: 5, base: 400, mult: 2.1, desc: (l) => `Trator +15% mais rápido (atual: +${l * 15}%)`, req: U('tractor', 'Trator') },
  { id: 'width', tab: 'mec', name: 'Implemento Largo', icon: '📏', max: 3, base: 600, mult: 3.5, desc: (l) => `Largura do implemento: ${1 + 2 * l} → ${3 + 2 * l} fileiras`, req: U('tractor', 'Trator') },
  // Comércio
  { id: 'price', tab: 'com', name: 'Negociador', icon: '🤝', max: 10, base: 100, mult: 1.8, desc: (l) => `+6% no preço de venda (atual: +${l * 6}%)` },
  { id: 'silo', tab: 'com', name: 'Silo Ampliado', icon: '🏚️', max: 10, base: 80, mult: 1.9, desc: (l) => `Capacidade do silo: ${80 * (1 + l)} → ${80 * (2 + l)}` },
  { id: 'truck', tab: 'com', name: 'Caminhão de Entrega', icon: '🚚', max: 1, base: 1500, mult: 1, desc: () => 'Vende automaticamente quando o silo passa de 75% (90% do preço)', req: L(6) },
  // Automação
  { id: 'sprinkler', tab: 'auto', name: 'Irrigação por Aspersão', icon: '🚿', max: 3, base: 1200, mult: 3, desc: (l) => `Aspersores regam todos os seus terrenos (nível ${l}/3)`, req: L(5) },
  { id: 'robots', tab: 'auto', name: 'Colhedores Robôs', icon: '🤖', max: 5, base: 3000, mult: 2.4, desc: (l) => `Drones colhem sozinhos: ${(l * 0.6).toFixed(1)} → ${((l + 1) * 0.6).toFixed(1)} canteiros/s`, req: L(7) },
  { id: 'planter', tab: 'auto', name: 'Plantio Automático', icon: '🧑‍🌾', max: 1, base: 5000, mult: 1, desc: () => 'Os drones replantam a mesma cultura após colher', req: all(L(8), U('robots', 'Colhedores Robôs')) },
  // Construções
  { id: 'tractor', tab: 'build', name: 'Trator', icon: '🚜', max: 1, base: 350, mult: 1, desc: () => 'Ara, planta, rega e colhe fileiras inteiras. Entre no trator no pátio!', req: L(3) },
  { id: 'mill', tab: 'build', name: 'Moinho', icon: '🌬️', max: 1, base: 2000, mult: 1, desc: () => 'Transforma 2 trigos em 1 farinha (vale muito mais)', req: L(5) },
  { id: 'press', tab: 'build', name: 'Prensa de Óleo', icon: '🏭', max: 1, base: 9000, mult: 1, desc: () => 'Transforma 2 girassóis em 1 óleo premium', req: L(8) },
];

export const UPMAP: Record<string, UpDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const upCost = (u: UpDef, l: number) => Math.round(u.base * Math.pow(u.mult, l));

export interface Goal { text: string; prog: (s: State) => [number, number]; reward: number }
const has = (s: State, id: string) => (s.up[id] || 0);

export const GOALS: Goal[] = [
  { text: 'Are 4 canteiros com a enxada', prog: (s) => [s.stats.plowed, 4], reward: 20 },
  { text: 'Plante 4 sementes de trigo', prog: (s) => [s.stats.planted, 4], reward: 20 },
  { text: 'Regue as plantas (encha o regador no poço)', prog: (s) => [s.stats.watered, 4], reward: 20 },
  { text: 'Colha 4 trigos maduros com a foice', prog: (s) => [s.stats.harvested, 4], reward: 30 },
  { text: 'Venda sua colheita no Mercado 📈', prog: (s) => [Math.min(s.stats.sold, 1), 1], reward: 30 },
  { text: 'Alcance o nível 2', prog: (s) => [s.level, 2], reward: 50 },
  { text: 'Plante 10 pés de milho', prog: (s) => [s.stats.corn, 10], reward: 60 },
  { text: 'Faça um combo de colheita x10', prog: (s) => [s.stats.maxCombo, 10], reward: 80 },
  { text: 'Compre o Trator (nível 3)', prog: (s) => [has(s, 'tractor'), 1], reward: 100 },
  { text: 'Compre um novo terreno', prog: (s) => [s.parcels.length, 2], reward: 150 },
  { text: 'Colha 200 culturas', prog: (s) => [s.stats.harvested, 200], reward: 250 },
  { text: 'Alcance o nível 5', prog: (s) => [s.level, 5], reward: 300 },
  { text: 'Construa o Moinho', prog: (s) => [has(s, 'mill'), 1], reward: 400 },
  { text: 'Produza 20 farinhas', prog: (s) => [s.stats.flour, 20], reward: 500 },
  { text: 'Instale a Irrigação por Aspersão', prog: (s) => [has(s, 'sprinkler'), 1], reward: 800 },
  { text: 'Tenha 4 terrenos', prog: (s) => [s.parcels.length, 4], reward: 1000 },
  { text: 'Contrate os Colhedores Robôs', prog: (s) => [has(s, 'robots'), 1], reward: 1500 },
  { text: 'Ganhe $50.000 no total', prog: (s) => [Math.floor(s.totalEarned), 50000], reward: 3000 },
  { text: 'Construa a Prensa de Óleo', prog: (s) => [has(s, 'press'), 1], reward: 4000 },
  { text: 'Alcance o nível 12', prog: (s) => [s.level, 12], reward: 8000 },
  { text: 'Plante seu Legado da Terra (Loja → Legado)', prog: (s) => [s.prestiges, 1], reward: 0 },
  { text: 'Tenha todos os 9 terrenos', prog: (s) => [s.parcels.length, 9], reward: 20000 },
  { text: 'Ganhe $1.000.000 no total', prog: (s) => [Math.floor(s.totalEarned), 1000000], reward: 50000 },
];

export const ERAS = ['Era Manual', 'Era Motorizada', 'Era Industrial', 'Era da Automação', 'Era Tecnológica'];
export const ERA_ICONS = ['🧑‍🌾', '🚜', '🏭', '🤖', '🚀'];

export const HAND_TOOLS = [
  { name: 'Enxada', icon: '⛏️' },
  { name: 'Sementes', icon: '🌱' },
  { name: 'Regador', icon: '💧' },
  { name: 'Foice', icon: '🌾' },
  { name: 'Multiuso', icon: '✨' },
];

export const IMPLEMENTS = [
  { name: 'Arado', icon: '⛏️' },
  { name: 'Plantadeira', icon: '🌱' },
  { name: 'Pulverizador', icon: '💦' },
  { name: 'Colhedora', icon: '🌾' },
];
