# 🍕 Pizzaria do Elieudo — Guia de Continuação do Projeto (CONTINUE.md)

Este documento registra com total precisão o estado atual, a arquitetura, as credenciais, o histórico de resoluções e o roteiro do projeto para que qualquer desenvolvedor ou agente de Inteligência Artificial possa retomar o trabalho com clareza, segurança e agilidade.

---

## 🌐 1. Links de Acesso e Produção

| Recurso | URL | Observações |
| :--- | :--- | :--- |
| **Cardápio Digital (Cliente)** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/) | Responsivo, otimizado para celular e desktop. |
| **Comanda da Mesa (Exemplo)** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/?mesa=3&token=EXEMPLO](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/?mesa=3&token=EXEMPLO) | Acesso seguro e privado do cliente com token da sessão. |
| **PDV Mobile Salão & Garçom** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/pdv.html](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/pdv.html) | Tela mobile de abertura de mesa, QR Code dinâmico, rodadas e fechamento. |
| **Painel Admin, KDS & Salão** | [https://romariog3fis-collab.github.io/pizzaria-do-elieudo/admin.html](https://romariog3fis-collab.github.io/pizzaria-do-elieudo/admin.html) | Cozinha KDS, Salão, Relatórios, Cupons, Estoque e Fechamento de Dia. |
| **PIN Padrão de Acesso Admin** | **`1234`** | Alterável pelo botão "🔑 Senha/PIN" no próprio painel. |
| **Console Firebase** | [https://console.firebase.google.com/project/pizzaria-do-elieudo/database](https://console.firebase.google.com/project/pizzaria-do-elieudo/database) | Projeto: `pizzaria-do-elieudo` |
| **Firebase Realtime Database** | `https://pizzaria-do-elieudo-default-rtdb.firebaseio.com/` | Banco em nuvem ativo e sincronizado. |
| **Repositório GitHub** | [https://github.com/romariog3fis-collab/pizzaria-do-elieudo](https://github.com/romariog3fis-collab/pizzaria-do-elieudo) | Branch principal: `main` |

---

## 🚀 2. Estado Atual do Sistema (100% Funcional e em Produção)

### ✅ Frente 1: Cardápio Interativo & Checkout Inteligente
- **Catálogo Completo:** Pizzas tradicionais, premium, doces, esfihas, bebidas e bordas recheadas.
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
- **Interface Mobile-First para Garçons:** Otimizada para uso em smartphones com uma mão só.
- **Mapa Tátil de 15 Mesas:**
  - 🟢 **Verde (Livre):** Toque para abrir informando nome do cliente e número de pessoas.
  - 🔴 **Vermelho (Ocupada):** Exibe valor parcial da conta e tempo aberta.
  - 🟡 **Amarelo Pulsante (Chamando):** Alerta visual e sonoro imediato quando o cliente pede garçom ou conta.
- **Abertura Segura de Mesa com QR Code Dinâmico:**
  - Gera na hora uma sessão exclusiva com **Token Secreto Temporário** de 6 caracteres (ex: `?mesa=3&token=563U9U`).
  - Exibe o QR Code dinâmico na tela para o cliente escanear com a câmera do celular.
  - Garante a URL pública HTTPS oficial (`https://romariog3fis-collab.github.io/pizzaria-do-elieudo/index.html?mesa=X&token=Y`) para compatibilidade total com smartphones.
  - Exibe link visível e botão **"📋 Copiar Link"** para envio rápido no WhatsApp do cliente.
- **Lançador Ágil de Pedidos e Rodadas:**
  - Seletor rápido de categorias: Tradicionais, Premium / Especiais, Doces, Esfihas, Bebidas & Sucos e Meio a Meio.
  - Campo de busca instantânea (filtro por digitação).
  - Montador de Pizza Meio a Meio com cálculo automático pelo maior valor, escolha de tamanho (M, G, GG) e bordas recheadas.
  - Botão **`🔥 Enviar Pedido p/ Cozinha`**: Salva na mesa e aciona o KDS da cozinha imediatamente com sinal sonoro.
- **Conferência, 10% Opcional e Fechamento com Liberação:**
  - Extrato detalhado por rodadas.
  - **Taxa de Serviço de 10%:** Já vem marcada por padrão no fechamento e na comanda do cliente; se o garçom desmarcar, o valor subtrai instantaneamente em ambas as pontas.
  - Impressão térmica de Pré-Conta de 80mm/58mm.
  - Modal completo de fechamento com divisão por pessoa, desconto, seleção de pagamento (PIX, Dinheiro, Cartão) e botão de confirmação e liberação imediata da mesa no Firebase RTDB.

### ✅ Frente 4: Comanda Digital Privada do Cliente via QR Code (`index.html?mesa=X&token=Y`)
- **Blindagem de Privacidade:** Apenas o cliente com o token correto daquela sessão acessa a comanda.
- **Abertura Imediata:** Ao escanear o QR Code, a comanda abre instantaneamente na tela do cliente sem exigir preenchimento de código de rastreamento.
- **Exibição Transparente dos 10%:** A comanda discrimina o subtotal de consumo, o valor do serviço de 10% e o total final.
- **Botões Interativos:**
  - **`🙋‍♂️ Chamar Garçom`**: Dispara alerta sonoro e visual imediato no PDV do garçom.
  - **`🧾 Pedir a Conta`**: Avisa o garçom para levar a conta e maquininha à mesa.
- **Encerramento Automático:** Ao fechar a mesa no PDV, o cliente é avisado e a sessão é finalizada com elegância.

### ✅ Frente 5: Painel Administrativo, KDS & Segurança (`admin.html`)
- **Proteção do Botão "Limpar" com PIN:**
  - O botão **"🗑️ Limpar"** exige o mesmo PIN de acesso ao painel (`adminState.adminPin`, padrão `1234`), prevenindo exclusões acidentais de pedidos.
- **🌙 Finalizar o Dia (Fechamento de Expediente Seguro):**
  - Botão destacado no cabeçalho superior e na aba "Relatórios & Caixa".
  - Modal consolidado com: Faturamento Total, Pedidos, Ticket Médio e quebra por PIX, Cartão e Dinheiro.
  - **Ações Automáticas com PIN:**
    1. Arquiva o expediente no nó permanente `daily_closures/${dateKey}` (Firebase RTDB e LocalStorage).
    2. Limpa os pedidos do KDS para o dia seguinte amanhecer 100% limpo e zerado.
    3. Altera o status da pizzaria para **"Loja Fechada"** no cardápio online.
    4. Imprime cupom térmico de fechamento de caixa (80mm).
- **📁 Histórico de Fechamentos Anteriores Arquivados:**
  - Localizado na aba **"📊 Relatórios & Caixa"**.
  - Lista todos os dias passados finalizados com data, horário, total de pedidos, quebra por modalidade e pagamento.
  - Botão **`🧾 Reimprimir`** em cada dia arquivado para emissão de comprovante térmico a qualquer momento.

---

## 📁 3. Estrutura de Arquivos

```text
d:\Antigravity\Pizzaria elieudo\
│
├── index.html               # Cardápio Digital, Carrinho, Rastreamento e Comanda da Mesa
├── pdv.html                 # PDV Mobile Garçom: Mapa de 15 Mesas, QR Code Dinâmico, Rodadas e Fechamento
├── admin.html               # Painel Admin: Lockscreen PIN, KDS, Salão, Cupons, Fechamento de Dia e Caixa
│
├── css/
│   ├── style.css            # Estilo do Cardápio: Dark Glassmorphism, Stepper e Barra de Mesa
│   ├── pdv.css              # Estilo Mobile-First do PDV: Glassmorphism, Mesas, Modais e Lançador
│   ├── admin.css            # Estilos do Painel Admin, KDS, Lockscreen, Cupons e Fechamentos
│   └── print.css            # Folha de estilo para impressão térmica 80mm de comandas e fechamentos
│
├── js/
│   ├── app.js               # Lógica do Cliente: carrinho, cupons, checkout, WhatsApp, Tracking e Comanda
│   ├── pdv.js               # Lógica do PDV Garçom: mesas, QR Code, rodadas, KDS, 10% e fechamento
│   ├── admin.js             # Lógica do Admin: KDS, relatórios, PIN, cupons, finalizar dia e arquivamento
│   ├── firebase-config.js   # Sincronização em Nuvem (Firebase RTDB): mesas, rodadas, pedidos e daily_closures
│   ├── menu-data.js         # Base inicial de produtos, categorias, tamanhos, bordas e dados da pizzaria
│   └── qrcode.min.js        # Biblioteca local para renderização de QR Code offline
│
├── assets/                  # Imagens, logomarcas e ícones da pizzaria
├── database.rules.json      # Regras de segurança do Firebase Realtime Database
├── firebase.json            # Configuração do Firebase CLI
├── .firebaserc              # ID do projeto Firebase vinculado
└── CONTINUE.md              # Este arquivo de documentação e transição
```

---

## 🛠️ 4. Histórico de Problemas Resolvidos Recentemente

### 1. Botão Limpar protegido por Senha/PIN do Admin
* **Demanda:** Evitar que qualquer operador clique no botão "Limpar" por engano e perca a lista de comandas do dia.
* **Solução:** Criado modal com campo protegido por senha. O PIN utilizado é exatamente o configurado no sistema (`adminState.adminPin`). Se digitado incorretamente, o input treme com feedback visual em vermelho e bloqueia a ação.

### 2. Finalização de Expediente com Arquivamento Permanente
* **Demanda:** Uma opção de finalizar o dia para que na manhã seguinte o painel amanheça limpo, sem perder os dados financeiros.
* **Solução:** Criado o fluxo de "🌙 Finalizar o Dia", que consolida os totais de vendas, salva em `daily_closures` no Firebase e LocalStorage, reseta as comandas ativas do KDS para o dia seguinte, fecha a loja e disponibiliza o histórico arquivado na aba "Relatórios & Caixa" com botão de reimpressão térmica.

### 3. Erro `updateStoreHeaderButton is not defined` ao finalizar o dia
* **Problema:** Ao confirmar o fechamento do dia com o checkbox "Fechar a Loja", o navegador disparava um alerta: `Erro ao finalizar dia: updateStoreHeaderButton is not defined`.
* **Causa:** A função que gerencia a etiqueta e o status do botão no topo do admin se chama `updateStoreStatusUI`.
* **Solução:** O código foi corrigido para chamar `updateStoreStatusUI()` e adicionou-se um alias global `window.updateStoreHeaderButton = updateStoreStatusUI` para garantir imunidade contra futuras inconsistências.

### 4. Taxa de Serviço de 10% Pré-selecionada e Visível ao Cliente
* **Demanda:** Os 10% devem vir sempre selecionados por padrão no fechamento da mesa e exibidos na comanda do cliente, só sendo retirados se o garçom desmarcar a opção.
* **Solução:** Implementado cálculo automático de 10% pré-ativado no PDV e espelhado em tempo real na comanda digital do cliente (`#client-table-modal`), ajustando o total caso a opção seja desmarcada no checkout.

### 5. Abertura Automática da Comanda via Leitura do QR Code
* **Problema:** Ao escanear o QR Code da mesa, abria o cardápio com um botão pedindo número de rastreamento em vez de abrir diretamente a comanda.
* **Solução:** Implementada detecção de parâmetros de mesa na URL (`?mesa=X&token=Y`) com acionamento automático e imediato do modal da comanda e atualização do botão do cabeçalho para modo mesa (`🍽️ Mesa XX • Ver Comanda`).

---

## 🔧 5. Roteiro de Profissionalização & Próximos Passos

1. **Domínio Próprio Comercial (`.com.br`):**
   - Registrar domínio exclusivo no [Registro.br](https://registro.br) (ex: `pizzariadoelieudo.com.br` ou `pedir.pizzariadoelieudo.com.br`).
   - Apontar o DNS para o servidor de hospedagem.

2. **Hospedagem em Vercel ou Firebase Hosting (URLs Limpas & SSL Grátis):**
   - Os arquivos [`vercel.json`](file:///d:/Antigravity/Pizzaria%20elieudo/vercel.json) e [`firebase.json`](file:///d:/Antigravity/Pizzaria%20elieudo/firebase.json) já estão prontos no projeto.
   - Habilitar rotas amigáveis (ex: `/pdv` ou `/admin` diretamente, sem `.html`).

3. **PWA (Progressive Web App - "Instale nosso App"):**
   - Configurar `manifest.json` e `service-worker.js` com ícones da pizzaria para permitir instalação no celular de garçons e clientes.

4. **Pagamento PIX Automatizado com Webhook:**
   - Integrar gateway (ex: Mercado Pago ou OpenPix) para emissão de QR Code PIX dinâmico com baixa automática no KDS assim que aprovado.

---

## 💻 6. Comandos Úteis

### Como rodar localmente no terminal:
```powershell
npx -y serve . -p 3000
```

### Como publicar alterações para o GitHub Pages:
```powershell
git add .
git commit -m "sua mensagem"
git push origin main
```
*O GitHub Pages atualiza automaticamente em cerca de 1 minuto após o push.*

### Como publicar via Vercel:
```powershell
npx -y vercel --prod
```

### Como publicar via Firebase Hosting:
```powershell
firebase deploy --only hosting
```
