import { icon } from './icons';

export const INTRO = [
  { bg: 'linear-gradient(180deg,#2b3a3a,#4a6a4a)', art: ['rain', 'drop', 'rain'], title: 'Começou como uma chuva comum.', text: 'Mas a água caiu verde. Tinha o cheiro dos venenos das lavouras que cercavam a cidade.' },
  { bg: 'linear-gradient(180deg,#1a1022,#3a1a2a)', art: ['skull', 'moon', 'skull'], title: 'Quem se molhou… mudou.', text: 'De dia, só febre. Mas quando escurecia, eles acordavam com fome. A cidade caiu em três noites.' },
  { bg: 'linear-gradient(180deg,#3a2a1a,#7a5a2a)', art: ['house', 'heart', 'house'], title: 'Pegamos as crianças e fugimos.', text: 'Ana, Bia, Léo e eu. Para a fazendinha do Vô Zé, o único lugar longe de tudo.' },
  { bg: 'linear-gradient(180deg,#1a3a1a,#3a7a2a)', art: ['sprout', 'eye', 'sprout'], title: 'Foi lá que vimos.', text: 'A mesma chuva acordou as plantas. Quando escurece, elas abrem os olhos… e lutam por nós.' },
  { bg: 'linear-gradient(180deg,#2a1a0a,#8a3a1a)', art: ['sun', 'shield', 'moon'], title: 'Plante de dia. Sobreviva à noite.', text: 'Proteja sua família. Conserte o rádio. Alguém lá fora precisa saber que ainda existe terra viva.' },
];

/** Diário do pai — uma página por noite sobrevivida. */
export const DIARY: Record<number, string> = {
  1: 'Primeira noite. As crianças não dormiram. Eu também não. Mas o milho… o milho atirou neles. Atirou de verdade.',
  2: 'O Vô diz que a terra dele é teimosa. Hoje acredito. Os girassóis viraram faróis no escuro.',
  3: 'O rádio velho da cozinha chiou de madrugada. Uma voz. Cortada. Não contei pra Ana ainda.',
  4: 'A Bia deu nome pra cada planta. O Léo quer ser "Milho-Artilheiro" quando crescer.',
  5: 'Algo enorme veio do norte. O chão tremia. Se não fossem as abóboras… nem quero pensar.',
  6: 'A voz no rádio de novo: "Base Esperança… sobreviventes… sinalizem…". Existe gente lá fora.',
  7: 'A Ana costura enquanto a gente prega tábua. Ela diz que a casa tem cheiro de pão, apesar de tudo.',
  8: 'O Vô achou peças de uma torre de rádio no celeiro. Disse que dá pra montar, se eu trouxer metal.',
  9: 'As sementes mutantes brilham no escuro. O Vô mistura umas com as outras e ri sozinho.',
  10: 'Dez noites. Dez. A gente ainda tá aqui.',
  12: 'Os zumbis estão mais rápidos. Ou nós estamos mais cansados.',
  15: 'O Léo perguntou se a mamãe da escola dele virou zumbi. Eu não soube responder.',
  20: 'A fazenda virou uma ilha verde num mar cinza. Às vezes de cima dá pra ver o tamanho do que construímos.',
  25: 'Se o resgate não vier, pelo menos as plantas vão continuar. Essa terra está viva.',
};
export const diaryFor = (n: number) => DIARY[n] ?? ['Mais uma noite. Mais um amanhecer. As crianças riram hoje.', 'O Vô consertou a cerca cantando. Faz tempo que não ouvia música.', 'Contei as tábuas na porta: todas ainda lá.', 'Os vaga-lumes voltaram. A Bia diz que é sinal de sorte.'][n % 4];

/** Mensagens de rádio ao anoitecer. */
export const RADIO: Record<number, string> = {
  3: '📻 …kkhh… alguém… na escuta? …kkhh…',
  6: '📻 "Aqui é a Base Esperança. Se há sobreviventes, sinalizem pelo rádio."',
  8: '📻 "Base Esperança: sinal fraco… precisamos de uma antena para localizar vocês."',
  12: '📻 "Base Esperança: helicóptero disponível. Montem a torre e aguardem."',
};

export function introHtml(i: number): string {
  const p = INTRO[i];
  const art = p.art.map((a, k) => `<div class="ia ia${k}">${icon(a)}</div>`).join('');
  const dots = INTRO.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  return `<div class="intro" style="background:${p.bg}"><div class="irain"></div><div class="iart">${art}</div>
    <h1>${p.title}</h1><p>${p.text}</p>
    <div class="idots">${dots}</div>
    <div class="ibtns"><button class="iskip" data-i="skip">Pular</button><button class="inext" data-i="next">${i === INTRO.length - 1 ? 'Começar' : 'Continuar'} ▸</button></div></div>`;
}
