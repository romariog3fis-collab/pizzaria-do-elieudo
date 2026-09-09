# 🍕 Pizzaria do Elieudo — Guia de Continuação do Projeto (CONTINUE.md)

Este documento foi criado para registrar com total precisão o estado atual, a arquitetura, as credenciais e o roteiro do projeto para que qualquer desenvolvedor ou agente de Inteligência Artificial possa retomar o trabalho de onde paramos sem atrito.

---

## 🌐 1. Links de Acesso e Produção

| Recurso | URL | Observações |
| :--- | :--- | :--- |
| **Cardápio Digital (Cliente)** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/) | Responsivo, otimizado para celular e desktop. |
| **Painel Admin & KDS** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/admin.html](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/admin.html) | Tela de Cozinha, Relatórios, Cupons e Cardápio. |
| **PIN Padrão de Acesso Admin** | **`1234`** | Alterável pelo modal "Alterar PIN" no próprio painel. |
| **Console Firebase** | [https://console.firebase.google.com/project/pizzaria-do-elieudo/database](https://console.firebase.google.com/project/pizzaria-do-elieudo/database) | Projeto: `pizzaria-do-elieudo` |
| **Repositório GitHub** | [https://github.com/romariog3fis-collab/pizzaria-do-elieudo](https://github.com/romariog3fis-collab/pizzaria-do-elieudo) | Branch principal: `main` |

---

## 🚀 2. Estado Atual do Sistema (O Que Já Está Feito e 100% Funcional)

### ✅ Frente 1: Cardápio Interativo & Checkout Inteligente
- **Catálogo Completo:** Pizzas tradicionais, especiais, doces, bebidas e bordas recheadas.
- **Customização de Pedido:** Opção de pizza meio-a-meio (2 sabores), escolha de tamanho (P, M, G, Família), borda recheada, adicionais e campo para observações.
- **Validação de Cupons de Desconto:**
  - Campo `#input-cart-coupon` no carrinho do cliente com validação em tempo real contra cupons ativos no banco de dados.
  - Exibição destacada do desconto aplicado e cálculo automático do total final.
- **Fluxo de Checkout em Duas Etapas:**
  1. O cliente preenche os dados (Nome, Telefone, Entrega/Retirada, Pagamento, Troco).
  2. Clica no botão **`✅ Confirmar & Enviar Pedido`**: o pedido é **imediatamente salvo no Firebase Realtime Database** e na fila local.
  3. Salva automaticamente o ID do pedido no `localStorage` do dispositivo para rastreamento instantâneo.
  4. Abre o modal comemorativo de confirmação com ID (`#XXXX`), resumo e botões:
     - **`📲 Enviar Pedido para o WhatsApp`**: abre o WhatsApp com a mensagem formatada para a pizzaria e link de rastreamento.
     - **`🛵 Acompanhar Pedido em Tempo Real`**: abre diretamente o rastreamento ao vivo.

### ✅ Frente 2: Sistema de Acompanhamento de Pedido em Tempo Real (Order Tracking)
- **Stepper Visual Dinâmico (4 Etapas):**
  1. 📋 **Pedido Recebido:** Confirmado no sistema, aguardando início do preparo.
  2. 🔥 **No Forno / Cozinha:** Pizzaiolo abrindo a massa e assando no forno a lenha (com pulso visual âmbar).
  3. 🛵 / 🏪 **A Caminho / Balcão:**
     - Se Delivery: *"🛵 Saiu para Entrega! O motoboy está em rota para seu endereço."*
     - Se Balcão: *"🏪 Pronto para Retirada no Balcão da Pizzaria!"*
  4. 🎉 **Entregue / Concluído:** Pedido finalizado com sucesso e mensagem de agradecimento.
- **Sincronização 100% ao Vivo (Zero Reload):**
  - Ouvinte dinâmico `fbListenSingleOrder` no Firebase Realtime Database (`orders/ord_XXXX`).
  - Atualização instantânea na tela do cliente assim que o administrador altera o status no Kanban KDS.
  - Fallback offline robusto via `BroadcastChannel` e `localStorage`.
- **Múltiplos Pontos de Acesso do Cliente:**
  - **Link direto na mensagem do WhatsApp:** `/?pedido=5936` (abre o rastreamento automaticamente ao carregar a página).
  - **Botão no Cabeçalho:** Botão fixo **`🛵 Acompanhar Pedido`** no topo do cardápio digital.
  - **Barra Flutuante de Pedido Ativo:** Se o cliente já tiver um pedido em andamento no dispositivo, surge uma barra no topo informando o status atual e convidando ao toque para acompanhar.
  - **Campo de Busca:** Permite digitar qualquer número de pedido (ex: `1264` ou `#1264`) para consultar o status.
  - **Botão de Ajuda Direta:** Atalho para chamar a pizzaria no WhatsApp já com mensagem preenchida com o ID do pedido.

### ✅ Frente 3: Painel Administrativo com Bloqueio por PIN & KDS
- **Lockscreen Dark Glassmorphic:** Teclado numérico touch com suporte a clique e digitação física no teclado.
- **Autenticação em Sessão:** Guarda estado autenticado via `sessionStorage`.
- **Botão de Logout e Alteração de PIN:** Permite redefinir a senha numérica (com confirmação da senha atual) e sincroniza a nova senha na nuvem e localmente.
- **Kanban KDS Operacional (4 Colunas):**
  - Colunas: *1. Pendentes*, *2. No Forno / Cozinha*, *3. Saiu p/ Entrega*, *4. Finalizados*.
  - Ações em cada card: **`🖨️ Forno`** (comanda de cozinha sem preços), **`🧾 Cliente`** (recibo completo), avançar fase e **`📲 Avisar`** (dispara mensagem no WhatsApp do cliente com o link de rastreamento).

### ✅ Frente 4: Sincronização em Tempo Real (Cross-Device & Cross-Tab)
- **Zero Reload (Sem F5):** Qualquer pedido realizado pelo celular ou por outra aba chega instantaneamente ao Admin do computador.
- **Mecanismo Híbrido Triplo:**
  1. **Firebase Realtime Database:** Ouve os eventos `child_added`, `value` e `child_changed` em `/orders`, `/coupons` e `/admin_pin`.
  2. **BroadcastChannel (`elieudo_orders_bus`):** Sincroniza abas abertas no mesmo navegador em 0 milissegundos.
  3. **Storage Event Listener (`window.addEventListener('storage', ...)`):** Redundância local garantida.
- **Alerta Sonoro:** Notificação por Web Audio API sintetizado a cada novo pedido pendente.

### ✅ Frente 5: Motor de Cupons & Promoções (Admin)
- Aba dedicada no painel (`#tab-coupons`):
  - Formulário para criar cupom: Código (ex: `PIZZA10`), Tipo (% ou R$), Valor, Pedido Mínimo.
  - Tabela com status (Ativo / Pausado) e botão de Excluir.
  - Sincronizado automaticamente com o Firebase.

### ✅ Frente 6: Relatórios Financeiros & Fechamento de Caixa
- Aba dedicada no painel (`#tab-reports`):
  - **Filtros rápidos:** Hoje, Ontem, Últimos 7 Dias, Este Mês, Todo o Histórico.
  - **Cards de Métricas:** Faturamento Bruto, Ticket Médio, Total de Descontos e Total em Taxas de Entrega.
  - **Gráficos e Barras de Pagamento:** Distribuição percentual e em valor entre PIX, Cartão e Dinheiro.
  - **Modalidade:** Comparativo Balcão x Entrega.
  - **Top 5 Mais Vendidos:** Ranking de pizzas e bebidas mais pedidas no período.
  - **Fechamento de Caixa:**
    - Botão **`🖨️ Imprimir Fechamento`** com folha de estilo térmica (`@media print`) limpa e legível.
    - Botão **`📲 Copiar Resumo para WhatsApp`** para colar diretamente no grupo dos sócios/gerência.

---

## 📁 3. Estrutura de Arquivos

```text
d:\Antigravity\Pizzaria elieudo\
│
├── index.html               # Cardápio Digital, Carrinho, Modal de Sucesso e Modal de Rastreamento
├── admin.html               # Painel Admin: Lockscreen PIN, Kanban KDS, Cupons, Relatórios e Cardápio
│
├── css/
│   ├── style.css            # Estilo do Cardápio: Dark Glassmorphism, Stepper de Rastreamento e Banners
│   ├── admin.css            # Estilos do Painel Admin, KDS, Lockscreen, Cupons e Impressão Térmica
│   └── print.css            # Folha de estilo para impressão térmica 80mm de comandas
│
├── js/
│   ├── app.js               # Lógica do Cliente: carrinho, cupons, checkout, WhatsApp e Order Tracking
│   ├── admin.js             # Lógica do Admin: KDS, relatórios, fechamento de caixa, PIN, cupons e avisos WhatsApp
│   ├── firebase-config.js   # Sincronização em Nuvem (Firebase RTDB), ouvintes de pedidos e Fallback Local
│   └── menu-data.js         # Base inicial de produtos, categorias, tamanhos e dados da pizzaria
│
├── assets/                  # Imagens, logomarcas e ícones da pizzaria
├── database.rules.json      # Regras de segurança do Firebase Realtime Database
├── firebase.json            # Configuração do Firebase CLI
├── .firebaserc              # ID do projeto Firebase vinculado
└── CONTINUE.md              # Este arquivo de documentação e transição
```

---

## 🔧 4. Roteiro de Profissionalização & Próximos Passos

Para elevar o sistema a um patamar comercial de alto nível (estilo iFood/Zé Delivery), organize as seguintes ações estratégicas:

### 🌟 Ações de Profissionalização da Marca e Infraestrutura:

1. **Domínio Próprio Comercial (`.com.br`):**
   - Registrar domínio exclusivo no [Registro.br](https://registro.br) (ex: `pizzariadoelieudo.com.br` ou `pedir.pizzariadoelieudo.com.br`).
   - Apontar o DNS para a hospedagem, eliminando a URL padrão do GitHub e passando máxima credibilidade na bio do Instagram, WhatsApp e caixas de pizza.

2. **Hospedagem em Vercel ou Firebase Hosting (URLs Limpas & SSL Grátis):**
   - Os arquivos [`vercel.json`](file:///d:/Antigravity/Pizzaria%20elieudo/vercel.json) e [`firebase.json`](file:///d:/Antigravity/Pizzaria%20elieudo/firebase.json) já estão estruturados no projeto.
   - Habilitar rotas amigáveis (ex: `/admin` diretamente, sem necessidade de `.html`).
   - Conexão do domínio próprio em poucos cliques com certificado SSL (HTTPS) automatizado.

3. **Transformação em PWA (Progressive Web App - "Instale nosso App"):**
   - Criar `manifest.json` e registrar um `service-worker.js`.
   - Adicionar ícones de aplicativo com a logo da pizzaria nos tamanhos 192x192 e 512x512.
   - Permitir que clientes em Android e iPhone instalem o cardápio na tela inicial do celular, funcionando em tela cheia (standalone) como um app nativo sem precisar pagar taxas à Google Play ou Apple App Store.

4. **Pagamento PIX Automatizado (QR Code Dinâmico):**
   - Integrar gateway de pagamento (Mercado Pago, Asaas ou OpenPix).
   - Gerar QR Code dinâmico e código "Copia e Cola" com confirmação via webhook em tempo real.
   - O KDS da cozinha altera automaticamente o status do pedido para "Pago - Em Preparação" assim que o banco aprova o recebimento.

5. **Impressão Térmica Automática de Comandas (Cozinha & Motoboy):**
   - Utilizar a folha de estilo térmica já existente em [`css/admin.css`](file:///d:/Antigravity/Pizzaria%20elieudo/css/admin.css) e [`css/print.css`](file:///d:/Antigravity/Pizzaria%20elieudo/css/print.css).
   - Adicionar botão de disparo direto de impressão para impressoras térmicas (58mm/80mm como Elgin, Bematech ou Epson) para via do motoboy e filipeta de cozinha.

6. **Gestão de Mesas e Comandas (Modo Salão):**
   - Habilitar abertura rápida de pedidos por número de mesa para atendimento de garçons no salão.

---

## 💻 5. Comandos Úteis

### Como rodar localmente no terminal:
```powershell
# Usando Python:
python -m http.server 8000

# Usando Node.js (npx serve):
npx -y serve .
```

### Como publicar alterações para o GitHub Pages:
```powershell
git add .
git commit -m "sua mensagem descritiva"
git push origin main
```
*O GitHub Pages atualiza automaticamente em menos de 1 minuto após o push.*

### Como publicar via Vercel (Hospedagem Profissional):
```powershell
npx -y vercel --prod
```

### Como publicar via Firebase Hosting:
```powershell
firebase deploy --only hosting
```

