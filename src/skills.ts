import { game, statCache } from './state';

export interface SNode {
  id: string; branch: number; name: string; icon: string; desc: string; cost: number;
  stat?: string; val?: number; key?: boolean; parent: string | null; x: number; y: number;
}

export const BRANCHES = [
  { name: 'Fúria Verde', icon: 'leaf', color: '#7dff5a', angle: -Math.PI / 2 },
  { name: 'Cultivo', icon: 'wheat', color: '#ffcf3a', angle: Math.PI / 6 },
  { name: 'Sobrevivência', icon: 'shield', color: '#4ac8ff', angle: (Math.PI * 5) / 6 },
];

const STAT_TXT: Record<string, (v: number) => string> = {
  pdmg: (v) => `+${v}% de dano das plantas`,
  php: (v) => `+${v}% de vida das plantas`,
  range: (v) => `+${v}% de alcance das plantas`,
  rate: (v) => `Plantas atacam ${v}% mais rápido`,
  growth: (v) => `+${v}% de velocidade de crescimento`,
  yield: (v) => `+${v}% de produção na colheita`,
  water: (v) => `Água evapora ${v}% mais devagar`,
  tool: (v) => `Ferramentas ${v}% mais rápidas`,
  tractor: (v) => `Trator ${v}% mais rápido`,
  can: (v) => `+${v} de capacidade do regador`,
  udmg: (v) => `+${v}% de dano da sua arma`,
  uhp: (v) => `+${v} de vida máxima`,
  base: (v) => `+${v}% de vida da casa`,
  kill: (v) => `+${v}% de dinheiro por zumbi`,
  walk: (v) => `+${v}% de velocidade a pé`,
  sell: (v) => `+${v}% no preço de venda`,
  order: (v) => `Pedidos especiais pagam +${v}% de bônus`,
};

type Def = [id: string, name: string, icon: string, stat: string, val: number] | [id: string, name: string, icon: string, desc: string];
const isKey = (d: Def) => d.length === 4;

/** Cada ramo: espinha (do centro para fora) + duas forquilhas. */
const TREE: { spine: Def[]; forkA: { at: number; nodes: Def[] }; forkB: { at: number; nodes: Def[] } }[] = [
  {
    spine: [
      ['f1', 'Seiva Brava', 'sword', 'pdmg', 6], ['f2', 'Casca Grossa', 'shield', 'php', 10], ['f3', 'Espinhos Afiados', 'fist', 'pdmg', 6],
      ['f4', 'Raízes Longas', 'satellite', 'range', 6], ['f5', 'Ódio Vegetal', 'flame', 'pdmg', 8], ['f6', 'Clorofila Turbo', 'bolt', 'rate', 8],
      ['d2', 'Fotossíntese Furiosa', 'sun', 'Plantas atacam +25% mais rápido e o laser do girassol atravessa zumbis'],
    ],
    forkA: { at: 1, nodes: [['f7', 'Fibra Dura', 'shield', 'php', 12], ['f8', 'Seiva Curativa', 'heart', 'php', 12], ['d1', 'Raízes de Aço', 'chain', 'Plantas ganham +50% de vida e se curam durante a noite']] },
    forkB: { at: 3, nodes: [['f9', 'Pólen Certeiro', 'target', 'range', 8], ['f10', 'Fúria Ancestral', 'flame', 'pdmg', 8], ['d3', 'Veteranas', 'medal', 'Plantas sobem de nível com metade dos abates']] },
  },
  {
    spine: [
      ['g1', 'Mão Verde', 'sprout', 'growth', 6], ['g2', 'Colheita Farta', 'basket', 'yield', 8], ['g3', 'Adubo Vivo', 'leaf', 'growth', 6],
      ['a4', 'Rotação Mestre', 'recycle', 'Rotação de culturas dá o dobro de fertilidade e repetir cansa menos o solo'],
      ['g4', 'Celeiro Cheio', 'wheat', 'yield', 8], ['g5', 'Sol Generoso', 'sun', 'growth', 8],
      ['a6', 'Safra Dourada', 'star', '6% de chance de colheita dourada: produção ×5'],
    ],
    forkA: { at: 1, nodes: [['g6', 'Braço Forte', 'fist', 'tool', 12], ['g7', 'Motor Afinado', 'gear', 'tractor', 12], ['m4', 'Piloto GPS', 'satellite', 'O trator se alinha sozinho nas fileiras e centraliza nos canteiros'], ['m6', 'Implemento Duplo', 'tractor', '+2 fileiras de largura em todos os implementos']] },
    forkB: { at: 3, nodes: [['g8', 'Regador Fundo', 'bucket', 'can', 6], ['g9', 'Raízes Profundas', 'drop', 'water', 15], ['m5', 'Regador Mágico', 'drop', 'O regador se enche sozinho aos poucos'], ['a5', 'Dança da Chuva', 'rain', 'Chove com mais frequência e mais forte']] },
  },
  {
    spine: [
      ['s1', 'Pá Pesada', 'hammer', 'udmg', 12], ['s2', 'Couro Grosso', 'heart', 'uhp', 20], ['s3', 'Tijolo Extra', 'brick', 'base', 10],
      ['s4', 'Caçador', 'coin', 'kill', 10], ['s5', 'Golpe Certeiro', 'target', 'udmg', 15], ['s6', 'Muralhas', 'castle', 'base', 12],
      ['d4', 'Fortaleza Viva', 'house', 'A casa se regenera 3 de vida por segundo durante a noite'],
    ],
    forkA: { at: 1, nodes: [['s7', 'Passo Ligeiro', 'boot', 'walk', 8], ['s8', 'Fôlego', 'wind', 'uhp', 25], ['c4', 'Combo Lucrativo', 'flame', 'Bônus de combo de colheita em dobro']] },
    forkB: { at: 3, nodes: [['s9', 'Lábia', 'talk', 'sell', 6], ['s10', 'Contatos', 'basket', 'order', 20], ['c5', 'Investidor', 'bank', 'Rende juros: +0,5% do seu dinheiro a cada minuto'], ['c6', 'Magnata', 'crown', '+15% em todas as vendas']] },
  },
];

export const NODES: SNode[] = [{ id: 'root', branch: -1, name: 'Coração da Terra', icon: 'earth', desc: 'A última terra viva. Tudo começa aqui. Desbloqueie os nós ligados a ele com pontos ⭐.', cost: 0, parent: null, x: 0, y: 0 }];
const R = 92;
TREE.forEach((br, b) => {
  const A = BRANCHES[b].angle;
  const mk = (d: Def, parent: string, x: number, y: number) => {
    const key = isKey(d);
    NODES.push({
      id: d[0], branch: b, name: d[1], icon: d[2], parent, x, y, key, cost: key ? 2 : 1,
      desc: key ? (d[3] as string) : STAT_TXT[d[3] as string](d[4] as number),
      stat: key ? undefined : (d[3] as string), val: key ? undefined : (d[4] as number),
    });
  };
  br.spine.forEach((d, i) => {
    const r = R * (i + 1.2);
    mk(d, i === 0 ? 'root' : br.spine[i - 1][0], Math.cos(A) * r, Math.sin(A) * r);
  });
  for (const [fork, side] of [[br.forkA, -1], [br.forkB, 1]] as const) {
    const base = br.spine[fork.at][0];
    const r0 = R * (fork.at + 1.2);
    fork.nodes.forEach((d, k) => {
      const r = r0 + R * 0.62 * (k + 1);
      const a = A + side * (0.42 + k * 0.08) * (1.6 / (fork.at + 1.6));
      mk(d, k === 0 ? base : fork.nodes[k - 1][0], Math.cos(a) * r + Math.cos(A + side * Math.PI / 2) * 38 * (k + 1), Math.sin(a) * r + Math.sin(A + side * Math.PI / 2) * 38 * (k + 1));
    });
  }
});
export const NMAP: Record<string, SNode> = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const has = (id: string) => id === 'root' || (game.s.skills[id] || 0) > 0;
export function spentPoints(): number { let n = 0; for (const k in game.s.skills) if (NMAP[k] && game.s.skills[k] > 0) n += NMAP[k].cost; return n; }
export const totalPoints = () => game.s.level - 1 + game.s.legacy + game.s.nights;
export const freePoints = () => totalPoints() - spentPoints();
export const available = (id: string) => !has(id) && !!NMAP[id].parent && has(NMAP[id].parent!);

export function lockReason(id: string): string | null {
  const n = NMAP[id];
  if (n.parent && !has(n.parent)) return `Requer ${NMAP[n.parent].name}`;
  if (freePoints() < n.cost) return `Precisa de ${n.cost} ponto${n.cost > 1 ? 's' : ''}`;
  return null;
}

export function learn(id: string): boolean {
  if (has(id) || lockReason(id)) return false;
  game.s.skills[id] = 1;
  recalcStats();
  return true;
}

/** Soma os bônus genéricos dos nós aprendidos. */
export function recalcStats() {
  for (const k of Object.keys(statCache)) delete statCache[k];
  for (const n of NODES) if (n.stat && has(n.id)) statCache[n.stat] = (statCache[n.stat] || 0) + (n.val || 0);
}
