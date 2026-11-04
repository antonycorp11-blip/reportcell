# 🧟 Terra Viva: Última Colheita

O mundo acabou. Sua fazenda é a **última terra viva**. Durante o dia você planta, rega e colhe. À noite, hordas de zumbis atacam, e **as plantas maduras ganham vida para lutar**.

Jogo 3D em primeira pessoa que roda no navegador. Foi feito pensando primeiro no celular e funciona também no PC.

## Como rodar
```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera dist/ (publicado na Cloudflare via wrangler.jsonc)
```

## O ciclo do jogo
- **☀️ Dia (~3 min):** arar, plantar, regar e colher. O dilema: **colher dá dinheiro, deixar madura defende à noite**.
- **🌙 Noite:** zumbis saem da terra devastada rumo à sua casa. Se a casa cair, você recomeça com **pontos de Legado** permanentes.

## Tower defense
- **Rotas fixas:** os zumbis saem de portais e seguem caminhos até a casa. Durante o dia, **setas vermelhas animadas** no chão e **faróis com placas** mostram por onde e quantos virão.
- **Prévia da próxima noite:** mostra as rotas, os tipos de zumbi e a noite especial. Novas rotas abrem nas noites 2, 3, 5 e 7.
- **Construir (🧱):** Cerca (bloqueia a passagem), Espinhos (fere e deixa lento) e Isca (atrai zumbis). Usar a ferramenta numa barricada danificada a repara.
- **Noites especiais:** 🌕 Lua de Sangue, 🌫️ Neblina, 👥 Horda Dupla e 💀 Colosso. Terminar a noite sem a casa sofrer dano dá **🛡️ Defesa Perfeita ×1,5**.

## Plantas-defensoras
Ao anoitecer, as culturas maduras **se transformam em criaturas** (e voltam a ser plantas ao amanhecer).

| Cultura | Defensora | Papel |
|---|---|---|
| 🌾 Trigo | Trigo-Navalha | corta e deixa lento quem pisa |
| 🌽 Milho | Milho-Artilheiro | atira grãos |
| 🌻 Girassol | Girassol-Laser | raio de longo alcance |
| 🎃 Abóbora | Abóbora-Bomba | muro resistente que explode |
| 🍓 Morango | Morango-Ácido | ácido em área que envenena |
| 💜 Lavanda | Lavanda-Sonífera | aura que deixa lento e fere |

## Zumbis
Andarilho · Corredor · Brutamonte · Cavador (anda por baixo da terra) · Corvo-zumbi (voa) · **Colosso** (chefe a cada 5 noites)

## Progressão
- Loja com abas Defesa, Agronomia, Mecânica, Comércio, Automação, Construções e Terras.
- Árvore de habilidades com 3 ramos.
- Trator em 3ª pessoa, que também atropela zumbis.
- Arma do jogador: pá de combate e Lança-Sementes com mira automática.
- A fazenda vira um oásis verde conforme você sobrevive: animais, pomar, estufa, energia solar...

## Controles
- **Celular:** joystick à esquerda · arrastar à direita para olhar · botão grande usa a ferramenta ou ataca · botão verde para interagir · 🌙 para começar a noite
- **PC:** WASD · mouse · clique · E · 1-7 · C (semente) · N (começar a noite) · B (loja) · M (mercado) · K (habilidades) · V (câmera do trator)
