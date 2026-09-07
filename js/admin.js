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
  modalStatusChoice: true
};

// Formatação BRL
function formatBRL(val) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  loadOrders();
  loadStockStatus();
  loadStoreSettings();
  renderKanban();
  updateMetrics();
  renderStockManager();
  setupBroadcastListener();
  setupAdminControls();
  setupTabNavigation();
  setupStockControls();
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

// Escuta em tempo real de novos pedidos via BroadcastChannel
function setupBroadcastListener() {
  if (window.BroadcastChannel) {
    const channel = new BroadcastChannel("elieudo_orders_bus");
    channel.onmessage = (event) => {
      if (event.data && event.data.type === "NEW_ORDER") {
        playNotificationBeep();
        loadOrders();
        renderKanban();
        updateMetrics();
      }
    };
  }

  // Fallback com window storage event
  window.addEventListener("storage", (e) => {
    if (e.key === "elieudo_orders_db") {
      loadOrders();
      renderKanban();
      updateMetrics();
    }
  });
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

    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
      <span>TOTAL:</span>
      <span>${formatBRL(order.subtotal || 0)}</span>
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
      const mockOrder = {
        id: `#${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('pt-BR'),
        timeStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        customer: {
          name: "Cliente Teste",
          phone: "(85) 98888-0000",
          address: "Rua das Flores, 100 - Jacaúna",
          reference: "Próximo à praça"
        },
        deliveryType: "delivery",
        paymentMethod: "PIX",
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
        subtotal: 79.90,
        status: "pendente"
      };

      adminState.orders.unshift(mockOrder);
      saveOrders();
      playNotificationBeep();
      renderKanban();
      updateMetrics();
    };
  }

  const btnClear = document.getElementById("btn-clear-orders");
  if (btnClear) {
    btnClear.onclick = () => {
      if (confirm("Deseja limpar todos os pedidos do histórico?")) {
        adminState.orders = [];
        saveOrders();
        renderKanban();
        updateMetrics();
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

// Salvar lista de itens esgotados e notificar cardápio do cliente via BroadcastChannel
function saveStockStatus() {
  localStorage.setItem("elieudo_out_of_stock", JSON.stringify(adminState.outOfStock));
  if (window.BroadcastChannel) {
    const channel = new BroadcastChannel("elieudo_stock_bus");
    channel.postMessage({ type: "STOCK_UPDATED", outOfStock: adminState.outOfStock });
  }
}

// Alternar entre abas (KDS vs Gestão de Sabores)
function setupTabNavigation() {
  const btnKds = document.getElementById("tab-btn-kds");
  const btnStock = document.getElementById("tab-btn-stock");
  const viewKds = document.getElementById("view-kds");
  const viewStock = document.getElementById("view-stock");

  if (btnKds && btnStock && viewKds && viewStock) {
    btnKds.onclick = () => {
      adminState.activeTab = "kds";
      btnKds.classList.add("active");
      btnStock.classList.remove("active");
      viewKds.style.display = "block";
      viewStock.style.display = "none";
    };

    btnStock.onclick = () => {
      adminState.activeTab = "stock";
      btnStock.classList.add("active");
      btnKds.classList.remove("active");
      viewKds.style.display = "none";
      viewStock.style.display = "block";
      renderStockManager();
    };
  }
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

    let priceLabel = "";
    if (item.prices) {
      priceLabel = `A partir de ${formatBRL(item.prices.M)}`;
    } else if (item.price !== undefined) {
      priceLabel = formatBRL(item.price);
    }

    return `
      <div class="stock-card ${isOut ? 'is-out-of-stock' : ''}" data-id="${item.id}">
        <div class="stock-card-thumb">
          <img src="${item.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400'}" alt="${item.name}" loading="lazy" />
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
            <button class="btn-stock-toggle ${isOut ? 'btn-make-available' : 'btn-make-out'}" 
                    data-id="${item.id}">
              ${isOut ? `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Reativar Sabor</span>
              ` : `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                <span>Esgotar Sabor</span>
              `}
            </button>
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

