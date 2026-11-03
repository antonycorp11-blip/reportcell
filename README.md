# 🌱 Terra Viva

Simulador de fazenda **3D em primeira pessoa**, com progressão incremental. Roda no navegador, foi feito pensando primeiro no celular e funciona também no PC.

## Como rodar
```bash
npm install
npm run dev      # desenvolvimento (abre na rede local para testar no celular)
npm run build    # gera dist/ para deploy (Vercel/Netlify)
```

## Ciclo de jogo
Arar → Plantar → Regar → Colher → Vender → Investir (terras, máquinas, automação)

- **5 eras:** Manual → Motorizada (trator) → Industrial (moinho/prensa) → Automação (drones) → Tecnológica (Legado)
- **6 culturas:** trigo, milho, girassol, abóbora, morango, lavanda
- **Solo vivo:** água e fertilidade em cada canteiro; rotação de culturas aumenta a fertilidade
- **Combos de colheita** com bônus em XP e dinheiro
- **Mercado dinâmico** com preços que oscilam e pedidos especiais com bônus
- **Cadeias de produção:** trigo vira farinha, girassol vira óleo
- **Automação:** aspersores, drones que colhem, plantio automático, caminhão de vendas e ganhos offline
- **Prestígio "Legado da Terra":** dá bônus permanentes
- **Visual que evolui:** a grama fica mais verde, aparecem flores, pássaros e borboletas conforme você progride; ciclo de dia e noite e chuva

## Controles
- **Celular:** joystick à esquerda para andar · arrastar à direita para olhar · botão grande usa a ferramenta (segure para repetir) · botão verde para interagir
- **PC:** WASD · mouse · clique · E · 1-5 · C (semente) · Shift · B (loja) · M (mercado)

Feito com Three.js + TypeScript + Vite. Todos os modelos 3D são gerados por código.
