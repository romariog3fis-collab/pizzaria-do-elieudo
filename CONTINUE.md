# 🍕 Pizzaria do Elieudo — Guia de Continuação do Projeto (CONTINUE.md)

Este documento registra com total precisão o estado atual, a arquitetura, as credenciais, o histórico de resoluções e o roteiro do projeto para que qualquer desenvolvedor ou agente de Inteligência Artificial possa retomar o trabalho com clareza e agilidade.

---

## 🌐 1. Links de Acesso e Produção

| Recurso | URL | Observações |
| :--- | :--- | :--- |
| **Cardápio Digital (Cliente)** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/) | Responsivo, otimizado para celular e desktop. |
| **Comanda da Mesa (Exemplo)** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/?mesa=2&token=EXEMPLO](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/?mesa=2&token=EXEMPLO) | Acesso seguro e privado do cliente com token da sessão. |
| **PDV Mobile Salão & Garçom** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/pdv.html](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/pdv.html) | Tela mobile de abertura de mesa, QR Code e rodadas. |
| **Painel Admin, KDS & Salão** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/admin.html](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/admin.html) | Cozinha KDS, Mesas, Relatórios, Cupons e Estoque. |
| **PIN Padrão de Acesso Admin** | **`1234`** | Alterável pelo modal "Alterar PIN" no próprio painel. |
| **Console Firebase** | [https://console.firebase.google.com/project/pizzaria-do-elieudo/database](https://console.firebase.google.com/project/pizzaria-do-elieudo/database) | Projeto: `pizzaria-do-elieudo` |
| **Firebase Realtime Database** | `https://pizzaria-do-elieudo-default-rtdb.firebaseio.com/` | Banco em nuvem ativo e sincronizado. |
| **Repositório GitHub** | [https://github.com/romariog3fis-collab/pizzaria-do-elieudo](https://github.com/romariog3fis-collab/pizzaria-do-elieudo) | Branch principal: `main` |

---

## 🚀 2. Estado Atual do Sistema (100% Funcional e em Produção)

### ✅ Frente 1: Cardápio Interativo & Checkout Inteligente
- **Catálogo Completo:** Pizzas tradicionais, premium, doces, bebidas e bordas recheadas.
- **Customização de Pedido:** Opção de pizza meio-a-meio (2 sabores), escolha de tamanho (P, M, G, Família/GG), borda recheada, adicionais e campo para observações.
- **Validação de Cupons de Desconto:**
  - Campo `#input-cart-coupon` no carrinho do cliente com validação em tempo real contra cupons ativos no banco de dados.
  - Exibição destacada do desconto aplicado e cálculo automático do total final.
- **Fluxo de Checkout em Duas Etapas:**
  1. O cliente preenche os dados (Nome, Telefone, Entrega/Retirada, Pagamento, Troco).
  2. Clica no botão **`✅ Confirmar & Enviar Pedido`**: o pedido é **imediatamente salvo no Firebase Realtime Database** (`/orders/ord_XXXX`) e no `localStorage`.
  3. Salva o ID do pedido no `localStorage` (`elieudo_last_order_id`) para rastreamento persistente no dispositivo.
  4. Abre o modal comemorativo de confirmação com ID (`#XXXX`), resumo e botões de WhatsApp e Acompanhamento.

### ✅ Frente 2: Sistema de Acompanhamento de Pedido em Tempo Real (Order Tracking)
- **Stepper Visual Dinâmico (4 Etapas):**
  1. 📋 **Pedido Recebido:** Confirmado no sistema, aguardando início do preparo.
  2. 🔥 **No Forno / Cozinha:** Pizzaiolo montando e assando no forno a lenha (com pulso visual âmbar).
  3. 🛵 / 🏪 / 🍽️ **A Caminho / Balcão / Mesa:**
     - Se Delivery: *"🛵 Saiu para Entrega! O motoboy está em rota para seu endereço."*
     - Se Balcão: *"🏪 Pronto para Retirada no Balcão da Pizzaria!"*
     - Se Mesa: *"🍽️ Sendo servido na sua mesa!"*
  4. 🎉 **Entregue / Concluído:** Pedido finalizado com sucesso e mensagem de agradecimento.

### ✅ Frente 3: PDV Mobile Salão & Garçom (`pdv.html`)
- **Interface Mobile-First para Garçons:** Otimizada para uso em smartphones com uma mão.
- **Mapa Tátil de 15 Mesas:**
  - 🟢 **Verde (Livre):** Toque para abrir informando nome do cliente e número de pessoas.
  - 🔴 **Vermelho (Ocupada):** Exibe valor parcial da conta e tempo aberta.
  - 🟡 **Amarelo Pulsante (Chamando):** Alerta visual e sonoro quando o cliente pede garçom ou conta.
- **Abertura Segura de Mesa com QR Code Dinâmico:**
  - Gera na hora uma sessão exclusiva com **Token Secreto Temporário** (ex: `?mesa=2&token=RDVQCZ`).
  - Exibe o QR Code dinâmico na tela para o cliente escanear na hora com a câmera.
- **Lançador Ágil de Pedidos e Rodadas:**
  - Seletor rápido de categorias: Pizzas Tradicionais, Premium, Doces, Bebidas & Sucos.
  - Montador de Pizza Meio a Meio com cálculo automático pelo maior valor e bordas recheadas.
  - Botão **`🔥 Enviar Pedido p/ Cozinha`**: Salva na mesa e aciona o KDS da cozinha imediatamente.
- **Conferência e Fechamento:**
  - Extrato detalhado por rodada.
  - Impressão térmica de Pré-Conta de 80mm/58mm.
  - Fechamento com registro de forma de pagamento (PIX, Dinheiro, Cartão, Divisão por pessoa) e liberação imediata da mesa.

### ✅ Frente 4: Comanda Digital Privada do Cliente via QR Code (`index.html?mesa=X&token=Y`)
- **Blindagem de Privacidade:** Apenas o cliente com o token correto daquela sessão acessa a mesa. Ninguém de outra mesa consegue visualizar consumo alheio.
- **Barra Superior Fixa:** Surge no topo: **`🍽️ Mesa XX • Parcial: R$ XX,XX [Ver Comanda]`**.
- **Modal "Minha Comanda ao Vivo":**
  - Lista de itens por rodada com status da cozinha (`🔥 No Forno a Lenha`, `✅ Entregue na Mesa`).
  - Total parcial atualizado em tempo real sem recarregar a página.
  - Botão **`🙋‍♂️ Chamar Garçom`**: Dispara alerta sonoro e visual no PDV do garçom.
  - Botão **`🧾 Pedir a Conta`**: Avisa o garçom para levar a maquininha até a mesa.
- **Encerramento Automático:** Ao fechar a mesa no caixa, a sessão expira e o cliente recebe mensagem de agradecimento.

### ✅ Frente 5: Painel Administrativo, KDS & Gestão de Mesas (`admin.html`)
- **Aba "🍽️ Salão & Mesas (PDV)":**
  - Monitoramento de todas as 15 mesas com faturamento do salão no dia.
  - Botão **`🖨️ Imprimir Placas/QRs`**: Imprime cartões de QR Code para todas as mesas.
- **KDS Inteligente:** Identifica comandas de Delivery (`🛵`), Balcão (`🏪`) e Mesas (`🍽️ Mesa XX • Rodada Y`).
- **Comanda Térmica do Forno:** Destaca em tamanho grande o número da mesa e dados do garçom.

### ✅ Frente 6: Relatórios Financeiros & Fechamento de Caixa com Salão
- **Métricas por Canal:** Faturamento separado por **Delivery**, **Balcão** e **Salão / Mesas**.
- **Fechamento Térmico & WhatsApp:** Relatório impresso e mensagem formatada para WhatsApp contendo a divisão exata entre entrega, balcão e mesas.

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

1. **Domínio Próprio Comercial (`.com.br`):**
   - Registrar domínio exclusivo no [Registro.br](https://registro.br) (ex: `pizzariadoelieudo.com.br` ou `pedir.pizzariadoelieudo.com.br`).
   - Apontar o DNS para a hospedagem, eliminando a URL padrão do GitHub e passando máxima credibilidade na bio do Instagram, WhatsApp e caixas de pizza.

2. **Hospedagem em Vercel ou Firebase Hosting (URLs Limpas & SSL Grátis):**
   - Os arquivos [`vercel.json`](file:///d:/Antigravity/Pizzaria%20elieudo/vercel.json) e [`firebase.json`](file:///d:/Antigravity/Pizzaria%20elieudo/firebase.json) já estão configurados no projeto.
   - Habilitar rotas amigáveis (ex: `/admin` diretamente, sem necessidade de `.html`).
   - Conexão do domínio próprio em poucos cliques com certificado SSL (HTTPS) automatizado.

3. **Transformação em PWA (Progressive Web App - "Instale nosso App"):**
   - Criar `manifest.json` e registrar um `service-worker.js`.
   - Adicionar ícones de aplicativo com a logo da pizzaria nos tamanhos 192x192 e 512x512.
   - Permitir que clientes em Android e iPhone instalem o cardápio na tela inicial do celular em tela cheia (standalone) como um app nativo sem precisar pagar taxas às lojas de aplicativos.

4. **Pagamento PIX Automatizado (QR Code Dinâmico):**
   - Integrar gateway de pagamento (Mercado Pago, Asaas ou OpenPix).
   - Gerar QR Code dinâmico e código "Copia e Cola" com confirmação via webhook em tempo real.
   - O KDS da cozinha altera automaticamente o status do pedido para "Pago - Em Preparação" assim que o banco aprova o recebimento.

5. **Impressão Térmica Automática de Comandas (Cozinha & Motoboy):**
   - Utilizar a folha de estilo térmica já existente em [`css/admin.css`](file:///d:/Antigravity/Pizzaria%20elieudo/css/admin.css) e [`css/print.css`](file:///d:/Antigravity/Pizzaria%20elieudo/css/print.css).
   - Adicionar botão de disparo direto de impressão para impressoras térmicas (58mm/80mm) para via do motoboy e filipeta de cozinha.

6. **Gestão de Mesas e Comandas (Modo Salão):**
   - Habilitar abertura rápida de pedidos por número de mesa para atendimento de garçons no salão.

---

## 💻 5. Comandos Úteis

### Como rodar localmente no terminal (Node.js):
```powershell
# Usando npx serve:
npx -y serve .
```

### Como publicar alterações para o GitHub Pages:
```powershell
git add .
git commit -m "sua mensagem descritiva"
git push origin main
```
*O GitHub Pages atualiza automaticamente em 1 a 2 minutos após o push.*

### Como publicar via Vercel:
```powershell
npx -y vercel --prod
```

### Como publicar via Firebase Hosting:
```powershell
firebase deploy --only hosting
```

