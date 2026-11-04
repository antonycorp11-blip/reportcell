import { game, sk } from './state';

export interface SkillDef {
  id: string; branch: number; name: string; icon: string; ranks: number;
  desc: (r: number) => string; req: string[]; x: number; row: number;
}

export const BRANCHES = [
  { name: 'Agronomia', icon: '🌱', color: '#5fae45' },
  { name: 'Mecânica', icon: '⚙️', color: '#e8862c' },
  { name: 'Comércio', icon: '💰', color: '#3d8fd6' },
];

// x: -1 esquerda, 0 centro, 1 direita · row: 0..3
export const SKILLS: SkillDef[] = [
  { id: 'a1', branch: 0, name: 'Mão Verde', icon: '🌿', ranks: 3, x: 0, row: 0, req: [], desc: (r) => `Plantas crescem +8% mais rápido por ponto (atual +${r * 8}%)` },
  { id: 'a2', branch: 0, name: 'Raízes Profundas', icon: '💧', ranks: 3, x: -1, row: 1, req: ['a1'], desc: (r) => `Água evapora 12% mais devagar por ponto (atual -${r * 12}%)` },
  { id: 'a3', branch: 0, name: 'Colheita Farta', icon: '🧺', ranks: 3, x: 1, row: 1, req: ['a1'], desc: (r) => `+10% de produção por ponto (atual +${r * 10}%)` },
  { id: 'a5', branch: 0, name: 'Dança da Chuva', icon: '🌧️', ranks: 1, x: -1, row: 2, req: ['a2'], desc: () => 'Chove com mais frequência e mais forte' },
  { id: 'a4', branch: 0, name: 'Rotação Mestre', icon: '♻️', ranks: 1, x: 1, row: 2, req: ['a3'], desc: () => 'Rotação de culturas dá o dobro de fertilidade e repetir a cultura cansa menos o solo' },
  { id: 'a6', branch: 0, name: 'Safra Dourada', icon: '✨', ranks: 1, x: 0, row: 3, req: ['a4', 'a5'], desc: () => '6% de chance de colheita dourada: produção ×5' },

  { id: 'm1', branch: 1, name: 'Braço Forte', icon: '💪', ranks: 3, x: 0, row: 0, req: [], desc: (r) => `Ferramentas manuais 15% mais rápidas por ponto (atual +${r * 15}%)` },
  { id: 'm2', branch: 1, name: 'Passo Ligeiro', icon: '👟', ranks: 3, x: -1, row: 1, req: ['m1'], desc: (r) => `+8% de velocidade a pé por ponto (atual +${r * 8}%)` },
  { id: 'm3', branch: 1, name: 'Motor Afinado', icon: '🔩', ranks: 3, x: 1, row: 1, req: ['m1'], desc: (r) => `Trator +10% mais rápido por ponto (atual +${r * 10}%)` },
  { id: 'm5', branch: 1, name: 'Regador Mágico', icon: '🚿', ranks: 1, x: -1, row: 2, req: ['m2'], desc: () => 'O regador se enche sozinho aos poucos' },
  { id: 'm4', branch: 1, name: 'Piloto GPS', icon: '🛰️', ranks: 1, x: 1, row: 2, req: ['m3'], desc: () => 'O trator se alinha sozinho nas fileiras e centraliza nos canteiros' },
  { id: 'm6', branch: 1, name: 'Implemento Duplo', icon: '🚜', ranks: 1, x: 0, row: 3, req: ['m4', 'm5'], desc: () => '+2 fileiras de largura em todos os implementos' },

  { id: 'c1', branch: 2, name: 'Lábia', icon: '🗣️', ranks: 3, x: 0, row: 0, req: [], desc: (r) => `+5% no preço de venda por ponto (atual +${r * 5}%)` },
  { id: 'c2', branch: 2, name: 'Contatos', icon: '📇', ranks: 2, x: -1, row: 1, req: ['c1'], desc: (r) => `Pedidos especiais pagam +0,3× de bônus por ponto (atual +${(r * 0.3).toFixed(1)}×)` },
  { id: 'c3', branch: 2, name: 'Armazém', icon: '📦', ranks: 3, x: 1, row: 1, req: ['c1'], desc: (r) => `+25% de capacidade do silo por ponto (atual +${r * 25}%)` },
  { id: 'c4', branch: 2, name: 'Combo Lucrativo', icon: '🔥', ranks: 2, x: -1, row: 2, req: ['c2'], desc: (r) => `Bônus de combo ×${r + 2} (atual ×${r + 1})` },
  { id: 'c5', branch: 2, name: 'Investidor', icon: '🏦', ranks: 1, x: 1, row: 2, req: ['c3'], desc: () => 'Rende juros: +0,5% do seu dinheiro a cada minuto' },
  { id: 'c6', branch: 2, name: 'Magnata', icon: '👑', ranks: 1, x: 0, row: 3, req: ['c4', 'c5'], desc: () => '+15% em todas as vendas' },
];
export const SKMAP: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((k) => [k.id, k]));

export function spentPoints(): number {
  let n = 0;
  for (const k in game.s.skills) n += game.s.skills[k];
  return n;
}
export const totalPoints = () => game.s.level - 1 + game.s.legacy;
export const freePoints = () => totalPoints() - spentPoints();

export function lockReason(id: string): string | null {
  const d = SKMAP[id];
  for (const r of d.req) if (!sk(r)) return `Requer ${SKMAP[r].name}`;
  return null;
}

export function learn(id: string): boolean {
  const d = SKMAP[id];
  if (sk(id) >= d.ranks || lockReason(id) || freePoints() <= 0) return false;
  game.s.skills[id] = sk(id) + 1;
  return true;
}
