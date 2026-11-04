import type { State } from './state';

export interface CropDef {
  id: string; name: string; icon: string;
  seed: number; price: number; time: number; xp: number; level: number;
  def: string; role: string;
}

export const CROPS: CropDef[] = [
  { id: 'wheat', name: 'Trigo', icon: '🌾', seed: 2, price: 7, time: 20, xp: 2, level: 1, def: 'Trigo-Navalha', role: 'Corta e deixa lento quem pisa nele' },
  { id: 'corn', name: 'Milho', icon: '🌽', seed: 6, price: 18, time: 35, xp: 4, level: 2, def: 'Milho-Artilheiro', role: 'Atira grãos (alcance 15 m)' },
  { id: 'sunflower', name: 'Girassol', icon: '🌻', seed: 12, price: 34, time: 50, xp: 7, level: 4, def: 'Girassol-Laser', role: 'Raio solar de longo alcance (19 m)' },
  { id: 'pumpkin', name: 'Abóbora', icon: '🎃', seed: 25, price: 70, time: 60, xp: 12, level: 5, def: 'Abóbora-Bomba', role: 'Muro resistente que explode' },
  { id: 'strawberry', name: 'Morango', icon: '🍓', seed: 40, price: 105, time: 70, xp: 18, level: 7, def: 'Morango-Ácido', role: 'Arremessa ácido que envenena em área' },
  { id: 'lavender', name: 'Lavanda', icon: '💜', seed: 70, price: 180, time: 80, xp: 28, level: 9, def: 'Lavanda-Sonífera', role: 'Aura que deixa zumbis lentos e fere' },
  { id: 'cactus', name: 'Cacto', icon: '🌵', seed: 10, price: 24, time: 45, xp: 5, level: 3, def: 'Cacto-Muralha', role: 'Muralha resistente: espinhos ferem quem morde' },
  { id: 'pepper', name: 'Pimenta', icon: '🌶️', seed: 30, price: 85, time: 65, xp: 14, level: 6, def: 'Pimenta-Dragão', role: 'Cospe fogo de perto e queima em área' },
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

export type Tab = 'def' | 'agro' | 'mec' | 'com' | 'auto' | 'build';

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
  // Defesa
  { id: 'rage', tab: 'def', name: 'Raiva Verde', icon: '😡', max: 10, base: 120, mult: 1.75, desc: (l) => `Plantas causam +15% de dano por nível (atual +${l * 15}%)` },
  { id: 'fort', tab: 'def', name: 'Porão Reforçado', icon: '🏠', max: 6, base: 150, mult: 2.1, desc: (l) => `Vida da família: ${Math.round(150 * (1 + 0.5 * l))} → ${Math.round(150 * (1 + 0.5 * (l + 1)))}` },
  { id: 'blade', tab: 'def', name: 'Pá Afiada', icon: '🗡️', max: 5, base: 90, mult: 2, desc: (l) => `+30% de dano corpo a corpo por nível (atual +${l * 30}%)` },
  { id: 'medkit', tab: 'def', name: 'Kit Médico', icon: '❤️', max: 3, base: 200, mult: 2.5, desc: (l) => `Sua vida: ${100 + 40 * l} → ${100 + 40 * (l + 1)} e regenera mais rápido` },
  { id: 'seedgun', tab: 'def', name: 'Lança-Sementes', icon: '🔫', max: 1, base: 500, mult: 1, desc: () => 'Sua arma passa a atirar sementes à distância (mira automática)', req: L(3) },
  { id: 'ammo', tab: 'def', name: 'Munição Turbinada', icon: '💥', max: 5, base: 350, mult: 2.1, desc: (l) => `+25% de dano do Lança-Sementes por nível (atual +${l * 25}%)`, req: U('seedgun', 'Lança-Sementes') },

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
  { text: 'Plante 4 trigos — à noite eles viram Trigo-Navalha', prog: (s) => [s.stats.planted, 4], reward: 20 },
  { text: 'Regue as plantas (encha o regador no poço)', prog: (s) => [s.stats.watered, 4], reward: 20 },
  { text: 'Deixe as plantas amadurecerem e sobreviva à 1ª noite', prog: (s) => [s.nights, 1], reward: 50 },
  { text: 'Plante 10 Milhos-Artilheiros', prog: (s) => [s.stats.corn, 10], reward: 60 },
  { text: 'Elimine 25 zumbis', prog: (s) => [s.stats.kills, 25], reward: 80 },
  { text: 'Venda colheita no Mercado 📈', prog: (s) => [Math.min(s.stats.sold, 1), 1], reward: 40 },
  { text: 'Sobreviva à 3ª noite', prog: (s) => [s.nights, 3], reward: 150 },
  { text: 'Compre o Trator (atropela zumbis!)', prog: (s) => [has(s, 'tractor'), 1], reward: 100 },
  { text: 'Compre o Lança-Sementes', prog: (s) => [has(s, 'seedgun'), 1], reward: 150 },
  { text: 'Construa uma expansão da fazenda', prog: (s) => [s.parcels.length, 2], reward: 150 },
  { text: 'Derrote o Colosso da 5ª noite', prog: (s) => [s.nights, 5], reward: 500 },
  { text: 'Elimine 300 zumbis', prog: (s) => [s.stats.kills, 300], reward: 600 },
  { text: 'Fortifique a casa 3 vezes', prog: (s) => [has(s, 'fort'), 3], reward: 800 },
  { text: 'Sobreviva à 8ª noite', prog: (s) => [s.nights, 8], reward: 1500 },
  { text: 'Contrate os Colhedores Robôs', prog: (s) => [has(s, 'robots'), 1], reward: 1500 },
  { text: 'Derrote o Colosso da 10ª noite', prog: (s) => [s.nights, 10], reward: 4000 },
  { text: 'Tenha 6 áreas de plantio', prog: (s) => [s.parcels.length, 6], reward: 6000 },
  { text: 'Sobreviva à 15ª noite', prog: (s) => [s.nights, 15], reward: 12000 },
  { text: 'Sobreviva à 20ª noite — lenda do apocalipse', prog: (s) => [s.nights, 20], reward: 40000 },
];

export const ERAS = ['Sobrevivente', 'Motorizado', 'Fortaleza', 'Automação', 'Lenda'];
export const ERA_ICONS = ['🧑‍🌾', '🚜', '🏭', '🤖', '🚀'];

export const HAND_TOOLS = [
  { name: 'Enxada', icon: '⛏️' },
  { name: 'Sementes', icon: '🌱' },
  { name: 'Regador', icon: '💧' },
  { name: 'Foice', icon: '🌾' },
  { name: 'Arma', icon: '🗡️' },
  { name: 'Multiuso', icon: '✨' },
  { name: 'Construir', icon: '🧱' },
];

export const IMPLEMENTS = [
  { name: 'Arado', icon: '⛏️' },
  { name: 'Plantadeira', icon: '🌱' },
  { name: 'Pulverizador', icon: '💦' },
  { name: 'Colhedora', icon: '🌾' },
];
