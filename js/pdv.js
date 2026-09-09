/**
 * Lógica do PDV & Atendimento de Salão / Garçom
 * Pizzaria do Elieudo
 */

const pdvState = {
  tables: {},
  selectedTableKey: null,
  currentFilter: "all", // 'all' | 'livre' | 'ocupada' | 'alerta'
  currentWaiter: localStorage.getItem("elieudo_waiter_name") || "Garçom 1",
  soundEnabled: true,
  currentCategory: "pizzas_tradicionais",
  stagedItems: [], // Itens da rodada que o garçom está montando antes de despachar
  outOfStockList: [],
  lastAlertedTables: new Set(),
  qrcodeInstance: null
};

// Formatação BRL
function formatBRL(val) {
  return (parseFloat(val) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Helper seguro para obter o cardápio
function getMenuData() {
  if (typeof MENU_DATA !== "undefined" && MENU_DATA && MENU_DATA.items) return MENU_DATA;
  if (typeof window !== "undefined" && window.MENU_DATA && window.MENU_DATA.items) return window.MENU_DATA;
  return { items: [], categories: [], sizes: [], crusts: [] };
}

// URL base segura para o cliente escanear no smartphone
function getCustomerBaseUrl() {
  const isLocal = !window.location.origin || 
                  window.location.origin === "null" || 
                  window.location.href.startsWith("file:") ||
                  window.location.hostname === "localhost" || 
                  window.location.hostname === "127.0.0.1";
                  
  if (isLocal) {
    // Para teste com celular físico lendo da tela, usa a URL pública com HTTPS.
    // O leitor de QR Code do celular identifica como Link Web real (não como texto puro)
    // e abre no Chrome/Safari conectando ao mesmo Firebase Realtime Database na nuvem.
    return "https://romariog3fis-collab.github.io/pizzaria-do-elieudo/index.html";
  }

  let path = window.location.pathname;
  let basePath = path.substring(0, path.lastIndexOf('/') + 1);
  return window.location.origin + basePath + "index.html";
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  initWaiterName();
  initSound();
  initHalfAndHalfSelects();
  setupFirebaseRealtime();
  switchLauncherCategory("pizzas_tradicionais");

  // Atualizar contadores de tempo a cada 30 segundos
  setInterval(() => {
    renderTablesGrid();
  }, 30000);
});

// Inicialização do Nome do Garçom
function initWaiterName() {
  const el = document.getElementById("current-waiter-name");
  if (el) el.innerText = pdvState.currentWaiter;
  const inputWaiter = document.getElementById("input-open-waiter");
  if (inputWaiter) inputWaiter.value = pdvState.currentWaiter;
}

function promptWaiterName() {
  const newName = prompt("Informe seu nome ou identificação de atendimento:", pdvState.currentWaiter);
  if (newName && newName.trim()) {
    pdvState.currentWaiter = newName.trim();
    localStorage.setItem("elieudo_waiter_name", pdvState.currentWaiter);
    initWaiterName();
  }
}
window.promptWaiterName = promptWaiterName;

// Alerta Sonoro usando Web Audio API
let audioCtx = null;
function initSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  } catch (e) {}
}

function playNotificationChime(type = "call") {
  if (!pdvState.soundEnabled) return;
  try {
    if (!audioCtx) initSound();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (!audioCtx) return;

    const ctx = audioCtx;
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    if (type === "call") {
      // Tom agudo chamando garçom
      playTone(659.25, 0, 0.2); // E5
      playTone(880.00, 0.15, 0.25); // A5
      playTone(1046.50, 0.3, 0.4); // C6
    } else {
      // Tom suave de confirmação
      playTone(523.25, 0, 0.15); // C5
      playTone(659.25, 0.12, 0.25); // E5
    }
  } catch (e) {
    console.log("Áudio bloqueado:", e);
  }
}

function toggleSound() {
  pdvState.soundEnabled = !pdvState.soundEnabled;
  const btn = document.getElementById("btn-toggle-sound");
  const icon = document.getElementById("sound-icon");
  if (btn && icon) {
    btn.classList.toggle("active", pdvState.soundEnabled);
    icon.innerText = pdvState.soundEnabled ? "🔔" : "🔕";
  }
}
window.toggleSound = toggleSound;

// Configuração de Ouvintes em Tempo Real
function setupFirebaseRealtime() {
  if (typeof fbListenTables === "function") {
    fbListenTables((tablesObj) => {
      if (tablesObj && typeof tablesObj === "object") {
        pdvState.tables = tablesObj;
        renderTablesGrid();
        checkActiveAlerts();
        // Se houver um modal de detalhes aberto, atualiza
        if (pdvState.selectedTableKey && document.getElementById("modal-table-details").classList.contains("active")) {
          renderTableDetails(pdvState.selectedTableKey);
        }
      }
    });
  }

  // Ouvinte de itens esgotados na cozinha
  if (typeof fbListenOutOfStock === "function") {
    fbListenOutOfStock((list) => {
      pdvState.outOfStockList = Array.isArray(list) ? list : [];
      renderLauncherItems();
    });
  }
}

// Renderização do Mapa de Mesas
function renderTablesGrid() {
  const container = document.getElementById("tables-grid-container");
  if (!container) return;

  const tableKeys = Object.keys(pdvState.tables).sort((a, b) => {
    const numA = pdvState.tables[a].number || 0;
    const numB = pdvState.tables[b].number || 0;
    return numA - numB;
  });

  let livresCount = 0;
  let ocupadasCount = 0;
  let alertasCount = 0;

  container.innerHTML = "";

  tableKeys.forEach(key => {
    const t = pdvState.tables[key];
    const isLivre = t.status === "livre" || !t.currentSession;
    const isCalling = t.callWaiter === true;
    const isRequestingBill = t.status === "aguardando_conta";

    if (isLivre) {
      livresCount++;
    } else {
      ocupadasCount++;
      if (isCalling || isRequestingBill) alertasCount++;
    }

    // Filtragem
    if (pdvState.currentFilter === "livre" && !isLivre) return;
    if (pdvState.currentFilter === "ocupada" && isLivre) return;
    if (pdvState.currentFilter === "alerta" && !(isCalling || isRequestingBill)) return;

    // Criar Card da Mesa
    const card = document.createElement("div");
    let statusClass = `status-${t.status || 'livre'}`;
    if (isCalling) statusClass += " calling-waiter";
    card.className = `table-card ${statusClass}`;
    card.id = `table-card-${key}`;
    card.onclick = () => onTableCardClicked(key);

    // Calcular tempo decorrido
    let timeAgo = "";
    if (t.currentSession && t.currentSession.openedAt) {
      const diffMinutes = Math.floor((Date.now() - t.currentSession.openedAt) / 60000);
      timeAgo = diffMinutes < 60 ? `${diffMinutes} min` : `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`;
    }

    let statusText = "Livre";
    if (isCalling) statusText = "🔔 Chamando!";
    else if (isRequestingBill) statusText = "🧾 Pede Conta";
    else if (t.status === "ocupada") statusText = "Ocupada";

    card.innerHTML = `
      ${isCalling ? `<span class="call-waiter-badge">🔔 Chamar</span>` : ''}
      <span class="table-num">${t.number < 10 ? '0' + t.number : t.number}</span>
      <span class="table-badge">${statusText}</span>

      <div class="table-details-box">
        ${isLivre ? `
          <span style="font-size: 0.68rem; color: #64748b;">Toque p/ abrir</span>
        ` : `
          <span class="table-customer-name" title="${t.currentSession.customerName || ''}">${t.currentSession.customerName || 'Cliente'}</span>
          <div class="table-total-val">${formatBRL(t.currentSession.total || 0)}</div>
          <span class="table-timer">🕒 ${timeAgo}</span>
        `}
      </div>
    `;

    container.appendChild(card);
  });

  // Atualizar contadores das métricas
  const elLivres = document.getElementById("metric-livres-count");
  const elOcupadas = document.getElementById("metric-ocupadas-count");
  const elAlertas = document.getElementById("metric-alertas-count");
  if (elLivres) elLivres.innerText = livresCount;
  if (elOcupadas) elOcupadas.innerText = ocupadasCount;
  if (elAlertas) elAlertas.innerText = alertasCount;
}

// Filtros de Visualização
function setTableFilter(filter) {
  pdvState.currentFilter = filter;
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.classList.toggle("active", btn.id === `filter-btn-${filter}`);
  });
  document.querySelectorAll(".metric-pill").forEach(pill => {
    pill.classList.remove("active");
  });
  if (filter === "livre") document.getElementById("pill-filter-livre")?.classList.add("active");
  if (filter === "ocupada") document.getElementById("pill-filter-ocupada")?.classList.add("active");
  if (filter === "alerta") document.getElementById("pill-filter-alerta")?.classList.add("active");

  renderTablesGrid();
}
window.setTableFilter = setTableFilter;

// Monitorar e alertar chamados das mesas
function checkActiveAlerts() {
  const alertBanner = document.getElementById("pdv-alert-banner");
  const alertMsg = document.getElementById("pdv-alert-msg");
  if (!alertBanner || !alertMsg) return;

  const callingTables = [];
  const billTables = [];

  Object.keys(pdvState.tables).forEach(key => {
    const t = pdvState.tables[key];
    if (t.callWaiter) callingTables.push(`Mesa ${t.number < 10 ? '0' + t.number : t.number}`);
    if (t.status === "aguardando_conta") billTables.push(`Mesa ${t.number < 10 ? '0' + t.number : t.number}`);
  });

  if (callingTables.length > 0 || billTables.length > 0) {
    let text = "";
    if (callingTables.length > 0) {
      text = `🙋‍♂️ ${callingTables.join(", ")} solicitando garçom!`;
    } else if (billTables.length > 0) {
      text = `🧾 ${billTables.join(", ")} solicitando a conta!`;
    }
    alertMsg.innerText = text;
    alertBanner.style.display = "flex";

    // Tocar som se for uma nova chamada
    const currentCallingSet = new Set(callingTables.concat(billTables));
    let hasNew = false;
    currentCallingSet.forEach(item => {
      if (!pdvState.lastAlertedTables.has(item)) hasNew = true;
    });
    if (hasNew) {
      playNotificationChime("call");
      pdvState.lastAlertedTables = currentCallingSet;
    }
  } else {
    alertBanner.style.display = "none";
    pdvState.lastAlertedTables.clear();
  }
}

function dismissCurrentAlert() {
  setTableFilter("alerta");
  const alertBanner = document.getElementById("pdv-alert-banner");
  if (alertBanner) alertBanner.style.display = "none";
}
window.dismissCurrentAlert = dismissCurrentAlert;

// Clique na Mesa (Abertura ou Detalhes)
function onTableCardClicked(tableKey) {
  pdvState.selectedTableKey = tableKey;
  const table = pdvState.tables[tableKey];
  if (!table) return;

  if (table.status === "livre" || !table.currentSession) {
    // Abre modal de abertura
    const titleEl = document.getElementById("open-modal-table-title");
    if (titleEl) titleEl.innerText = `Abrir Mesa ${table.number < 10 ? '0' + table.number : table.number}`;
    document.getElementById("input-open-customer").value = "";
    document.getElementById("input-open-people").value = "2";
    initWaiterName();
    openModal("modal-open-table");
  } else {
    // Abre modal de gestão / extrato da mesa
    renderTableDetails(tableKey);
    openModal("modal-table-details");
  }
}

// Abertura de Mesa
async function confirmOpenTable() {
  const tableKey = pdvState.selectedTableKey;
  const table = pdvState.tables[tableKey];
  if (!table) return;

  const custName = document.getElementById("input-open-customer").value;
  const numPeople = document.getElementById("input-open-people").value;
  const waiterName = pdvState.currentWaiter;

  const btn = document.getElementById("btn-confirm-open-table");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Abrindo mesa...</span>`;
  }

  try {
    const res = await fbOpenTable(table.number, {
      customerName: custName,
      waiterName: waiterName,
      numPeople: numPeople
    });

    closeModal("modal-open-table");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>✅ Abrir Mesa & Gerar QR Code</span>`;
    }

    // Exibe o QR Code dinâmico na tela do garçom
    showQRCodeForTable(tableKey, res.token);
    playNotificationChime("success");
  } catch (err) {
    alert("Erro ao abrir mesa: " + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>✅ Abrir Mesa & Gerar QR Code</span>`;
    }
  }
}
window.confirmOpenTable = confirmOpenTable;

// Geração do QR Code Dinâmico com Token
function showQRCodeForTable(tableKey, token) {
  pdvState.selectedTableKey = tableKey;
  const table = pdvState.tables[tableKey];
  if (!table || !table.currentSession) return;

  const activeToken = token || table.currentSession.token;
  const num = table.number;

  document.getElementById("qrcode-modal-title").innerText = `QR Code Seguro • Mesa ${num < 10 ? '0' + num : num}`;
  document.getElementById("qrcode-customer-label").innerText = `Cliente: ${table.currentSession.customerName}`;
  document.getElementById("qrcode-token-label").innerText = `TOKEN DE SESSÃO: ${activeToken}`;

  // Link seguro da comanda do cliente
  const baseUrl = getCustomerBaseUrl();
  const customerUrl = `${baseUrl}?mesa=${num}&token=${activeToken}`;
  const localUrl = `http://localhost:3000/index.html?mesa=${num}&token=${activeToken}`;

  pdvState.currentCustomerUrl = customerUrl;
  pdvState.currentLocalUrl = localUrl;

  const container = document.getElementById("qrcode-canvas-container");
  if (container) {
    container.innerHTML = "";
    if (window.QRCode) {
      pdvState.qrcodeInstance = new QRCode(container, {
        text: customerUrl,
        width: 190,
        height: 190,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      container.innerHTML = `<div style="padding: 10px; color: #000; font-weight: bold;">${customerUrl}</div>`;
    }
  }

  const linkDisplay = document.getElementById("qrcode-link-display");
  if (linkDisplay) {
    linkDisplay.innerHTML = `<a href="${customerUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline; word-break: break-all;">${customerUrl}</a>`;
  }

  openModal("modal-table-qrcode");
}

function showCurrentTableQRCode() {
  showQRCodeForTable(pdvState.selectedTableKey);
}
window.showCurrentTableQRCode = showCurrentTableQRCode;

function copyTableLink() {
  if (pdvState.currentCustomerUrl) {
    navigator.clipboard.writeText(pdvState.currentCustomerUrl).then(() => {
      alert("Link da comanda copiado com sucesso! Pode enviar no WhatsApp do cliente.");
    }).catch(() => {
      prompt("Copie o link abaixo:", pdvState.currentCustomerUrl);
    });
  }
}
window.copyTableLink = copyTableLink;

function openCustomerViewDirect() {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const targetUrl = (isLocal && pdvState.currentLocalUrl) ? pdvState.currentLocalUrl : pdvState.currentCustomerUrl;
  if (targetUrl) {
    window.open(targetUrl, "_blank");
  }
}
window.openCustomerViewDirect = openCustomerViewDirect;

function proceedToOrderStaging() {
  closeModal("modal-table-qrcode");
  openOrderLauncher();
}
window.proceedToOrderStaging = proceedToOrderStaging;

// Renderização dos Detalhes da Mesa
function renderTableDetails(tableKey) {
  const table = pdvState.tables[tableKey];
  if (!table || !table.currentSession) return;

  const session = table.currentSession;
  const num = table.number;

  document.getElementById("details-modal-title").innerText = `Mesa ${num < 10 ? '0' + num : num} • ${session.customerName}`;
  document.getElementById("details-modal-subtitle").innerText = `Aberta às ${session.openedTimeStr || '--:--'} • Atendida por ${session.waiterName || 'Salão'} (${session.numPeople || 1} pessoas)`;
  document.getElementById("details-total-price").innerText = formatBRL(session.total || session.subtotal || 0);

  // Banner se estiver chamando
  const callBanner = document.getElementById("details-call-banner");
  if (callBanner) {
    callBanner.style.display = table.callWaiter ? "flex" : "none";
  }

  // Lista de rodadas
  const roundsContainer = document.getElementById("details-rounds-list");
  if (!roundsContainer) return;

  roundsContainer.innerHTML = "";
  const rounds = session.rounds || [];

  if (rounds.length === 0) {
    roundsContainer.innerHTML = `
      <div style="background: #11151e; border: 1px dashed var(--pdv-border); border-radius: 12px; padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem;">
        Nenhum pedido lançado nesta mesa ainda.<br>
        Toque em <strong>"+ Lançar Pedido"</strong> para enviar a 1ª rodada para a cozinha.
      </div>
    `;
    return;
  }

  rounds.forEach(r => {
    const roundCard = document.createElement("div");
    roundCard.className = "round-timeline-card";

    let statusBadge = "";
    if (r.status === "pendente") statusBadge = `<span style="color: #f59e0b; font-weight: bold;">📋 Aguardando</span>`;
    else if (r.status === "preparando") statusBadge = `<span style="color: #3b82f6; font-weight: bold;">🔥 No Forno</span>`;
    else statusBadge = `<span style="color: #10b981; font-weight: bold;">✅ Entregue</span>`;

    roundCard.innerHTML = `
      <div class="round-timeline-head">
        <span>${r.orderId} • ${r.roundNumber}ª Rodada (${r.timeStr})</span>
        <span>${statusBadge}</span>
      </div>
      <div>
        ${(r.items || []).map(it => `
          <div class="round-item-line">
            <div>
              <div class="round-item-desc"><strong>${it.quantity}x</strong> ${it.flavorDescription || it.name}</div>
              ${it.details ? `<div class="round-item-details">${it.details}</div>` : ''}
            </div>
            <div style="font-weight: 700; color: #e2e8f0;">${formatBRL(it.totalPrice || (it.unitPrice * it.quantity))}</div>
          </div>
        `).join('')}
      </div>
    `;
    roundsContainer.appendChild(roundCard);
  });
}

function clearWaiterCallForCurrentTable() {
  if (pdvState.selectedTableKey && typeof fbCallWaiter === "function") {
    fbCallWaiter(pdvState.selectedTableKey, false);
    const callBanner = document.getElementById("details-call-banner");
    if (callBanner) callBanner.style.display = "none";
  }
}
window.clearWaiterCallForCurrentTable = clearWaiterCallForCurrentTable;

// Lançador de Comandas / Itens
function openOrderLauncher() {
  const table = pdvState.tables[pdvState.selectedTableKey];
  if (!table) return;

  document.getElementById("launcher-modal-title").innerText = `Lançar Itens • Mesa ${table.number < 10 ? '0' + table.number : table.number}`;
  pdvState.stagedItems = [];
  updateStagingUI();
  renderLauncherItems();
  openModal("modal-order-launcher");
}
window.openOrderLauncher = openOrderLauncher;

function switchLauncherCategory(cat) {
  pdvState.currentCategory = cat;
  document.querySelectorAll(".cat-scroll-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.cat === cat);
  });

  const halfBox = document.getElementById("box-half-builder");
  const itemsList = document.getElementById("launcher-items-list");

  if (cat === "meio_a_meio") {
    if (halfBox) halfBox.style.display = "block";
    if (itemsList) itemsList.style.display = "none";
    updateHalfPrice();
  } else {
    if (halfBox) halfBox.style.display = "none";
    if (itemsList) itemsList.style.display = "flex";
    renderLauncherItems();
  }
}
window.switchLauncherCategory = switchLauncherCategory;

function renderLauncherItems() {
  const list = document.getElementById("launcher-items-list");
  const menu = getMenuData();
  if (!list || !menu || !menu.items || menu.items.length === 0) return;

  const query = (document.getElementById("input-launcher-search")?.value || "").toLowerCase().trim();
  const cat = pdvState.currentCategory;

  let filtered = menu.items.filter(it => {
    if (query) {
      return (it.name && it.name.toLowerCase().includes(query)) ||
             (it.description && it.description.toLowerCase().includes(query));
    }
    if (cat === "bebidas") {
      return it.category === "bebidas" || it.category === "sucos";
    }
    if (cat === "esfihas") {
      return it.category && it.category.startsWith("esfihas");
    }
    return it.category === cat;
  });

  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML = `<div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 0.9rem;">
      🔍 Nenhum produto encontrado ${query ? `para "${query}"` : 'nesta categoria'}.
    </div>`;
    return;
  }

  filtered.forEach(item => {
    const isOut = pdvState.outOfStockList.includes(item.id);
    const row = document.createElement("div");
    row.className = "menu-picker-row";
    if (isOut) {
      row.style.opacity = "0.4";
      row.style.pointerEvents = "none";
    }

    // Preço padrão de exibição
    let displayPrice = 0;
    let sizeBadge = "";
    if (item.price) {
      displayPrice = item.price;
    } else if (item.prices && item.prices.G) {
      displayPrice = item.prices.G;
      sizeBadge = `<span style="font-size: 0.72rem; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Tam G</span>`;
    } else if (item.prices) {
      const firstKey = Object.keys(item.prices)[0];
      displayPrice = item.prices[firstKey] || 0;
      sizeBadge = `<span style="font-size: 0.72rem; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Tam ${firstKey}</span>`;
    }

    row.onclick = () => addItemToStaging(item);

    row.innerHTML = `
      <div>
        <div class="picker-item-title">${item.name} ${sizeBadge} ${isOut ? `<span style="color: #ef4444; font-size: 0.72rem; font-weight: 800;">(ESGOTADO)</span>` : ''}</div>
        <div class="picker-item-desc">${item.description || (item.category.includes('pizza') ? 'Pizza no forno a lenha' : '')}</div>
      </div>
      <div class="picker-item-price">${formatBRL(displayPrice)}</div>
    `;

    list.appendChild(row);
  });
}

function filterLauncherItems() {
  renderLauncherItems();
}
window.filterLauncherItems = filterLauncherItems;

// Adicionar Item Simples à Rodada Provisória
function addItemToStaging(item) {
  let unitPrice = 0;
  let size = "";
  let details = "";
  if (item.price) {
    unitPrice = item.price;
  } else if (item.prices && item.prices.G) {
    unitPrice = item.prices.G;
    size = "G";
    details = "Tamanho Grande (G - 8 fatias)";
  } else if (item.prices) {
    const firstKey = Object.keys(item.prices)[0];
    unitPrice = item.prices[firstKey] || 0;
    size = firstKey;
    details = `Tamanho ${firstKey}`;
  }

  const existing = pdvState.stagedItems.find(i => i.id === item.id && !i.isHalf);
  if (existing) {
    existing.quantity++;
    existing.totalPrice = existing.quantity * existing.unitPrice;
  } else {
    pdvState.stagedItems.push({
      id: item.id,
      name: item.name,
      flavorDescription: item.name,
      quantity: 1,
      unitPrice: unitPrice,
      totalPrice: unitPrice,
      size: size,
      details: details
    });
  }

  updateStagingUI();
  playNotificationChime("success");
}

// Inicializar Selects de Meio a Meio
function initHalfAndHalfSelects() {
  const sel1 = document.getElementById("select-flavor-1");
  const sel2 = document.getElementById("select-flavor-2");
  const menu = getMenuData();
  if (!sel1 || !sel2 || !menu || !menu.items || menu.items.length === 0) return;

  const pizzaItems = menu.items.filter(it => it.category && it.category.startsWith("pizzas_"));
  sel1.innerHTML = "";
  sel2.innerHTML = "";

  pizzaItems.forEach(p => {
    const opt1 = document.createElement("option");
    opt1.value = p.id;
    opt1.innerText = p.name;
    sel1.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = p.id;
    opt2.innerText = p.name;
    sel2.appendChild(opt2);
  });

  if (sel2.options.length > 1) sel2.selectedIndex = 1;
}

function updateHalfPrice() {
  const sel1 = document.getElementById("select-flavor-1");
  const sel2 = document.getElementById("select-flavor-2");
  const selSize = document.getElementById("select-half-size");
  const selCrust = document.getElementById("select-half-crust");
  const priceEl = document.getElementById("half-calc-price");
  if (!sel1 || !sel2 || !selSize || !selCrust || !priceEl) return 0;

  const menu = getMenuData();
  const items = (menu && Array.isArray(menu.items)) ? menu.items : [];
  if (items.length === 0) return 0;

  const id1 = sel1.value;
  const id2 = sel2.value;
  const size = selSize.value || "G";
  const crust = selCrust.value || "tradicional";

  const p1 = items.find(i => i.id === id1) || items[0];
  const p2 = items.find(i => i.id === id2) || items[1] || items[0];

  const price1 = (p1 && p1.prices && p1.prices[size]) ? p1.prices[size] : 0;
  const price2 = (p2 && p2.prices && p2.prices[size]) ? p2.prices[size] : 0;
  const basePizzaPrice = Math.max(price1, price2);

  let crustPrice = 0;
  if (crust === "catupiry" || crust === "cheddar") crustPrice = 10;
  if (crust === "chocolate") crustPrice = 12;

  const total = basePizzaPrice + crustPrice;
  priceEl.innerText = formatBRL(total);
  return total;
}
window.updateHalfPrice = updateHalfPrice;

function addHalfPizzaToStaging() {
  const sel1 = document.getElementById("select-flavor-1");
  const sel2 = document.getElementById("select-flavor-2");
  const selSize = document.getElementById("select-half-size");
  const selCrust = document.getElementById("select-half-crust");
  const obs = document.getElementById("input-half-obs")?.value.trim() || "";
  if (!sel1 || !sel2 || !selSize || !selCrust) return;

  const menu = getMenuData();
  const items = (menu && Array.isArray(menu.items)) ? menu.items : [];
  if (items.length === 0) return;

  const p1 = items.find(i => i.id === sel1.value) || items[0];
  const p2 = items.find(i => i.id === sel2.value) || items[1] || items[0];
  if (!p1 || !p2) {
    alert("Selecione os sabores da pizza meio a meio!");
    return;
  }

  const size = selSize.value || "G";
  const crust = selCrust.value || "tradicional";
  const total = updateHalfPrice();

  let crustLabel = "Borda Tradicional";
  if (crust === "catupiry") crustLabel = "Borda Catupiry (+R$ 10,00)";
  if (crust === "cheddar") crustLabel = "Borda Cheddar (+R$ 10,00)";
  if (crust === "chocolate") crustLabel = "Borda Chocolate (+R$ 12,00)";

  const detailsArr = [`Tam ${size}`, crustLabel];
  if (obs) detailsArr.push(`Obs: ${obs}`);

  pdvState.stagedItems.push({
    id: `half_${Date.now()}`,
    isHalf: true,
    name: `Pizza ${size} (Meio a Meio)`,
    flavorDescription: `1/2 ${p1.name} + 1/2 ${p2.name}`,
    size: size,
    crust: crust,
    quantity: 1,
    unitPrice: total,
    totalPrice: total,
    details: detailsArr.join(" | ")
  });

  if (document.getElementById("input-half-obs")) {
    document.getElementById("input-half-obs").value = "";
  }

  updateStagingUI();
  playNotificationChime("success");
}
window.addHalfPizzaToStaging = addHalfPizzaToStaging;

// Atualizar UI do Carrinho Provisório
function updateStagingUI() {
  const container = document.getElementById("staging-items-container");
  const countEl = document.getElementById("staging-total-count");
  const subtotalEl = document.getElementById("staging-subtotal-val");
  if (!container || !countEl || !subtotalEl) return;

  const count = pdvState.stagedItems.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = pdvState.stagedItems.reduce((sum, i) => sum + i.totalPrice, 0);

  countEl.innerText = `${count} ${count === 1 ? 'item' : 'itens'}`;
  subtotalEl.innerText = formatBRL(subtotal);

  if (pdvState.stagedItems.length === 0) {
    container.innerHTML = `<div style="font-size: 0.75rem; color: #64748b; text-align: center; padding: 10px;">Nenhum item selecionado ainda</div>`;
    return;
  }

  container.innerHTML = "";
  pdvState.stagedItems.forEach((it, index) => {
    const row = document.createElement("div");
    row.className = "staging-item-row";
    row.innerHTML = `
      <div>
        <span style="font-weight: 700; color: #fff;">${it.quantity}x ${it.flavorDescription || it.name}</span>
        ${it.details ? `<div style="font-size: 0.7rem; color: #94a3b8;">${it.details}</div>` : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 800; color: #10b981;">${formatBRL(it.totalPrice)}</span>
        <button style="background: #ef4444; border: none; color: #fff; width: 22px; height: 22px; border-radius: 6px; cursor: pointer;" onclick="removeStagedItem(${index})">✕</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function removeStagedItem(index) {
  pdvState.stagedItems.splice(index, 1);
  updateStagingUI();
}
window.removeStagedItem = removeStagedItem;

// Despachar Rodada para a Cozinha e KDS
async function dispatchStagedRoundToKitchen() {
  if (pdvState.stagedItems.length === 0) {
    alert("Adicione pelo menos um item à rodada antes de enviar para a cozinha!");
    return;
  }

  const tableKey = pdvState.selectedTableKey;
  const table = pdvState.tables[tableKey];
  if (!table) return;

  const btn = document.getElementById("btn-dispatch-round");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Enviando p/ Cozinha...</span>`;
  }

  try {
    await fbAddRoundToTable(table.number, pdvState.stagedItems, pdvState.currentWaiter);

    closeModal("modal-order-launcher");
    pdvState.stagedItems = [];
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>🔥 Enviar Pedido p/ Cozinha</span>`;
    }

    renderTableDetails(tableKey);
    playNotificationChime("call");
    alert(`✅ Pedido da Mesa ${table.number} enviado para a cozinha com sucesso!`);
  } catch (err) {
    alert("Erro ao enviar pedido: " + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>🔥 Enviar Pedido p/ Cozinha</span>`;
    }
  }
}
window.dispatchStagedRoundToKitchen = dispatchStagedRoundToKitchen;

// Fechamento de Mesa
function openCloseTableModal() {
  const table = pdvState.tables[pdvState.selectedTableKey];
  if (!table || !table.currentSession) return;

  document.getElementById("close-modal-title").innerText = `Fechar Mesa ${table.number < 10 ? '0' + table.number : table.number}`;
  document.getElementById("close-subtotal-val").innerText = formatBRL(table.currentSession.subtotal || 0);
  document.getElementById("input-close-discount").value = "0";
  document.getElementById("check-close-tax").checked = false;
  document.getElementById("input-close-notes").value = "";

  recalculateCloseTotal();
  closeModal("modal-table-details");
  openModal("modal-close-table");
}
window.openCloseTableModal = openCloseTableModal;

function recalculateCloseTotal() {
  const table = pdvState.tables[pdvState.selectedTableKey];
  if (!table || !table.currentSession) return;

  const subtotal = table.currentSession.subtotal || 0;
  const discount = Math.max(0, parseFloat(document.getElementById("input-close-discount").value) || 0);
  const hasTax = document.getElementById("check-close-tax").checked;
  const serviceTax = hasTax ? (subtotal * 0.1) : 0;

  const total = Math.max(0, subtotal - discount + serviceTax);
  document.getElementById("close-total-val").innerText = formatBRL(total);

  // Divisão de conta por pessoa
  const numPeople = table.currentSession.numPeople || 1;
  if (numPeople > 1) {
    const perPerson = total / numPeople;
    document.getElementById("close-split-calc").innerText = `Divisão: ${formatBRL(perPerson)} por pessoa (${numPeople} pessoas)`;
  } else {
    document.getElementById("close-split-calc").innerText = "";
  }
}
window.recalculateCloseTotal = recalculateCloseTotal;

async function confirmCloseTable() {
  const tableKey = pdvState.selectedTableKey;
  const table = pdvState.tables[tableKey];
  if (!table || !table.currentSession) return;

  const payment = document.getElementById("select-close-payment").value;
  const discount = parseFloat(document.getElementById("input-close-discount").value) || 0;
  const hasTax = document.getElementById("check-close-tax").checked;
  const serviceTax = hasTax ? ((table.currentSession.subtotal || 0) * 0.1) : 0;
  const notes = document.getElementById("input-close-notes").value;

  if (!confirm(`Confirma o encerramento da Mesa ${table.number} no valor de ${document.getElementById("close-total-val").innerText}?`)) {
    return;
  }

  try {
    await fbCloseTable(table.number, {
      paymentMethod: payment,
      discount: discount,
      serviceTax: serviceTax,
      notes: notes
    });

    closeModal("modal-close-table");
    playNotificationChime("success");
    alert(`🎉 Mesa ${table.number} encerrada com sucesso e liberada para novos clientes!`);
  } catch (err) {
    alert("Erro ao encerrar mesa: " + err.message);
  }
}
window.confirmCloseTable = confirmCloseTable;

// Impressão da Pré-Conta / Extrato da Mesa
function printTableReceipt() {
  const table = pdvState.tables[pdvState.selectedTableKey];
  if (!table || !table.currentSession) return;

  const session = table.currentSession;
  const num = table.number;
  const container = document.getElementById("pdv-thermal-print");
  if (!container) return;

  const allItems = session.rounds.reduce((acc, r) => acc.concat(r.items || []), []);

  container.innerHTML = `
    <div style="font-family: monospace; padding: 10px; width: 80mm; margin: 0 auto; color: #000;">
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: 18px;">PIZZARIA DO ELIEUDO</h2>
        <div>Tel: (85) 99177-4881</div>
        <div>CONFERÊNCIA DE MESA / PRÉ-CONTA</div>
      </div>

      <div style="margin-bottom: 8px; font-size: 13px;">
        <div><strong>MESA:</strong> ${num < 10 ? '0' + num : num}</div>
        <div><strong>CLIENTE:</strong> ${session.customerName}</div>
        <div><strong>GARÇOM:</strong> ${session.waiterName || 'Salão'}</div>
        <div><strong>ABERTURA:</strong> ${session.openedDateStr || ''} às ${session.openedTimeStr || ''}</div>
      </div>

      <div style="border-top: 1px solid #000; padding-top: 6px; margin-bottom: 8px;">
        <div style="font-weight: bold; margin-bottom: 4px;">CONSUMO:</div>
        ${allItems.map(it => `
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>${it.quantity}x ${it.flavorDescription || it.name}</span>
            <span>${formatBRL(it.totalPrice || (it.unitPrice * it.quantity))}</span>
          </div>
        `).join('')}
      </div>

      <div style="border-top: 2px dashed #000; padding-top: 6px; font-size: 15px; font-weight: bold; display: flex; justify-content: space-between;">
        <span>TOTAL PARCIAL:</span>
        <span>${formatBRL(session.total || session.subtotal || 0)}</span>
      </div>

      <div style="text-align: center; margin-top: 12px; font-size: 11px;">
        Obrigado pela preferência!<br>
        _Não é documento fiscal_
      </div>
    </div>
  `;

  window.print();
}
window.printTableReceipt = printTableReceipt;

// Utilitários de Modal
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add("active");
}
window.openModal = openModal;

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove("active");
}
window.closeModal = closeModal;
