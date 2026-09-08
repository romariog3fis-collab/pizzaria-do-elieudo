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
  3. Abre o modal comemorativo de confirmação com ID do pedido (`#XXXX`), resumo e botão pulsante **`📲 Enviar Pedido para o WhatsApp`**, que abre o WhatsApp já com a mensagem formatada para a pizzaria.

### ✅ Frente 2: Painel Administrativo com Bloqueio por PIN
- **Lockscreen Dark Glassmorphic:** Teclado numérico touch com suporte a clique e digitação física no teclado.
- **Autenticação em Sessão:** Guarda estado autenticado via `sessionStorage`.
- **Botão de Logout e Alteração de PIN:** Permite redefinir a senha numérica (com confirmação da senha atual) e sincroniza a nova senha na nuvem e localmente.

### ✅ Frente 3: Sincronização em Tempo Real (Cross-Device & Cross-Tab)
- **Zero Reload (Sem F5):** Qualquer pedido realizado pelo celular ou por outra aba chega instantaneamente ao Admin do computador.
- **Mecanismo Híbrido Triplo:**
  1. **Firebase Realtime Database:** Ouve os eventos `child_added`, `value` e `child_changed` em `/orders`, `/coupons` e `/admin_pin`.
  2. **BroadcastChannel (`elieudo_orders_bus`):** Sincroniza abas abertas no mesmo navegador em 0 milissegundos.
  3. **Storage Event Listener (`window.addEventListener('storage', ...)`):** Redundância local garantida.
- **Alerta Sonoro:** Notificação por Web Audio API sintetizado a cada novo pedido pendente.

### ✅ Frente 4: Motor de Cupons & Promoções (Admin)
- Aba dedicada no painel (`#tab-coupons`):
  - Formulário para criar cupom: Código (ex: `PIZZA10`), Tipo (% ou R$), Valor, Pedido Mínimo.
  - Tabela com status (Ativo / Pausado) e botão de Excluir.
  - Sincronizado automaticamente com o Firebase.

### ✅ Frente 5: Relatórios Financeiros & Fechamento de Caixa
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
├── index.html               # Aplicação do Cliente: Cardápio, Carrinho e Modal de Sucesso
├── admin.html               # Painel Admin: Lockscreen PIN, KDS, Cupons, Relatórios e Cardápio
│
├── css/
│   ├── style.css            # Estilo do Cardápio: Dark Glassmorphism, responsividade mobile
│   └── admin.css            # Estilos do Painel Admin, KDS, Lockscreen, Cupons e Impressão Térmica
│
├── js/
│   ├── app.js               # Lógica do Cliente: carrinho, cupons, modal de confirmação e WhatsApp
│   ├── admin.js             # Lógica do Admin: KDS, relatórios, fechamento de caixa, PIN e cupons
│   └── firebase-config.js   # Sincronização em Nuvem (Firebase RTDB) + Fallback Local
│
├── assets/                  # Imagens, logomarcas e ícones da pizzaria
├── database.rules.json      # Regras de segurança do Firebase Realtime Database
├── firebase.json            # Configuração do Firebase CLI
├── .firebaserc              # ID do projeto Firebase vinculado
└── CONTINUE.md              # Este arquivo de documentação e transição
```

---

## 🔧 4. Roteiro para o Próximo Desenvolvedor / IA

Se você for dar continuidade a este projeto, aqui estão as principais tarefas sugeridas e prontas para expansão:

### 💡 Sugestões de Próximos Passos:

1. **Notificação de Rastreio para o Cliente via WhatsApp:**
   - No Admin KDS, ao clicar em *"Saiu para Entrega"*, gerar um link direto para avisar o cliente no WhatsApp dele que o pedido já está a caminho com o motoboy.

2. **Integração com Mercado Pago (PIX Automático):**
   - Implementar geração de QR Code dinâmico do PIX via API do Mercado Pago / OpenPix, liberando o pedido automaticamente após confirmação de pagamento.

3. **Impressão Automática de Pedidos de Cozinha:**
   - Adicionar botão de impressão individual de comanda de cozinha (80mm/58mm) direto do card do KDS, facilitando o trabalho do pizzaiolo.

4. **Gestão de Mesas / Comandas (Modo Salão):**
   - Permitir que garçons abram pedidos por número de mesa sem exigir endereço de entrega.

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
