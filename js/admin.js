/**
 * Lógica do Painel do Administrador & KDS
 * Pizzaria do Elieudo
 */

const adminState = {
  orders: [],
  soundEnabled: true,
  audioContext: null,
  activeTab: "kds",
  outOfStock: [],
  stockFilterCategory: "all",
  stockSearchTerm: "",
  storeSettings: {
    isOpen: true,
    openingHours: "Terça a Domingo das 18:00 às 23:30",
    closedMessage: "Nosso forno abre hoje às 18:00! Fique à vontade para conferir nosso cardápio."
  },
  modalStatusChoice: true,
  customImages: {},
  editingItemId: null,
  currentTempImage: null,
  // Frente 2: PIN do Admin
  adminPin: "1234",
  enteredPin: "",
  isAuthenticated: false,
  // Frente 3: Cupons de Desconto
  coupons: [],
  couponModalType: "percent",
  // Frente 4: Relatórios
  reportsPeriod: "today"
};

// Formatação BRL
function formatBRL(val) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuth();
  loadAdminPin();
  loadCoupons();
  loadOrders();
  loadStockStatus();
  loadStoreSettings();
  renderKanban();
  updateMetrics();
  renderStockManager();
  setupCloudAndBroadcastSync();
  setupAdminControls();
  setupTabNavigation();
  setupStockControls();
  updateCloudStatusIndicator();
});

// Carregar pedidos do LocalStorage
function loadOrders() {
  try {
    const raw = localStorage.getItem("elieudo_orders_db");
    adminState.orders = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao carregar pedidos:", e);
    adminState.orders = [];
  }
}

// Salvar pedidos
function saveOrders() {
  localStorage.setItem("elieudo_orders_db", JSON.stringify(adminState.orders));
}

// Sincronização em Tempo Real (Firebase Nuvem + Broadcast Local)
function setupCloudAndBroadcastSync() {
  if (typeof fbListenOrders === "function") {
    fbListenOrders(
      (ordersList) => {
        adminState.orders = ordersList || [];
        renderKanban();
        updateMetrics();
        if (adminState.activeTab === "reports") {
          renderReports();
        }
      },
      (newOrder) => {
        playNotificationBeep();
        showStockBanner(`🔔 Novo Pedido recebido: ${newOrder.id} - ${newOrder.customer ? newOrder.customer.name : ''}!`, "success");
      }
    );
  }

  // Ouvir fotos personalizadas
  if (typeof fbListenItemImages === "function") {
    fbListenItemImages((images) => {
      adminState.customImages = images || {};
      renderStockGrid();
    });
  }

  // Ouvir status de estoque
  if (typeof fbListenOutOfStock === "function") {
    fbListenOutOfStock((list) => {
      if (list && Array.isArray(list)) {
        adminState.outOfStock = list;
        updateStockCounters();
      }
    });
  }

  // Ouvir status da loja
  if (typeof fbListenStoreSettings === "function") {
    fbListenStoreSettings((settings) => {
      if (settings) {
        adminState.storeSettings = settings;
        updateStoreHeaderButton();
      }
    });
  }

  // Ouvir Cupons em tempo real (Frente 3)
  if (typeof fbListenCoupons === "function") {
    fbListenCoupons((couponsList) => {
      if (couponsList && Array.isArray(couponsList)) {
        adminState.coupons = couponsList;
        renderCouponsList();
      }
    });
  }

  // Ouvir PIN do Admin em tempo real (Frente 2)
  if (typeof fbListenAdminPin === "function") {
    fbListenAdminPin((remotePin) => {
      if (remotePin) {
        adminState.adminPin = String(remotePin);
      }
    });
  }
}


// Emissão de som de alerta de novo pedido usando Web Audio API (sem arquivos externos)
function playNotificationBeep() {
  if (!adminState.soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    
    // Duplo beep harmonioso (Campainha de Restaurante)
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    playTone(587.33, 0, 0.25); // D5
    playTone(880.00, 0.15, 0.4); // A5
  } catch (e) {
    console.log("Áudio bloqueado ou não suportado:", e);
  }
}

// Atualizar Métricas Rápidas
function updateMetrics() {
  const totalOrders = adminState.orders.length;
  const totalRevenue = adminState.orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const activeOrders = adminState.orders.filter(o => o.status !== "finalizado").length;

  document.getElementById("metric-total-orders").innerText = totalOrders;
  document.getElementById("metric-revenue").innerText = formatBRL(totalRevenue);
  document.getElementById("metric-active-orders").innerText = activeOrders;
}

// Renderização do Quadro Kanban KDS
function renderKanban() {
  const cols = {
    pendente: document.getElementById("cards-pendente"),
    preparando: document.getElementById("cards-preparando"),
    entrega: document.getElementById("cards-entrega"),
    finalizado: document.getElementById("cards-finalizado")
  };

  // Contadores
  const counts = { pendente: 0, preparando: 0, entrega: 0, finalizado: 0 };

  // Limpar colunas
  Object.values(cols).forEach(col => { if (col) col.innerHTML = ""; });

  adminState.orders.forEach(order => {
    const st = order.status || "pendente";
    if (counts[st] !== undefined) counts[st]++;

    const targetCol = cols[st];
    if (targetCol) {
      targetCol.appendChild(createOrderCardElement(order));
    }
  });

  // Atualizar badges das colunas
  document.getElementById("count-pendente").innerText = counts.pendente;
  document.getElementById("count-preparando").innerText = counts.preparando;
  document.getElementById("count-entrega").innerText = counts.entrega;
  document.getElementById("count-finalizado").innerText = counts.finalizado;

  // Estados vazios
  Object.keys(cols).forEach(k => {
    const col = cols[k];
    if (col && col.children.length === 0) {
      col.innerHTML = `<div class="empty-col-state">Nenhum pedido nesta fase</div>`;
    }
  });
}

// Criação do Elemento HTML do Card do Pedido
function createOrderCardElement(order) {
  const card = document.createElement("div");
  card.className = `order-card ${order.status === 'pendente' ? 'highlight-new' : ''}`;
  card.id = `card-${order.id.replace('#', '')}`;

  // Botões de ação dependendo do status atual
  let nextActionBtn = "";
  if (order.status === "pendente") {
    nextActionBtn = `<button class="btn-card-action btn-advance" onclick="changeOrderStatus('${order.id}', 'preparando')">🔥 Iniciar Forno</button>`;
  } else if (order.status === "preparando") {
    nextActionBtn = `<button class="btn-card-action btn-advance" onclick="changeOrderStatus('${order.id}', 'entrega')">🛵 Pronto / Despachar</button>`;
  } else if (order.status === "entrega") {
    nextActionBtn = `<button class="btn-card-action btn-advance" onclick="changeOrderStatus('${order.id}', 'finalizado')">✅ Concluir Entrega</button>`;
  }

  card.innerHTML = `
    <div class="order-card-header">
      <span class="order-id">${order.id}</span>
      <span class="order-time">🕒 ${order.timeStr} (${order.deliveryType === 'delivery' ? '🛵 Entrega' : '🏪 Balcão'})</span>
    </div>

    <div class="order-customer">
      <span class="customer-name">${order.customer.name} ${order.customer.phone ? `• ${order.customer.phone}` : ''}</span>
      ${order.customer.address ? `<span class="customer-address">📍 ${order.customer.address}</span>` : ''}
      ${order.customer.reference ? `<span class="customer-address">📌 Ref: ${order.customer.reference}</span>` : ''}
    </div>

    <div class="order-items-box">
      ${(order.items || []).map(item => `
        <div class="order-item-row">
          <span class="item-main-desc">${item.quantity}x ${item.flavorDescription || item.name}</span>
          ${item.details ? `<span class="item-sub-desc">${item.details}</span>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="order-footer-bar">
      <div>
        <div style="font-size: 0.72rem; color: #94a3b8;">${order.paymentMethod || 'PIX'}</div>
        <div class="order-total-price">${formatBRL(order.subtotal || 0)}</div>
      </div>
      <div class="order-card-actions">
        <button class="btn-card-action" onclick="printKitchenOrder('${order.id}')" title="Imprimir Comanda do Forno">🖨️ Forno</button>
        <button class="btn-card-action" onclick="printReceiptOrder('${order.id}')" title="Imprimir Via do Cliente">🧾 Cliente</button>
        ${nextActionBtn}
      </div>
    </div>
  `;

  return card;
}

// Mudança de Status do Pedido
function changeOrderStatus(orderId, newStatus) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (order) {
    order.status = newStatus;
    saveOrders();
    if (typeof fbUpdateOrderStatus === "function") {
      fbUpdateOrderStatus(orderId, newStatus);
    }
    renderKanban();
    updateMetrics();
  }
}

// Impressão da Comanda da Cozinha (Sem preços, foco em sabores e alergias)
function printKitchenOrder(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const container = document.getElementById("admin-thermal-receipt");
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
      <h2 style="font-size: 18px; margin: 0; text-transform: uppercase;">🔥 COZINHA / FORNO 🔥</h2>
      <div style="font-size: 16px; font-weight: bold;">PEDIDO ${order.id}</div>
      <div style="font-size: 12px;">Hora: ${order.timeStr} | ${order.deliveryType.toUpperCase()}</div>
    </div>
    
    <div style="margin-bottom: 8px;">
      <div><strong>CLIENTE:</strong> ${order.customer.name}</div>
    </div>

    <div style="border-top: 1px solid #000; padding-top: 6px; margin-bottom: 8px;">
      <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">ITENS:</div>
      ${(order.items || []).map(item => `
        <div style="margin-bottom: 6px; border-bottom: 1px dotted #ccc; padding-bottom: 4px;">
          <div style="font-size: 14px; font-weight: bold;">${item.quantity}x ${item.flavorDescription || item.name}</div>
          ${item.details ? `<div style="font-size: 12px; font-weight: bold; background: #eee; padding: 2px;">>> ${item.details}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  window.print();
}

// Impressão da Via Completa do Cliente / Entrega
function printReceiptOrder(orderId) {
  const order = adminState.orders.find(o => o.id === orderId);
  if (!order) return;

  const container = document.getElementById("admin-thermal-receipt");
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
      <h3 style="font-size: 16px; margin: 0;">PIZZARIA DO ELIEUDO</h3>
      <div>Tel: (85) 99177-4881</div>
      <div>Elieudo Motos - Jacaúna - Aquiraz/CE</div>
      <div style="font-weight: bold; margin-top: 4px;">PEDIDO ${order.id}</div>
      <div style="font-size: 11px;">Data: ${order.dateStr} às ${order.timeStr}</div>
    </div>

    <div style="margin-bottom: 6px; font-size: 11px;">
      <div><strong>CLIENTE:</strong> ${order.customer.name}</div>
      ${order.customer.phone ? `<div><strong>TEL:</strong> ${order.customer.phone}</div>` : ''}
      <div><strong>TIPO:</strong> ${order.deliveryType.toUpperCase()}</div>
      ${order.customer.address ? `<div><strong>ENDEREÇO:</strong> ${order.customer.address}</div>` : ''}
      ${order.customer.reference ? `<div><strong>REF:</strong> ${order.customer.reference}</div>` : ''}
    </div>

    <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 6px;">
      <div style="font-weight: bold; font-size: 12px;">ITENS:</div>
      ${(order.items || []).map(item => `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 3px;">
          <span>${item.quantity}x ${item.flavorDescription || item.name}</span>
          <span>${formatBRL(item.totalPrice)}</span>
        </div>
        ${item.details ? `<div style="font-size: 10px; color: #444;">&nbsp;&nbsp;(${item.details})</div>` : ''}
      `).join('')}
    </div>

    ${order.discountAmount > 0 ? `
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #000; margin-bottom: 2px;">
        <span>Subtotal:</span>
        <span>${formatBRL(order.subtotal || 0)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 4px;">
        <span>Desconto (${order.couponCode || 'Cupom'}):</span>
        <span>- ${formatBRL(order.discountAmount)}</span>
      </div>
    ` : ''}

    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
      <span>TOTAL A PAGAR:</span>
      <span>${formatBRL(order.totalPrice !== undefined ? order.totalPrice : (order.subtotal || 0))}</span>
    </div>

    <div style="font-size: 11px; margin-bottom: 10px;">
      <strong>PAGAMENTO:</strong> ${order.paymentMethod || 'PIX'}
    </div>

    <div style="text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 6px;">
      <div>Obrigado pela preferência! Bom apetite!</div>
      <div>Instagram: @pizzaria_do_elieudo</div>
    </div>
  `;

  window.print();
}

// Configurações do Cabeçalho Admin
function setupAdminControls() {
  const btnSound = document.getElementById("btn-toggle-sound");
  if (btnSound) {
    btnSound.onclick = () => {
      adminState.soundEnabled = !adminState.soundEnabled;
      btnSound.classList.toggle("active", adminState.soundEnabled);
      btnSound.innerText = adminState.soundEnabled ? "🔔 Som Ligado" : "🔕 Som Mudo";
    };
  }

  const btnSimulate = document.getElementById("btn-simulate-order");
  if (btnSimulate) {
    btnSimulate.onclick = () => {
      const mockPayMethods = ["PIX", "Cartão de Crédito na Entrega", "Dinheiro (Troco para R$ 100)"];
      const chosenPay = mockPayMethods[Math.floor(Math.random() * mockPayMethods.length)];
      const hasCoupon = Math.random() > 0.5;
      const sub = 79.90;
      const disc = hasCoupon ? 10.00 : 0;
      const tot = sub - disc;

      const mockOrder = {
        id: `#${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('pt-BR'),
        timeStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        customer: {
          name: ["Romário Ramos", "Ana Paula", "Carlos Silva", "Beatriz Lima"][Math.floor(Math.random() * 4)],
          phone: "(85) 98888-0000",
          address: "Rua das Flores, 100 - Jacaúna",
          reference: "Próximo à praça"
        },
        deliveryType: Math.random() > 0.3 ? "delivery" : "balcao",
        paymentMethod: chosenPay,
        items: [
          {
            name: "Pizza Calabresa (GG)",
            flavorDescription: "1/2 Calabresa + 1/2 Carne do Sol",
            details: "Tamanho: GG | Borda Catupiry Original",
            quantity: 1,
            unitPrice: 64.90,
            totalPrice: 64.90
          },
          {
            name: "Coca-Cola 2 Litros",
            flavorDescription: "Coca-Cola 2 Litros",
            details: "Bebida gelada",
            quantity: 1,
            unitPrice: 15.00,
            totalPrice: 15.00
          }
        ],
        subtotal: sub,
        discountAmount: disc,
        couponCode: hasCoupon ? "BEMVINDO" : null,
        totalPrice: tot,
        status: "pendente"
      };

      adminState.orders.unshift(mockOrder);
      saveOrders();
      if (typeof fbSaveOrder === "function") {
        fbSaveOrder(mockOrder);
      }
      playNotificationBeep();
      renderKanban();
      updateMetrics();
      if (adminState.activeTab === "reports") {
        renderReports();
      }
    };
  }

  const btnClear = document.getElementById("btn-clear-orders");
  if (btnClear) {
    btnClear.onclick = () => {
      if (confirm("Deseja limpar todos os pedidos do histórico?")) {
        adminState.orders = [];
        saveOrders();
        if (typeof fbClearAllOrders === "function") {
          fbClearAllOrders();
        }
        renderKanban();
        updateMetrics();
        if (adminState.activeTab === "reports") {
          renderReports();
        }
      }
    };
  }
}

// ============================================================
// GESTÃO DE DISPONIBILIDADE E ESGOTAMENTO DE SABORES (ESTOQUE)
// ============================================================

// Carregar lista de itens esgotados do localStorage
function loadStockStatus() {
  try {
    const raw = localStorage.getItem("elieudo_out_of_stock");
    adminState.outOfStock = raw ? JSON.parse(raw) : [];
  } catch (e) {
    adminState.outOfStock = [];
  }
}

// Salvar lista de itens esgotados e notificar cardápio do cliente via BroadcastChannel & Firebase
function saveStockStatus() {
  localStorage.setItem("elieudo_out_of_stock", JSON.stringify(adminState.outOfStock));
  if (typeof fbSaveOutOfStock === "function") {
    fbSaveOutOfStock(adminState.outOfStock);
  }
  if (window.BroadcastChannel) {
    const channel = new BroadcastChannel("elieudo_stock_bus");
    channel.postMessage({ type: "STOCK_UPDATED", outOfStock: adminState.outOfStock });
  }
}

// Alternar entre abas (KDS vs Gestão de Sabores)
function setupTabNavigation() {
  const tabs = [
    { btnId: "tab-btn-kds", viewId: "view-kds", name: "kds", onOpen: null },
    { btnId: "tab-btn-stock", viewId: "view-stock", name: "stock", onOpen: renderStockManager },
    { btnId: "tab-btn-coupons", viewId: "view-coupons", name: "coupons", onOpen: renderCouponsList },
    { btnId: "tab-btn-reports", viewId: "view-reports", name: "reports", onOpen: renderReports }
  ];

  tabs.forEach(tab => {
    const btn = document.getElementById(tab.btnId);
    if (btn) {
      btn.onclick = () => {
        adminState.activeTab = tab.name;
        tabs.forEach(t => {
          const b = document.getElementById(t.btnId);
          const v = document.getElementById(t.viewId);
          if (b) b.classList.toggle("active", t.btnId === tab.btnId);
          if (v) v.style.display = t.btnId === tab.btnId ? "block" : "none";
        });
        if (typeof tab.onOpen === "function") {
          tab.onOpen();
        }
      };
    }
  });
}

// Exibir banner de notificação no painel de estoque
function showStockBanner(message, type = "success") {
  const banner = document.getElementById("stock-notification-banner");
  if (!banner) return;

  banner.className = `stock-banner banner-${type}`;
  banner.innerHTML = `<span>${message}</span>`;
  banner.style.display = "flex";

  if (window._stockBannerTimeout) {
    clearTimeout(window._stockBannerTimeout);
  }
  window._stockBannerTimeout = setTimeout(() => {
    banner.style.display = "none";
  }, 3500);
}

// Reativar todos os itens esgotados (execução direta e confiável sem travar em popups bloqueados)
function restoreAllStock() {
  loadStockStatus();

  if (!adminState.outOfStock || adminState.outOfStock.length === 0) {
    showStockBanner("ℹ️ Todos os sabores já estão 100% disponíveis!", "info");
    return;
  }

  const restoredCount = adminState.outOfStock.length;
  adminState.outOfStock = [];
  adminState.stockFilterCategory = "all"; // reseta para 'Todos' para exibir todos os itens
  adminState.stockSearchTerm = "";
  
  const inputSearch = document.getElementById("input-stock-search");
  if (inputSearch) inputSearch.value = "";

  saveStockStatus();
  renderStockManager();

  showStockBanner(`✅ Sucesso! ${restoredCount} sabores foram reativados e já estão disponíveis no cardápio.`, "success");
}
window.restoreAllStock = restoreAllStock;

// Configurar controles de filtro e busca do estoque
function setupStockControls() {
  const inputSearch = document.getElementById("input-stock-search");
  if (inputSearch) {
    inputSearch.addEventListener("input", (e) => {
      adminState.stockSearchTerm = e.target.value.toLowerCase().trim();
      renderStockGrid();
    });
  }

  const btnRestoreAll = document.getElementById("btn-restore-all-stock");
  if (btnRestoreAll) {
    btnRestoreAll.onclick = (e) => {
      e.preventDefault();
      restoreAllStock();
    };
  }
}

// Renderizar o gerenciador de estoque (chips, contadores e grid)
function renderStockManager() {
  if (typeof MENU_DATA === "undefined" || !MENU_DATA.items) return;

  const totalItems = MENU_DATA.items.length;
  const outOfStockCount = adminState.outOfStock.length;
  const availableCount = Math.max(0, totalItems - outOfStockCount);

  // Atualiza contadores
  const elTotal = document.getElementById("stock-total-count");
  const elAvail = document.getElementById("stock-available-count");
  const elOut = document.getElementById("stock-out-count");
  const elBadgeOut = document.getElementById("badge-stock-out-count");

  if (elTotal) elTotal.innerText = totalItems;
  if (elAvail) elAvail.innerText = availableCount;
  if (elOut) elOut.innerText = outOfStockCount;
  if (elBadgeOut) {
    elBadgeOut.innerText = `${outOfStockCount} esgotado${outOfStockCount === 1 ? '' : 's'}`;
    elBadgeOut.style.display = outOfStockCount > 0 ? "inline-block" : "none";
  }

  // Renderiza chips de categorias
  renderStockCategoryChips();

  // Renderiza grid de cards
  renderStockGrid();
}

// Renderizar chips de filtro de categoria
function renderStockCategoryChips() {
  const container = document.getElementById("stock-category-filters");
  if (!container) return;

  const categories = MENU_DATA.categories || [];
  const outOfStockCount = adminState.outOfStock.length;

  let chipsHTML = `
    <button class="stock-chip-btn ${adminState.stockFilterCategory === 'all' ? 'active' : ''}" 
            data-cat="all">
      Todos (${MENU_DATA.items.length})
    </button>
  `;

  if (outOfStockCount > 0) {
    chipsHTML += `
      <button class="stock-chip-btn chip-esgotados ${adminState.stockFilterCategory === 'esgotados' ? 'active' : ''}" 
              data-cat="esgotados">
        ⚠️ Apenas Esgotados (${outOfStockCount})
      </button>
    `;
  }

  chipsHTML += categories.map(cat => {
    const count = MENU_DATA.items.filter(i => i.category === cat.id).length;
    return `
      <button class="stock-chip-btn ${adminState.stockFilterCategory === cat.id ? 'active' : ''}" 
              data-cat="${cat.id}">
        ${cat.icon} ${cat.name} (${count})
      </button>
    `;
  }).join("");

  container.innerHTML = chipsHTML;

  container.querySelectorAll(".stock-chip-btn").forEach(btn => {
    btn.onclick = () => {
      adminState.stockFilterCategory = btn.dataset.cat;
      container.querySelectorAll(".stock-chip-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderStockGrid();
    };
  });
}

// Renderizar os cards de produtos no grid
function renderStockGrid() {
  const container = document.getElementById("stock-items-container");
  if (!container) return;

  let filtered = MENU_DATA.items || [];

  // Filtro por categoria
  if (adminState.stockFilterCategory === "esgotados") {
    filtered = filtered.filter(i => adminState.outOfStock.includes(i.id));
  } else if (adminState.stockFilterCategory !== "all") {
    filtered = filtered.filter(i => i.category === adminState.stockFilterCategory);
  }

  // Filtro por pesquisa de texto
  if (adminState.stockSearchTerm) {
    filtered = filtered.filter(i => 
      i.name.toLowerCase().includes(adminState.stockSearchTerm) ||
      (i.description && i.description.toLowerCase().includes(adminState.stockSearchTerm))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <p style="font-size: 2rem; margin-bottom: 8px;">🔍</p>
        <p>Nenhum sabor ou item encontrado com o filtro atual.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isOut = adminState.outOfStock.includes(item.id);
    const cat = MENU_DATA.categories.find(c => c.id === item.category);
    const catName = cat ? `${cat.icon} ${cat.name}` : item.category;

    const hasCustomImg = !!(adminState.customImages && adminState.customImages[item.id]);
    const displayImg = hasCustomImg ? adminState.customImages[item.id] : (item.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400');

    let priceLabel = "";
    if (item.prices) {
      priceLabel = `A partir de ${formatBRL(item.prices.M)}`;
    } else if (item.price !== undefined) {
      priceLabel = formatBRL(item.price);
    }

    return `
      <div class="stock-card ${isOut ? 'is-out-of-stock' : ''}" data-id="${item.id}">
        <div class="stock-card-thumb">
          <img src="${displayImg}" alt="${item.name}" loading="lazy" />
          ${hasCustomImg ? `<span class="badge-custom-photo">📸 Foto Real</span>` : ''}
          <span class="stock-status-pill ${isOut ? 'pill-out' : 'pill-available'}">
            ${isOut ? '⛔ Esgotado' : '✅ Disponível'}
          </span>
        </div>
        <div class="stock-card-body">
          <div class="stock-card-header">
            <span class="stock-cat-badge">${catName}</span>
            <span class="stock-price">${priceLabel}</span>
          </div>
          <h3 class="stock-card-name">${item.name}</h3>
          <p class="stock-card-desc">${item.description || 'Sem descrição cadastrada.'}</p>
          <div class="stock-card-footer">
            <div class="stock-card-actions">
              <button type="button" class="btn-edit-photo" onclick="openPhotoModal('${item.id}')" title="Alterar foto da pizza">
                <span>📸 Trocar Foto</span>
              </button>
              <button class="btn-stock-toggle ${isOut ? 'btn-make-available' : 'btn-make-out'}" 
                      data-id="${item.id}">
                ${isOut ? `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Reativar</span>
                ` : `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                  <span>Esgotar</span>
                `}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Event Listeners nos botões de alternar estoque
  container.querySelectorAll(".btn-stock-toggle").forEach(btn => {
    btn.onclick = (e) => {
      const itemId = e.currentTarget.dataset.id;
      toggleItemStock(itemId);
    };
  });
}

// Alternar status de estoque de um item
function toggleItemStock(itemId) {
  const index = adminState.outOfStock.indexOf(itemId);

  if (index >= 0) {
    adminState.outOfStock.splice(index, 1);
  } else {
    adminState.outOfStock.push(itemId);
  }

  saveStockStatus();
  renderStockManager();
}

// ============================================================
// GESTÃO DE HORÁRIOS & STATUS DA LOJA (ABERTA / FECHADA)
// ============================================================

// Carregar configurações da loja do localStorage
function loadStoreSettings() {
  try {
    const raw = localStorage.getItem("elieudo_store_settings");
    if (raw) {
      adminState.storeSettings = Object.assign({}, adminState.storeSettings, JSON.parse(raw));
    } else if (typeof MENU_DATA !== "undefined" && MENU_DATA.restaurant) {
      if (MENU_DATA.restaurant.openingHours) {
        adminState.storeSettings.openingHours = MENU_DATA.restaurant.openingHours;
      }
    }
  } catch (e) {
    console.error("Erro ao carregar configurações da loja:", e);
  }
  updateStoreStatusUI();
}

// Salvar configurações da loja e notificar clientes via BroadcastChannel
function saveStoreSettings() {
  localStorage.setItem("elieudo_store_settings", JSON.stringify(adminState.storeSettings));
  if (window.BroadcastChannel) {
    const channel = new BroadcastChannel("elieudo_store_bus");
    channel.postMessage({ type: "STORE_SETTINGS_UPDATED", settings: adminState.storeSettings });
  }
  updateStoreStatusUI();
}

// Atualizar interface do botão de status no topo do admin
function updateStoreStatusUI() {
  const btn = document.getElementById("btn-toggle-store-status");
  const text = document.getElementById("header-store-text");
  if (!btn || !text) return;

  if (adminState.storeSettings.isOpen) {
    btn.className = "btn-admin btn-store-toggle is-open";
    text.innerText = "🟢 Loja Aberta";
    btn.title = "A pizzaria está aberta! Clique para fechar a loja para pedidos";
  } else {
    btn.className = "btn-admin btn-store-toggle is-closed";
    text.innerText = "🔴 Loja Fechada";
    btn.title = "A pizzaria está fechada! Clique para abrir a loja para pedidos";
  }
}

// Alternar status aberto/fechado com um clique no botão do cabeçalho
function toggleStoreStatus() {
  adminState.storeSettings.isOpen = !adminState.storeSettings.isOpen;
  saveStoreSettings();
  
  if (adminState.storeSettings.isOpen) {
    showStockBanner("🟢 A Pizzaria foi ABERTA! O cardápio está liberado para receber pedidos.", "success");
  } else {
    showStockBanner("🔴 A Pizzaria foi FECHADA! Os pedidos online dos clientes foram pausados.", "info");
  }
}
window.toggleStoreStatus = toggleStoreStatus;

// Abrir modal de horários
function openHoursModal() {
  const modal = document.getElementById("hours-settings-modal");
  const inputHours = document.getElementById("input-opening-hours");
  const inputClosedMsg = document.getElementById("input-closed-message");

  if (!modal) return;

  adminState.modalStatusChoice = adminState.storeSettings.isOpen;
  setModalStatusChoice(adminState.modalStatusChoice);

  if (inputHours) {
    inputHours.value = adminState.storeSettings.openingHours || "";
  }
  if (inputClosedMsg) {
    inputClosedMsg.value = adminState.storeSettings.closedMessage || "";
  }

  modal.style.display = "flex";
}
window.openHoursModal = openHoursModal;

// Fechar modal de horários
function closeHoursModal() {
  const modal = document.getElementById("hours-settings-modal");
  if (modal) modal.style.display = "none";
}
window.closeHoursModal = closeHoursModal;

// Escolher status no modal
function setModalStatusChoice(isOpen) {
  adminState.modalStatusChoice = isOpen;
  const btnOpen = document.getElementById("choice-status-open");
  const btnClosed = document.getElementById("choice-status-closed");

  if (btnOpen && btnClosed) {
    if (isOpen) {
      btnOpen.classList.add("active");
      btnClosed.classList.remove("active");
    } else {
      btnClosed.classList.add("active");
      btnOpen.classList.remove("active");
    }
  }
}
window.setModalStatusChoice = setModalStatusChoice;

// Salvar dados do modal de horários
function saveHoursSettings() {
  const inputHours = document.getElementById("input-opening-hours");
  const inputClosedMsg = document.getElementById("input-closed-message");

  adminState.storeSettings.isOpen = adminState.modalStatusChoice;
  if (inputHours && inputHours.value.trim() !== "") {
    adminState.storeSettings.openingHours = inputHours.value.trim();
  }
  if (inputClosedMsg && inputClosedMsg.value.trim() !== "") {
    adminState.storeSettings.closedMessage = inputClosedMsg.value.trim();
  }

  saveStoreSettings();
  closeHoursModal();
  showStockBanner("💾 Horários e configurações da loja salvos com sucesso!", "success");
}
window.saveHoursSettings = saveHoursSettings;

// ============================================================
// GESTÃO DE FOTOS DAS PIZZAS PELO ADMINISTRADOR
// ============================================================

// Abrir modal de edição de foto
function openPhotoModal(itemId) {
  const item = (MENU_DATA.items || []).find(i => i.id === itemId);
  if (!item) return;

  adminState.editingItemId = itemId;
  const currentImg = (adminState.customImages && adminState.customImages[itemId]) || item.image || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400";
  adminState.currentTempImage = currentImg;

  const titleEl = document.getElementById("photo-modal-item-title");
  const previewImg = document.getElementById("photo-modal-preview-img");
  const statusText = document.getElementById("photo-modal-status-text");
  const inputUrl = document.getElementById("input-photo-url");
  const inputFile = document.getElementById("input-photo-file");

  if (titleEl) titleEl.innerText = `Trocar Foto: ${item.name}`;
  if (previewImg) previewImg.src = currentImg;
  if (statusText) {
    const isCustom = adminState.customImages && adminState.customImages[itemId];
    statusText.innerText = isCustom ? "📸 Foto personalizada ativa" : "🖼️ Foto padrão original";
  }
  if (inputUrl) inputUrl.value = "";
  if (inputFile) inputFile.value = "";

  const modal = document.getElementById("photo-edit-modal");
  if (modal) modal.style.display = "flex";
}
window.openPhotoModal = openPhotoModal;

function closePhotoModal() {
  const modal = document.getElementById("photo-edit-modal");
  if (modal) modal.style.display = "none";
  adminState.editingItemId = null;
  adminState.currentTempImage = null;
}
window.closePhotoModal = closePhotoModal;

// Compressão de imagem no navegador usando Canvas para garantir leveza e alta velocidade
function compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Quando o usuário seleciona um arquivo da câmera ou galeria
async function handlePhotoFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const statusText = document.getElementById("photo-modal-status-text");
  const previewImg = document.getElementById("photo-modal-preview-img");

  if (statusText) statusText.innerText = "⏳ Otimizando e preparando foto...";

  try {
    const compressedDataUrl = await compressImage(file, 800, 600, 0.78);
    adminState.currentTempImage = compressedDataUrl;
    if (previewImg) previewImg.src = compressedDataUrl;
    if (statusText) statusText.innerText = "✅ Foto pronta para salvar (otimizada)";
  } catch (err) {
    console.error("Erro ao comprimir imagem:", err);
    if (statusText) statusText.innerText = "❌ Falha ao processar arquivo.";
  }
}
window.handlePhotoFileSelected = handlePhotoFileSelected;

// Quando o usuário cola uma URL de foto
function handlePhotoUrlInput(event) {
  const url = event.target.value.trim();
  if (!url) return;

  const previewImg = document.getElementById("photo-modal-preview-img");
  const statusText = document.getElementById("photo-modal-status-text");

  adminState.currentTempImage = url;
  if (previewImg) previewImg.src = url;
  if (statusText) statusText.innerText = "🔗 Link de imagem carregado";
}
window.handlePhotoUrlInput = handlePhotoUrlInput;

// Salvar foto personalizada
async function saveCustomPhoto() {
  if (!adminState.editingItemId || !adminState.currentTempImage) {
    alert("Por favor, selecione uma foto primeiro!");
    return;
  }

  const itemId = adminState.editingItemId;
  const newImg = adminState.currentTempImage;

  if (typeof fbSaveItemImage === "function") {
    await fbSaveItemImage(itemId, newImg);
  }

  adminState.customImages[itemId] = newImg;
  renderStockGrid();
  closePhotoModal();
  showStockBanner("📸 Foto atualizada com sucesso no cardápio!", "success");
}
window.saveCustomPhoto = saveCustomPhoto;

// Restaurar foto padrão
async function restoreDefaultPhoto() {
  if (!adminState.editingItemId) return;
  const itemId = adminState.editingItemId;

  if (confirm("Deseja remover a foto personalizada e voltar para a foto padrão do cardápio?")) {
    if (typeof fbRemoveItemImage === "function") {
      await fbRemoveItemImage(itemId);
    }
    if (adminState.customImages) {
      delete adminState.customImages[itemId];
    }
    renderStockGrid();
    closePhotoModal();
    showStockBanner("🔄 Foto restaurada para o padrão original.", "success");
  }
}
window.restoreDefaultPhoto = restoreDefaultPhoto;

// ============================================================
// CONFIGURAÇÃO DO FIREBASE (NUVEM EM TEMPO REAL)
// ============================================================

function updateCloudStatusIndicator() {
  const btn = document.getElementById("btn-cloud-status");
  const ind = document.getElementById("cloud-status-indicator");
  if (!ind) return;

  const isConnected = typeof fbIsConnected === "function" && fbIsConnected();
  if (isConnected) {
    ind.innerHTML = "🟢 Nuvem Conectada";
    if (btn) btn.style.borderColor = "rgba(16, 185, 129, 0.4)";
  } else {
    ind.innerHTML = "☁️ Nuvem / Config";
  }
}

function openFirebaseModal() {
  const modal = document.getElementById("firebase-setup-modal");
  const banner = document.getElementById("firebase-status-banner");
  const inputUrl = document.getElementById("input-fb-database-url");
  const inputKey = document.getElementById("input-fb-api-key");
  const inputProj = document.getElementById("input-fb-project-id");

  const currentCfg = typeof fbGetFirebaseConfig === "function" ? fbGetFirebaseConfig() : null;
  const isConnected = typeof fbIsConnected === "function" && fbIsConnected();

  if (banner) {
    if (isConnected) {
      banner.className = "firebase-status-banner is-connected";
      banner.innerHTML = "<span>🟢 Firebase conectado e sincronizando pedidos em tempo real.</span>";
    } else {
      banner.className = "firebase-status-banner is-offline";
      banner.innerHTML = "<span>🟡 Modo Local ativo. Configure seu Realtime Database abaixo para sincronizar entre aparelhos diferentes.</span>";
    }
  }

  if (currentCfg) {
    if (inputUrl) inputUrl.value = currentCfg.databaseURL || "";
    if (inputKey) inputKey.value = currentCfg.apiKey || "";
    if (inputProj) inputProj.value = currentCfg.projectId || "";
  }

  if (modal) modal.style.display = "flex";
}
window.openFirebaseModal = openFirebaseModal;

function closeFirebaseModal() {
  const modal = document.getElementById("firebase-setup-modal");
  if (modal) modal.style.display = "none";
}
window.closeFirebaseModal = closeFirebaseModal;

function saveFirebaseSettingsFromModal() {
  const inputUrl = document.getElementById("input-fb-database-url");
  const inputKey = document.getElementById("input-fb-api-key");
  const inputProj = document.getElementById("input-fb-project-id");

  const dbUrl = inputUrl ? inputUrl.value.trim() : "";
  const apiKey = inputKey ? inputKey.value.trim() : "";
  const projId = inputProj ? inputProj.value.trim() : "";

  if (!dbUrl || !apiKey) {
    alert("Por favor, preencha pelo menos a Database URL e a API Key do seu Firebase!");
    return;
  }

  const configObj = {
    apiKey: apiKey,
    databaseURL: dbUrl,
    projectId: projId || "pizzaria-elieudo"
  };

  const success = typeof fbSaveFirebaseConfig === "function" ? fbSaveFirebaseConfig(configObj) : false;
  if (success) {
    alert("Conexão com Firebase iniciada com sucesso!");
    updateCloudStatusIndicator();
    closeFirebaseModal();
    setupCloudAndBroadcastSync();
  } else {
    alert("Configuração salva. Caso não conecte de imediato, verifique a URL e chave do Firebase.");
    updateCloudStatusIndicator();
    closeFirebaseModal();
  }
}
window.saveFirebaseSettingsFromModal = saveFirebaseSettingsFromModal;

// ============================================================
// FRENTE 2: CONTROLE DE ACESSO / SENHA E PIN DO ADMIN
// ============================================================

function checkAdminAuth() {
  const isAuth = sessionStorage.getItem("elieudo_admin_authenticated") === "true";
  const overlay = document.getElementById("admin-lockscreen-overlay");
  if (overlay) {
    if (isAuth) {
      overlay.style.display = "none";
      adminState.isAuthenticated = true;
    } else {
      overlay.style.display = "flex";
      adminState.isAuthenticated = false;
      clearPin();
    }
  }
}

function loadAdminPin() {
  const saved = localStorage.getItem("elieudo_admin_pin");
  if (saved) {
    adminState.adminPin = String(saved);
  }
}

function appendPinDigit(digit) {
  if (adminState.enteredPin.length < 8) {
    adminState.enteredPin += digit;
    updatePinDisplay();
  }
}
window.appendPinDigit = appendPinDigit;

function clearPin() {
  adminState.enteredPin = "";
  updatePinDisplay();
  const errMsg = document.getElementById("pin-error-msg");
  if (errMsg) errMsg.style.display = "none";
}
window.clearPin = clearPin;

function backspacePin() {
  if (adminState.enteredPin.length > 0) {
    adminState.enteredPin = adminState.enteredPin.slice(0, -1);
    updatePinDisplay();
  }
}
window.backspacePin = backspacePin;

function updatePinDisplay() {
  const pinInput = document.getElementById("admin-pin-input");
  if (pinInput) {
    pinInput.value = adminState.enteredPin;
  }
}

function verifyAdminPin() {
  const errMsg = document.getElementById("pin-error-msg");
  const overlay = document.getElementById("admin-lockscreen-overlay");
  
  if (adminState.enteredPin === adminState.adminPin) {
    sessionStorage.setItem("elieudo_admin_authenticated", "true");
    adminState.isAuthenticated = true;
    if (errMsg) errMsg.style.display = "none";
    if (overlay) {
      overlay.style.transition = "opacity 0.25s ease";
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.style.display = "none";
        overlay.style.opacity = "1";
      }, 250);
    }
    playNotificationBeep();
  } else {
    if (errMsg) errMsg.style.display = "block";
    const pinInput = document.getElementById("admin-pin-input");
    if (pinInput) {
      pinInput.classList.add("shake-error");
      setTimeout(() => pinInput.classList.remove("shake-error"), 400);
    }
    setTimeout(() => {
      clearPin();
    }, 800);
  }
}
window.verifyAdminPin = verifyAdminPin;

function logoutAdmin() {
  if (confirm("Deseja realmente bloquear o painel administrativo?")) {
    sessionStorage.removeItem("elieudo_admin_authenticated");
    adminState.isAuthenticated = false;
    clearPin();
    const overlay = document.getElementById("admin-lockscreen-overlay");
    if (overlay) overlay.style.display = "flex";
  }
}
window.logoutAdmin = logoutAdmin;

function openChangePinModal() {
  const modal = document.getElementById("pin-change-modal");
  const fb = document.getElementById("pin-change-feedback");
  if (fb) fb.style.display = "none";
  const cur = document.getElementById("input-current-pin");
  const n1 = document.getElementById("input-new-pin");
  const n2 = document.getElementById("input-confirm-pin");
  if (cur) cur.value = "";
  if (n1) n1.value = "";
  if (n2) n2.value = "";
  if (modal) modal.style.display = "flex";
}
window.openChangePinModal = openChangePinModal;

function closeChangePinModal() {
  const modal = document.getElementById("pin-change-modal");
  if (modal) modal.style.display = "none";
}
window.closeChangePinModal = closeChangePinModal;

function saveNewAdminPin() {
  const cur = document.getElementById("input-current-pin");
  const n1 = document.getElementById("input-new-pin");
  const n2 = document.getElementById("input-confirm-pin");
  const fb = document.getElementById("pin-change-feedback");

  const curVal = cur ? cur.value.trim() : "";
  const n1Val = n1 ? n1.value.trim() : "";
  const n2Val = n2 ? n2.value.trim() : "";

  const showErr = (msg) => {
    if (fb) {
      fb.style.display = "block";
      fb.style.background = "rgba(239, 68, 68, 0.2)";
      fb.style.color = "#f87171";
      fb.innerText = msg;
    }
  };

  if (curVal !== adminState.adminPin) {
    showErr("O PIN atual informado está incorreto!");
    return;
  }
  if (!/^\d{4,8}$/.test(n1Val)) {
    showErr("O novo PIN deve conter entre 4 e 8 números!");
    return;
  }
  if (n1Val !== n2Val) {
    showErr("A confirmação do novo PIN não confere!");
    return;
  }

  adminState.adminPin = n1Val;
  localStorage.setItem("elieudo_admin_pin", n1Val);
  if (typeof fbSaveAdminPin === "function") {
    fbSaveAdminPin(n1Val);
  }

  if (fb) {
    fb.style.display = "block";
    fb.style.background = "rgba(16, 185, 129, 0.2)";
    fb.style.color = "#34d399";
    fb.innerText = "✅ PIN atualizado com sucesso!";
  }

  setTimeout(() => {
    closeChangePinModal();
  }, 1200);
}
window.saveNewAdminPin = saveNewAdminPin;

// ============================================================
// FRENTE 3: GERENCIAMENTO DE CUPONS DE DESCONTO & PROMOÇÕES
// ============================================================

function loadCoupons() {
  try {
    const raw = localStorage.getItem("elieudo_coupons_db");
    if (raw) {
      adminState.coupons = JSON.parse(raw);
    } else {
      adminState.coupons = [
        { code: "BEMVINDO", type: "percent", value: 10, minOrder: 30, active: true, desc: "10% OFF na primeira compra" },
        { code: "ELIEUDO5", type: "fixed", value: 5, minOrder: 40, active: true, desc: "R$ 5,00 OFF acima de R$ 40" }
      ];
    }
  } catch (e) {
    adminState.coupons = [];
  }
  updateCouponsBadge();
}

function saveCoupons() {
  localStorage.setItem("elieudo_coupons_db", JSON.stringify(adminState.coupons));
  if (typeof fbSaveCoupons === "function") {
    fbSaveCoupons(adminState.coupons);
  }
  if (window.BroadcastChannel) {
    const channel = new BroadcastChannel("elieudo_coupons_bus");
    channel.postMessage({ type: "COUPONS_UPDATED", coupons: adminState.coupons });
  }
  updateCouponsBadge();
}

function updateCouponsBadge() {
  const badge = document.getElementById("badge-coupons-count");
  if (badge) {
    const activeCount = adminState.coupons.filter(c => c.active).length;
    badge.innerText = `${activeCount} ativo${activeCount === 1 ? '' : 's'}`;
  }
}

function renderCouponsList() {
  const container = document.getElementById("coupons-container");
  if (!container) return;

  updateCouponsBadge();

  if (!adminState.coupons || adminState.coupons.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <p style="font-size: 2.4rem; margin-bottom: 8px;">🎟️</p>
        <p>Nenhum cupom cadastrado no momento.</p>
        <button class="btn-admin btn-save-photo" onclick="openCreateCouponModal()" style="margin-top: 14px;">
          ➕ Criar Primeiro Cupom
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = adminState.coupons.map(coupon => {
    const discountText = coupon.type === "percent" 
      ? `${coupon.value}% de Desconto` 
      : `${formatBRL(coupon.value)} de Desconto`;
    const minOrderText = coupon.minOrder > 0 
      ? `Pedido mínimo: ${formatBRL(coupon.minOrder)}` 
      : `Sem valor mínimo de pedido`;

    return `
      <div class="coupon-card ${coupon.active ? '' : 'is-inactive'}">
        <div class="coupon-card-header">
          <div class="coupon-badge-code">
            <span>🎟️</span>
            <span>${coupon.code}</span>
          </div>
          <span class="coupon-status-badge ${coupon.active ? 'active' : 'inactive'}">
            ${coupon.active ? '🟢 Ativo' : '🔴 Pausado'}
          </span>
        </div>

        <div>
          <div class="coupon-discount-val">${discountText}</div>
          <div class="coupon-rule-sub" style="margin-top: 4px;">${minOrderText}</div>
          ${coupon.desc ? `<div class="coupon-rule-sub" style="font-style: italic; margin-top: 2px;">"${coupon.desc}"</div>` : ''}
        </div>

        <div class="coupon-card-footer">
          <button class="btn-admin" onclick="toggleCouponStatus('${coupon.code}')" style="font-size: 0.8rem; padding: 6px 12px;">
            ${coupon.active ? '⏸️ Pausar' : '▶️ Ativar'}
          </button>
          <div class="coupon-action-btns">
            <button class="btn-admin" onclick="openEditCouponModal('${coupon.code}')" title="Editar Cupom" style="font-size: 0.8rem; padding: 6px 10px;">
              ✏️
            </button>
            <button class="btn-admin" onclick="deleteCoupon('${coupon.code}')" title="Excluir Cupom" style="font-size: 0.8rem; padding: 6px 10px; color: #ef4444;">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function openCreateCouponModal() {
  const modal = document.getElementById("coupon-edit-modal");
  const title = document.getElementById("coupon-modal-title");
  const orig = document.getElementById("input-coupon-original-code");
  const code = document.getElementById("input-coupon-code");
  const val = document.getElementById("input-coupon-value");
  const min = document.getElementById("input-coupon-min-order");
  const desc = document.getElementById("input-coupon-desc");
  const act = document.getElementById("input-coupon-active");

  if (title) title.innerText = "Criar Novo Cupom";
  if (orig) orig.value = "";
  if (code) { code.value = ""; code.disabled = false; }
  if (val) val.value = "";
  if (min) min.value = "";
  if (desc) desc.value = "";
  if (act) act.checked = true;

  setCouponTypeChoice("percent");
  if (modal) modal.style.display = "flex";
}
window.openCreateCouponModal = openCreateCouponModal;

function openEditCouponModal(couponCode) {
  const coupon = adminState.coupons.find(c => c.code === couponCode);
  if (!coupon) return;

  const modal = document.getElementById("coupon-edit-modal");
  const title = document.getElementById("coupon-modal-title");
  const orig = document.getElementById("input-coupon-original-code");
  const code = document.getElementById("input-coupon-code");
  const val = document.getElementById("input-coupon-value");
  const min = document.getElementById("input-coupon-min-order");
  const desc = document.getElementById("input-coupon-desc");
  const act = document.getElementById("input-coupon-active");

  if (title) title.innerText = `Editar Cupom: ${coupon.code}`;
  if (orig) orig.value = coupon.code;
  if (code) { code.value = coupon.code; code.disabled = true; }
  if (val) val.value = coupon.value;
  if (min) min.value = coupon.minOrder || "";
  if (desc) desc.value = coupon.desc || "";
  if (act) act.checked = !!coupon.active;

  setCouponTypeChoice(coupon.type || "percent");
  if (modal) modal.style.display = "flex";
}
window.openEditCouponModal = openEditCouponModal;

function closeCouponModal() {
  const modal = document.getElementById("coupon-edit-modal");
  if (modal) modal.style.display = "none";
}
window.closeCouponModal = closeCouponModal;

function setCouponTypeChoice(type) {
  adminState.couponModalType = type;
  const btnP = document.getElementById("choice-coupon-percent");
  const btnF = document.getElementById("choice-coupon-fixed");
  const label = document.getElementById("label-coupon-value");

  if (btnP) btnP.classList.toggle("active", type === "percent");
  if (btnF) btnF.classList.toggle("active", type === "fixed");
  if (label) {
    label.innerText = type === "percent" ? "Valor do Desconto (%):" : "Valor do Desconto em Reais (R$):";
  }
}
window.setCouponTypeChoice = setCouponTypeChoice;

function saveCouponFromModal() {
  const origCode = document.getElementById("input-coupon-original-code").value;
  const codeInput = document.getElementById("input-coupon-code");
  const valInput = document.getElementById("input-coupon-value");
  const minInput = document.getElementById("input-coupon-min-order");
  const descInput = document.getElementById("input-coupon-desc");
  const activeInput = document.getElementById("input-coupon-active");

  const cleanCode = codeInput ? codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim() : "";
  const numVal = parseFloat(valInput ? valInput.value : "0");
  const numMin = parseFloat(minInput && minInput.value ? minInput.value : "0");
  const desc = descInput ? descInput.value.trim() : "";
  const isActive = activeInput ? activeInput.checked : true;

  if (!cleanCode) {
    alert("Por favor, digite um código válido para o cupom (letras e números)!");
    return;
  }
  if (isNaN(numVal) || numVal <= 0) {
    alert("Por favor, informe um valor de desconto válido e maior que zero!");
    return;
  }
  if (adminState.couponModalType === "percent" && numVal > 100) {
    alert("O desconto percentual não pode ser maior que 100%!");
    return;
  }

  // Verifica duplicação na criação
  if (!origCode && adminState.coupons.some(c => c.code === cleanCode)) {
    alert(`Já existe um cupom com o código ${cleanCode}! Escolha outro nome.`);
    return;
  }

  const couponData = {
    code: cleanCode,
    type: adminState.couponModalType,
    value: numVal,
    minOrder: isNaN(numMin) ? 0 : numMin,
    desc: desc,
    active: isActive
  };

  if (origCode) {
    const idx = adminState.coupons.findIndex(c => c.code === origCode);
    if (idx !== -1) adminState.coupons[idx] = couponData;
  } else {
    adminState.coupons.unshift(couponData);
  }

  saveCoupons();
  renderCouponsList();
  closeCouponModal();
  showCouponBanner(`✅ Cupom ${cleanCode} salvo com sucesso!`, "success");
}
window.saveCouponFromModal = saveCouponFromModal;

function toggleCouponStatus(code) {
  const coupon = adminState.coupons.find(c => c.code === code);
  if (coupon) {
    coupon.active = !coupon.active;
    saveCoupons();
    renderCouponsList();
    showCouponBanner(`Cupom ${code} ${coupon.active ? 'ativado' : 'pausado'}.`, "info");
  }
}
window.toggleCouponStatus = toggleCouponStatus;

function deleteCoupon(code) {
  if (confirm(`Deseja realmente excluir o cupom ${code}?`)) {
    adminState.coupons = adminState.coupons.filter(c => c.code !== code);
    saveCoupons();
    renderCouponsList();
    showCouponBanner(`Cupom ${code} excluído.`, "info");
  }
}
window.deleteCoupon = deleteCoupon;

function showCouponBanner(msg, type = "success") {
  const banner = document.getElementById("coupon-notification-banner");
  if (!banner) return;
  banner.className = `stock-banner banner-${type}`;
  banner.innerHTML = `<span>${msg}</span>`;
  banner.style.display = "flex";
  setTimeout(() => { banner.style.display = "none"; }, 3000);
}

// ============================================================
// FRENTE 4: RELATÓRIOS & FECHAMENTO DE CAIXA
// ============================================================

function setReportsPeriod(period) {
  adminState.reportsPeriod = period;
  document.querySelectorAll(".report-chip-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.period === period);
  });
  renderReports();
}
window.setReportsPeriod = setReportsPeriod;

function getFilteredOrdersForReports() {
  const allOrders = adminState.orders || [];
  const validOrders = allOrders.filter(o => o.status !== "cancelado");

  const now = new Date();
  const todayDateStr = now.toLocaleDateString('pt-BR');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDateStr = yesterday.toLocaleDateString('pt-BR');

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  return validOrders.filter(order => {
    if (adminState.reportsPeriod === "all") return true;

    const orderTime = order.timestamp ? new Date(order.timestamp) : null;
    const orderDateStr = order.dateStr || (orderTime ? orderTime.toLocaleDateString('pt-BR') : "");

    if (adminState.reportsPeriod === "today") {
      return orderDateStr === todayDateStr;
    }
    if (adminState.reportsPeriod === "yesterday") {
      return orderDateStr === yesterdayDateStr;
    }
    if (adminState.reportsPeriod === "week") {
      return orderTime ? orderTime >= weekAgo : false;
    }
    if (adminState.reportsPeriod === "month") {
      return orderTime ? (orderTime.getMonth() === curMonth && orderTime.getFullYear() === curYear) : false;
    }
    return true;
  });
}

function renderReports() {
  const orders = getFilteredOrdersForReports();

  let totalRevenue = 0;
  let totalDiscounts = 0;
  let totalDelivery = 0;
  let paymentCounts = { pix: 0, cartao: 0, dinheiro: 0 };
  let paymentTotals = { pix: 0, cartao: 0, dinheiro: 0 };
  let deliveryCount = 0;
  let balcaoCount = 0;
  let productStats = {};

  orders.forEach(o => {
    const orderTotal = o.totalPrice !== undefined ? o.totalPrice : (o.subtotal || 0);
    totalRevenue += orderTotal;
    totalDiscounts += (o.discountAmount || 0);
    totalDelivery += (o.deliveryFee || 0);

    // Meio de pagamento
    const payStr = (o.paymentMethod || "").toLowerCase();
    if (payStr.includes("pix")) {
      paymentCounts.pix++;
      paymentTotals.pix += orderTotal;
    } else if (payStr.includes("cart") || payStr.includes("crédito") || payStr.includes("débito")) {
      paymentCounts.cartao++;
      paymentTotals.cartao += orderTotal;
    } else {
      paymentCounts.dinheiro++;
      paymentTotals.dinheiro += orderTotal;
    }

    // Modalidade
    if (o.deliveryType === "delivery") {
      deliveryCount++;
    } else {
      balcaoCount++;
    }

    // Produtos e sabores
    if (Array.isArray(o.items)) {
      o.items.forEach(item => {
        const key = item.flavorDescription || item.name || "Item";
        const qty = item.quantity || 1;
        const isPizza = (item.category && item.category.includes("pizza")) || key.toLowerCase().includes("pizza") || item.selectedFlavors;
        if (!productStats[key]) {
          productStats[key] = { name: key, count: 0, isPizza: !!isPizza };
        }
        productStats[key].count += qty;
      });
    }
  });

  const completedCount = orders.length;
  const avgTicket = completedCount > 0 ? (totalRevenue / completedCount) : 0;

  // Atualizar KPIs
  const elRev = document.getElementById("rep-total-revenue");
  const elOrdersSub = document.getElementById("rep-orders-count-sub");
  const elTicket = document.getElementById("rep-average-ticket");
  const elDisc = document.getElementById("rep-total-discounts");
  const elDiscSub = document.getElementById("rep-coupons-used-sub");
  const elDeliv = document.getElementById("rep-delivery-total");
  const elDelivSub = document.getElementById("rep-delivery-count-sub");

  if (elRev) elRev.innerText = formatBRL(totalRevenue);
  if (elOrdersSub) elOrdersSub.innerText = `${completedCount} pedido${completedCount === 1 ? '' : 's'} no período`;
  if (elTicket) elTicket.innerText = formatBRL(avgTicket);
  if (elDisc) elDisc.innerText = formatBRL(totalDiscounts);
  if (elDiscSub) elDiscSub.innerText = totalDiscounts > 0 ? "Descontos concedidos" : "Nenhum desconto";
  if (elDeliv) elDeliv.innerText = formatBRL(totalDelivery);
  if (elDelivSub) elDelivSub.innerText = `${deliveryCount} entrega${deliveryCount === 1 ? '' : 's'}`;

  // Formas de Pagamento
  const payList = document.getElementById("rep-payment-methods-list");
  if (payList) {
    const totalAllPay = (paymentTotals.pix + paymentTotals.cartao + paymentTotals.dinheiro) || 1;
    const pixPct = Math.round((paymentTotals.pix / totalAllPay) * 100);
    const cardPct = Math.round((paymentTotals.cartao / totalAllPay) * 100);
    const cashPct = Math.round((paymentTotals.dinheiro / totalAllPay) * 100);

    payList.innerHTML = `
      <div class="payment-bar-item">
        <div class="payment-bar-header">
          <span>🟢 PIX (${paymentCounts.pix} pedidos)</span>
          <span>${formatBRL(paymentTotals.pix)} (${pixPct}%)</span>
        </div>
        <div class="payment-bar-track">
          <div class="payment-bar-fill fill-pix" style="width: ${pixPct}%;"></div>
        </div>
      </div>

      <div class="payment-bar-item">
        <div class="payment-bar-header">
          <span>💳 Cartão de Crédito / Débito (${paymentCounts.cartao} pedidos)</span>
          <span>${formatBRL(paymentTotals.cartao)} (${cardPct}%)</span>
        </div>
        <div class="payment-bar-track">
          <div class="payment-bar-fill fill-card" style="width: ${cardPct}%;"></div>
        </div>
      </div>

      <div class="payment-bar-item">
        <div class="payment-bar-header">
          <span>💵 Dinheiro (${paymentCounts.dinheiro} pedidos)</span>
          <span>${formatBRL(paymentTotals.dinheiro)} (${cashPct}%)</span>
        </div>
        <div class="payment-bar-track">
          <div class="payment-bar-fill fill-cash" style="width: ${cashPct}%;"></div>
        </div>
      </div>
    `;
  }

  // Split Delivery vs Balcão
  const delivCard = document.getElementById("rep-delivery-split-card");
  if (delivCard) {
    const totalSplit = (deliveryCount + balcaoCount) || 1;
    const delivPct = Math.round((deliveryCount / totalSplit) * 100);
    const balcaoPct = Math.round((balcaoCount / totalSplit) * 100);

    delivCard.innerHTML = `
      <div class="split-stat-row">
        <div class="split-stat-label">
          <span>🛵 Delivery (Entrega)</span>
        </div>
        <div class="split-stat-val text-green">${deliveryCount} (${delivPct}%)</div>
      </div>

      <div class="split-stat-row">
        <div class="split-stat-label">
          <span>🏪 Retirada no Balcão</span>
        </div>
        <div class="split-stat-val" style="color: #60a5fa;">${balcaoCount} (${balcaoPct}%)</div>
      </div>
    `;
  }

  // Rankings
  const pizzasList = Object.values(productStats).filter(p => p.isPizza).sort((a, b) => b.count - a.count);
  const othersList = Object.values(productStats).filter(p => !p.isPizza).sort((a, b) => b.count - a.count);

  const topPizzasEl = document.getElementById("rep-top-pizzas-list");
  const topOthersEl = document.getElementById("rep-top-others-list");

  if (topPizzasEl) {
    if (pizzasList.length === 0) {
      topPizzasEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-dim);">Sem pedidos de pizza no período.</span>`;
    } else {
      topPizzasEl.innerHTML = pizzasList.slice(0, 5).map((item, idx) => `
        <div class="ranking-item">
          <span class="ranking-pos">${idx + 1}º</span>
          <span class="ranking-name">${item.name}</span>
          <span class="ranking-qty">${item.count} un</span>
        </div>
      `).join("");
    }
  }

  if (topOthersEl) {
    if (othersList.length === 0) {
      topOthersEl.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-dim);">Sem bebidas ou esfihas no período.</span>`;
    } else {
      topOthersEl.innerHTML = othersList.slice(0, 5).map((item, idx) => `
        <div class="ranking-item">
          <span class="ranking-pos">${idx + 1}º</span>
          <span class="ranking-name">${item.name}</span>
          <span class="ranking-qty">${item.count} un</span>
        </div>
      `).join("");
    }
  }
}

function printCashClosingReceipt() {
  const orders = getFilteredOrdersForReports();
  const periodMap = {
    today: "Hoje",
    yesterday: "Ontem",
    week: "Últimos 7 Dias",
    month: "Este Mês",
    all: "Todo o Histórico"
  };
  const periodLabel = periodMap[adminState.reportsPeriod] || "Personalizado";

  let totalRevenue = 0;
  let totalDiscounts = 0;
  let payTotals = { pix: 0, cartao: 0, dinheiro: 0 };
  let payCounts = { pix: 0, cartao: 0, dinheiro: 0 };
  let deliveryCount = 0;
  let balcaoCount = 0;

  orders.forEach(o => {
    const val = o.totalPrice !== undefined ? o.totalPrice : (o.subtotal || 0);
    totalRevenue += val;
    totalDiscounts += (o.discountAmount || 0);

    const pay = (o.paymentMethod || "").toLowerCase();
    if (pay.includes("pix")) { payTotals.pix += val; payCounts.pix++; }
    else if (pay.includes("cart") || pay.includes("crédito") || pay.includes("débito")) { payTotals.cartao += val; payCounts.cartao++; }
    else { payTotals.dinheiro += val; payCounts.dinheiro++; }

    if (o.deliveryType === "delivery") deliveryCount++; else balcaoCount++;
  });

  const now = new Date();
  const emitStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const thermalDiv = document.getElementById("admin-thermal-receipt");
  if (!thermalDiv) return;

  thermalDiv.innerHTML = `
    <div style="font-family: monospace; font-size: 12px; line-height: 1.4; width: 280px; margin: 0 auto; color: #000; padding: 10px;">
      <div style="text-align: center; font-weight: bold; font-size: 14px;">PIZZARIA DO ELIEUDO</div>
      <div style="text-align: center; font-size: 11px;">FECHAMENTO DE CAIXA</div>
      <div style="text-align: center; font-size: 10px; margin-bottom: 6px;">Emissão: ${emitStr}</div>
      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      
      <div><strong>Período:</strong> ${periodLabel}</div>
      <div><strong>Total de Pedidos:</strong> ${orders.length}</div>
      <div><strong>Delivery:</strong> ${deliveryCount} | <strong>Balcão:</strong> ${balcaoCount}</div>
      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <div style="font-weight: bold; margin-bottom: 4px;">FORMAS DE PAGAMENTO:</div>
      <div style="display: flex; justify-content: space-between;">
        <span>PIX (${payCounts.pix}):</span>
        <span>${formatBRL(payTotals.pix)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Cartão (${payCounts.cartao}):</span>
        <span>${formatBRL(payTotals.cartao)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Dinheiro (${payCounts.dinheiro}):</span>
        <span>${formatBRL(payTotals.dinheiro)}</span>
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      ${totalDiscounts > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Descontos Cupons:</span>
          <span>- ${formatBRL(totalDiscounts)}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 4px;">
        <span>FATURAMENTO TOTAL:</span>
        <span>${formatBRL(totalRevenue)}</span>
      </div>

      <div style="border-top: 1px dashed #000; margin: 12px 0 20px;"></div>
      <div style="text-align: center; margin-top: 25px; border-top: 1px solid #000; padding-top: 4px; font-size: 11px;">
        Assinatura do Responsável
      </div>
    </div>
  `;

  window.print();
}
window.printCashClosingReceipt = printCashClosingReceipt;

function copyClosingToWhatsApp() {
  const orders = getFilteredOrdersForReports();
  const periodMap = {
    today: "Hoje",
    yesterday: "Ontem",
    week: "Últimos 7 Dias",
    month: "Este Mês",
    all: "Todo o Histórico"
  };
  const periodLabel = periodMap[adminState.reportsPeriod] || "Personalizado";

  let totalRevenue = 0;
  let totalDiscounts = 0;
  let totalDelivery = 0;
  let payTotals = { pix: 0, cartao: 0, dinheiro: 0 };
  let payCounts = { pix: 0, cartao: 0, dinheiro: 0 };
  let deliveryCount = 0;
  let balcaoCount = 0;

  orders.forEach(o => {
    const val = o.totalPrice !== undefined ? o.totalPrice : (o.subtotal || 0);
    totalRevenue += val;
    totalDiscounts += (o.discountAmount || 0);
    totalDelivery += (o.deliveryFee || 0);

    const pay = (o.paymentMethod || "").toLowerCase();
    if (pay.includes("pix")) { payTotals.pix += val; payCounts.pix++; }
    else if (pay.includes("cart") || pay.includes("crédito") || pay.includes("débito")) { payTotals.cartao += val; payCounts.cartao++; }
    else { payTotals.dinheiro += val; payCounts.dinheiro++; }

    if (o.deliveryType === "delivery") deliveryCount++; else balcaoCount++;
  });

  const now = new Date();
  const emitStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const avgTicket = orders.length > 0 ? (totalRevenue / orders.length) : 0;

  let msg = `🍕 *FECHAMENTO DE CAIXA - PIZZARIA DO ELIEUDO*\n`;
  msg += `📅 *Período:* ${periodLabel}\n`;
  msg += `🕒 *Emitido em:* ${emitStr}\n`;
  msg += `-------------------------------------------\n`;
  msg += `💰 *FATURAMENTO TOTAL: ${formatBRL(totalRevenue)}*\n`;
  msg += `📋 *Total de Pedidos:* ${orders.length}\n`;
  msg += `🏷️ *Ticket Médio:* ${formatBRL(avgTicket)}\n`;
  if (totalDiscounts > 0) msg += `🎟️ *Descontos Concedidos:* ${formatBRL(totalDiscounts)}\n`;
  if (totalDelivery > 0) msg += `🛵 *Taxas de Entrega:* ${formatBRL(totalDelivery)}\n`;
  msg += `-------------------------------------------\n`;
  msg += `💳 *FORMAS DE PAGAMENTO:*\n`;
  msg += `• 🟢 PIX: ${formatBRL(payTotals.pix)} (${payCounts.pix} pedidos)\n`;
  msg += `• 💳 Cartões: ${formatBRL(payTotals.cartao)} (${payCounts.cartao} pedidos)\n`;
  msg += `• 💵 Dinheiro: ${formatBRL(payTotals.dinheiro)} (${payCounts.dinheiro} pedidos)\n`;
  msg += `-------------------------------------------\n`;
  msg += `🛵 *MODALIDADE DE ATENDIMENTO:*\n`;
  msg += `• Delivery (Entrega): ${deliveryCount} pedidos\n`;
  msg += `• Retirada no Balcão: ${balcaoCount} pedidos\n`;
  msg += `-------------------------------------------\n`;
  msg += `_Emitido pelo Painel Operacional Elieudo_`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(() => {
      alert("✅ Resumo do Fechamento de Caixa copiado com sucesso!\n\nCole diretamente no WhatsApp.");
    }).catch(() => {
      prompt("Copie o resumo abaixo:", msg);
    });
  } else {
    prompt("Copie o resumo abaixo:", msg);
  }
}
window.copyClosingToWhatsApp = copyClosingToWhatsApp;


