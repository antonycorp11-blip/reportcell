# 🚀 Guia Completo: Como Executar a Aplicação

## ✅ **Opção 1: Instalação Rápida (Recomendado)**

### **Passo 1: Instalar Homebrew (se ainda não tiver)**

Abra o **Terminal** e execute:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- Digite sua senha quando solicitado
- Aguarde a instalação (pode levar alguns minutos)

### **Passo 2: Instalar Node.js via Homebrew**

```bash
brew install node
```

### **Passo 3: Verificar instalação**

```bash
node --version
npm --version
```

Você deve ver algo como:
```
v20.x.x
10.x.x
```

---

## 🎯 **Executando a Aplicação**

### **1. Navegar até a pasta do projeto**

```bash
cd "/Users/aquillesantonysantiagosantos/Downloads/relatório-de-célula---gestão-semanal"
```

### **2. Instalar dependências**

```bash
npm install
```

Isso vai instalar:
- React 19.2.3
- React DOM 19.2.3
- Vite 6.2.0
- TypeScript 5.8.2
- E outras dependências

**Tempo estimado:** 1-3 minutos

### **3. Iniciar o servidor de desenvolvimento**

```bash
npm run dev
```

Você verá algo como:

```
  VITE v6.2.0  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
  ➜  press h + enter to show help
```

### **4. Abrir no navegador**

Acesse: **http://localhost:3000**

---

## 📱 **O que você verá:**

1. **Tela Inicial** - Opções de Entrar, Criar conta ou Sou Líder
2. **Cadastro** - Criar seu discipulado
3. **Dashboard** - Visualizar totais de células e cultos
4. **Relatórios** - Gerar relatórios visuais e de texto

---

## ⚡ **Opção 2: Instalação Direta do Node.js (Sem Homebrew)**

Se preferir não usar Homebrew:

### **1. Baixar Node.js**

Acesse: https://nodejs.org/

Baixe a versão **LTS (Long Term Support)**

### **2. Instalar o pacote .pkg**

- Abra o arquivo baixado
- Siga o assistente de instalação
- Clique em "Continuar" até finalizar

### **3. Verificar instalação**

Abra o Terminal e execute:

```bash
node --version
npm --version
```

### **4. Seguir passos de "Executando a Aplicação" acima**

---

## 🛠️ **Comandos Úteis**

### **Parar o servidor:**
Pressione `Ctrl + C` no terminal

### **Reinstalar dependências:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### **Build de produção:**
```bash
npm run build
```

### **Preview da build:**
```bash
npm run preview
```

---

## 🎨 **Recursos da Aplicação**

✅ **Geração automática de semanas** - Baseado na data atual  
✅ **Dashboard do Discipulador** - Visão geral de todos os líderes  
✅ **Dashboard do Líder** - Lançamento de presenças  
✅ **Relatórios Visuais** - Imagens PNG de alta qualidade  
✅ **Relatórios de Texto** - Formatado para WhatsApp  
✅ **Dark Mode** - Interface moderna e elegante  
✅ **Persistência Local** - Dados salvos no navegador  

---

## 🐛 **Solução de Problemas**

### **Erro: "npm: command not found"**
- Node.js não está instalado ou não está no PATH
- Solução: Reinstalar Node.js ou adicionar ao PATH

### **Erro: "EACCES: permission denied"**
```bash
sudo chown -R $(whoami) ~/.npm
```

### **Porta 3000 já em uso:**
```bash
# Matar processo na porta 3000
lsof -ti:3000 | xargs kill -9

# Ou usar outra porta
npm run dev -- --port 3001
```

### **Erro ao instalar dependências:**
```bash
# Limpar cache do npm
npm cache clean --force

# Reinstalar
npm install
```

---

## 📊 **Estrutura do Projeto**

```
relatório-de-célula---gestão-semanal/
├── App.tsx              # Componente principal
├── constants.tsx        # Ícones e geração de semanas
├── types.ts             # Tipos TypeScript
├── index.tsx            # Ponto de entrada
├── index.html           # Template HTML
├── index.css            # Estilos globais
├── package.json         # Dependências
├── vite.config.ts       # Configuração Vite
└── tsconfig.json        # Configuração TypeScript
```

---

## 🎯 **Próximos Passos Após Instalar**

1. ✅ Execute `npm install`
2. ✅ Execute `npm run dev`
3. ✅ Acesse http://localhost:3000
4. ✅ Crie uma conta de discipulador
5. ✅ Adicione líderes
6. ✅ Lance presenças
7. ✅ Gere relatórios!

---

## 💡 **Dicas**

- **Hot Reload:** O Vite recarrega automaticamente ao salvar arquivos
- **Console:** Pressione F12 para abrir o DevTools
- **Dados:** Salvos no localStorage do navegador
- **Limpar dados:** Abra DevTools → Application → Local Storage → Clear

---

**Qualquer dúvida, estou aqui para ajudar! 🚀**
