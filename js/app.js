/**
 * Lógica do Cardápio Digital da Pizzaria do Elieudo
 * Gerenciamento de carrinho, modal de customização, cálculo de meio a meio e envio WhatsApp
 */

// Estado Global da Aplicação
const appState = {
  cart: [],
  currentCategory: "pizzas_tradicionais",
  modalItem: null,
  selectedSize: "G",
  isHalfAndHalf: false,
  secondFlavor: null,
  selectedCrust: "tradicional",
  selectedExtraTop: null,
  observation: "",
  deliveryType: "delivery", // 'delivery' ou 'balcao'
  customer: {
    name: "",
    phone: "",
    address: "",
    reference: "",
    paymentMethod: "pix",
    changeFor: ""
  },
  // Frente 3: Cupom de Desconto
  appliedCoupon: null,
  availableCoupons: []
};

// Formatação BRL
function formatMoney(amount) {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  setupRealtimeListeners();
  renderCategoryTabs();
  renderMenu();
  setupEventListeners();
  loadCartFromStorage();
  updateCartUI();
  updateStoreStatusUI();
  initOrderTracking();
  initClientTableTracking();
});

// Sincronização em Tempo Real (Firebase & Fallback Local)
function setupRealtimeListeners() {
  // 1. Escuta fotos reais atualizadas no Firebase
  if (typeof fbListenItemImages === "function") {
    fbListenItemImages((customImages) => {
      if (customImages && typeof customImages === "object") {
        let changed = false;
        Object.keys(customImages).forEach(itemId => {
          const item = MENU_DATA.items.find(i => i.id === itemId);
          if (item && item.image !== customImages[itemId]) {
            item.image = customImages[itemId];
            changed = true;
          }
        });
        if (changed) {
          renderMenu();
        }
      }
    });
  }

  // 2. Escuta status da loja em tempo real
  if (typeof fbListenStoreSettings === "function") {
    fbListenStoreSettings((settings) => {
      if (settings) {
        updateStoreStatusUI();
      }
    });
  }

  // 3. Escuta sabores esgotados em tempo real
  if (typeof fbListenOutOfStock === "function") {
    fbListenOutOfStock((outList) => {
      renderMenu();
    });
  }

  // 4. Escuta cupons de desconto ativos em tempo real (Frente 3)
  if (typeof fbListenCoupons === "function") {
    fbListenCoupons((couponsList) => {
      if (couponsList && Array.isArray(couponsList)) {
        appState.availableCoupons = couponsList;
        revalidateAppliedCoupon();
      }
    });
  }
}

// Renderização das Abas de Categoria com Looping Infinito Suave
function renderCategoryTabs() {
  const container = document.getElementById("category-tabs-container");
  if (!container) return;

  const buildCategoryTabsMarkup = () => MENU_DATA.categories.map(cat => `
    <button class="category-tab ${cat.id === appState.currentCategory ? 'active' : ''}" 
            data-category="${cat.id}"
            type="button"
            title="Ir para ${cat.name}">
      <span>${cat.icon}</span>
      <span>${cat.name}</span>
    </button>
  `).join("");

  const tabsMarkup = buildCategoryTabsMarkup();

  // Duas faixas idênticas garantem um looping infinito perfeito e contínuo sem cortes
  container.innerHTML = `
    <div class="category-marquee-track category-track-primary">
      ${tabsMarkup}
    </div>
    <div class="category-marquee-track category-track-clone" aria-hidden="true">
      ${tabsMarkup}
    </div>
  `;

  // Event listener para todos os botões (sincronizando o estado ativo em ambas as faixas)
  container.querySelectorAll(".category-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const targetCatId = tab.dataset.category;
      appState.currentCategory = targetCatId;

      // Sincroniza a classe ativa em todas as instâncias da categoria nas duas faixas
      container.querySelectorAll(".category-tab").forEach(t => {
        if (t.dataset.category === targetCatId) {
          t.classList.add("active");
        } else {
          t.classList.remove("active");
        }
      });
      
      const targetSec = document.getElementById(`section-${targetCatId}`);
      if (targetSec) {
        const headerOffset = 100;
        const elementPosition = targetSec.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: elementPosition - headerOffset,
          behavior: 'smooth'
        });
      }
    });
  });

  // Pausar o looping ao interagir no mobile ou ao focar
  container.addEventListener("touchstart", () => {
    container.classList.add("is-paused");
  }, { passive: true });

  container.addEventListener("touchend", () => {
    setTimeout(() => {
      container.classList.remove("is-paused");
    }, 1800);
  });
}

// Renderização do Cardápio
function renderMenu() {
  const container = document.getElementById("menu-container");
  if (!container) return;

  container.innerHTML = MENU_DATA.categories.map(cat => {
    const items = MENU_DATA.items.filter(item => item.category === cat.id);
    if (items.length === 0) return "";

    return `
      <section id="section-${cat.id}" class="category-section">
        <div class="section-header">
          <h2 class="section-title">
            <span class="icon">${cat.icon}</span> ${cat.name}
          </h2>
        </div>
        <div class="menu-grid">
          ${items.map(item => renderFoodCard(item, cat.type)).join("")}
        </div>
      </section>
    `;
  }).join("");

  // Event Listeners nos botões de adicionar/personalizar
  container.querySelectorAll(".btn-add-action").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const itemId = e.currentTarget.dataset.id;
      handleItemAction(itemId);
    });
  });

  // Event Listeners nas imagens dos produtos (tornando a imagem clicável)
  container.querySelectorAll(".card-img-clickable").forEach(imgWrap => {
    imgWrap.addEventListener("click", (e) => {
      const itemId = e.currentTarget.dataset.id;
      handleItemAction(itemId);
    });

    imgWrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const itemId = e.currentTarget.dataset.id;
        handleItemAction(itemId);
      }
    });
  });
}

// Carregar configurações de funcionamento da loja (aberta/fechada e horários)
function getStoreSettings() {
  const defaultSettings = {
    isOpen: true,
    openingHours: (typeof MENU_DATA !== "undefined" && MENU_DATA.restaurant && MENU_DATA.restaurant.openingHours) 
      ? MENU_DATA.restaurant.openingHours 
      : "Terça a Domingo das 18:00 às 23:30",
    closedMessage: "Nosso horário de funcionamento é de Terça a Domingo das 18:00 às 23:30. Você pode consultar nosso cardápio, mas pedidos online estão temporariamente pausados."
  };

  try {
    const raw = localStorage.getItem("elieudo_store_settings");
    return raw ? Object.assign({}, defaultSettings, JSON.parse(raw)) : defaultSettings;
  } catch (e) {
    return defaultSettings;
  }
}

// Atualizar interface de status e horários no cardápio do cliente
function updateStoreStatusUI() {
  const settings = getStoreSettings();

  const badge = document.getElementById("header-status-badge");
  const badgeText = document.getElementById("header-status-text");
  const banner = document.getElementById("store-closed-banner");
  const bannerDesc = document.getElementById("closed-banner-desc");
  const headerHours = document.getElementById("header-hours-text");
  const footerHours = document.getElementById("footer-hours-text");
  const btnCheckout = document.getElementById("btn-submit-whatsapp");

  if (headerHours && settings.openingHours) {
    headerHours.innerText = settings.openingHours;
  }
  if (footerHours && settings.openingHours) {
    footerHours.innerText = settings.openingHours;
  }

  if (settings.isOpen) {
    if (badge) {
      badge.className = "status-badge open";
    }
    if (badgeText) {
      badgeText.innerText = "Aberto Agora";
    }
    if (banner) {
      banner.style.display = "none";
    }
    if (btnCheckout) {
      btnCheckout.classList.remove("store-closed");
      btnCheckout.innerHTML = `
        <span>Pedir pelo WhatsApp</span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/></svg>
      `;
    }
  } else {
    if (badge) {
      badge.className = "status-badge closed";
    }
    if (badgeText) {
      badgeText.innerText = "Fechado no Momento";
    }
    if (banner) {
      banner.style.display = "block";
      if (bannerDesc) {
        bannerDesc.innerText = settings.closedMessage || `Horário de funcionamento: ${settings.openingHours}. Pedidos online temporariamente pausados.`;
      }
    }
    if (btnCheckout) {
      btnCheckout.classList.add("store-closed");
      btnCheckout.innerHTML = `
        <span>🚫 Loja Fechada no Momento</span>
      `;
    }
  }
}

// Carregar lista de sabores/itens esgotados gerenciada no painel admin
function getOutOfStockItems() {
  try {
    const raw = localStorage.getItem("elieudo_out_of_stock");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Ouvir atualizações de estoque e status da loja em tempo real
if (window.BroadcastChannel) {
  const stockBus = new BroadcastChannel("elieudo_stock_bus");
  stockBus.onmessage = () => {
    renderMenu();
  };

  const storeBus = new BroadcastChannel("elieudo_store_bus");
  storeBus.onmessage = () => {
    updateStoreStatusUI();
  };
}

window.addEventListener("storage", (e) => {
  if (e.key === "elieudo_out_of_stock") {
    renderMenu();
  }
  if (e.key === "elieudo_store_settings") {
    updateStoreStatusUI();
  }
});

// Renderização de cada Card de Produto
function renderFoodCard(item, type) {
  const hasImage = item.image && item.image.trim() !== "";
  const outOfStockList = getOutOfStockItems();
  const isOutOfStock = outOfStockList.includes(item.id);
  
  let priceDisplay = "";
  if (type === "pizza") {
    priceDisplay = `
      <span class="price-label">A partir de</span>
      <span class="price-value">${formatMoney(item.prices.M)}</span>
    `;
  } else {
    priceDisplay = `
      <span class="price-label">Preço</span>
      <span class="price-value">${formatMoney(item.price)}</span>
    `;
  }

  const actionText = isOutOfStock 
    ? "Esgotado" 
    : (type === "pizza" ? "Personalizar" : "Adicionar");

  return `
    <article class="food-card ${isOutOfStock ? 'is-out-of-stock' : ''}" data-id="${item.id}">
      ${hasImage ? `
        <div class="card-img-wrap card-img-clickable ${isOutOfStock ? 'img-out-of-stock' : ''}" 
             data-id="${item.id}" 
             role="button" 
             tabindex="0" 
             title="${isOutOfStock ? 'Sabor esgotado por hoje' : `Clique na pizza para ${actionText.toLowerCase()}`}">
          <img src="${item.image}" alt="${item.name}" loading="lazy" />
          ${isOutOfStock ? `
            <span class="card-badge badge-esgotado">⛔ ESGOTADO</span>
          ` : (item.badge ? `<span class="card-badge">${item.badge}</span>` : "")}
          <div class="card-img-overlay ${isOutOfStock ? 'overlay-esgotado' : ''}">
            <span class="img-action-pill ${isOutOfStock ? 'pill-esgotado' : ''}">
              ${isOutOfStock ? `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                Esgotado Hoje
              ` : `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                ${actionText}
              `}
            </span>
          </div>
        </div>
      ` : ""}
      <div class="card-body">
        <div>
          <h3 class="card-title">${item.name}</h3>
          <p class="card-desc">${item.description || ""}</p>
        </div>
        <div class="card-footer">
          <div class="card-price-block">
            ${priceDisplay}
          </div>
          ${isOutOfStock ? `
            <button class="btn-add btn-add-disabled" disabled title="Este sabor esgotou no momento">
              <span>Esgotado</span>
            </button>
          ` : `
            <button class="btn-add btn-add-action" data-id="${item.id}">
              <span>${actionText}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          `}
        </div>
      </div>
    </article>
  `;
}

// Ação de clique: abre modal para pizza ou adiciona direto para bebidas/esfihas
function handleItemAction(itemId) {
  const item = MENU_DATA.items.find(i => i.id === itemId);
  if (!item) return;

  // Bloqueio se o item estiver esgotado
  const outOfStockList = getOutOfStockItems();
  if (outOfStockList.includes(itemId)) {
    alert(`Atenção: O sabor "${item.name}" está temporariamente esgotado por hoje.`);
    return;
  }

  const categoryObj = MENU_DATA.categories.find(c => c.id === item.category);

  if (categoryObj && categoryObj.type === "pizza") {
    openPizzaCustomizer(item);
  } else {
    // Adição direta de esfiha ou bebida
    addToCart({
      id: `${item.id}_${Date.now()}`,
      originalId: item.id,
      name: item.name,
      category: item.category,
      type: categoryObj ? categoryObj.type : "item",
      details: item.description || "",
      unitPrice: item.price,
      quantity: 1,
      totalPrice: item.price
    });
  }
}

// Modal de Customização de Pizza
function openPizzaCustomizer(item) {
  appState.modalItem = item;
  appState.selectedSize = "G";
  appState.isHalfAndHalf = false;
  appState.secondFlavor = null;
  appState.selectedCrust = "tradicional";
  appState.selectedExtraTop = null;
  appState.observation = "";

  const modal = document.getElementById("pizza-modal");
  if (!modal) return;

  document.getElementById("modal-pizza-name").innerText = item.name;
  document.getElementById("modal-pizza-desc").innerText = item.description || "";

  renderModalControls();
  calculateModalPrice();

  modal.classList.add("active");
}

function renderModalControls() {
  const item = appState.modalItem;
  if (!item) return;

  // Elementos do Meio a Meio
  const toggleBtn1 = document.getElementById("toggle-single-flavor");
  const toggleBtn2 = document.getElementById("toggle-half-flavor");
  const secondFlavorBox = document.getElementById("second-flavor-select-box");
  const selectSecondFlavor = document.getElementById("select-second-flavor");

  // Lista de sabores de pizza disponíveis para a segunda metade
  const allPizzas = MENU_DATA.items.filter(i => {
    const cat = MENU_DATA.categories.find(c => c.id === i.category);
    return cat && cat.type === "pizza";
  });

  // Função auxiliar para atualizar o select do 2º sabor com os preços do tamanho atual
  const updateSecondFlavorOptions = () => {
    const currentSize = appState.selectedSize;
    const currentSecondId = appState.secondFlavor ? appState.secondFlavor.id : "";
    const outOfStockList = getOutOfStockItems();
    
    selectSecondFlavor.innerHTML = `
      <option value="">Selecione o 2º Sabor...</option>
      ${allPizzas.map(p => {
        const isPOut = outOfStockList.includes(p.id);
        const isDisabled = p.id === item.id || isPOut;
        const outNotice = isPOut ? " — [ESGOTADO HOJE]" : "";
        return `
          <option value="${p.id}" ${isDisabled ? 'disabled' : ''} ${p.id === currentSecondId ? 'selected' : ''}>
            ${p.name} (${currentSize}: ${formatMoney(p.prices[currentSize])})${outNotice}
          </option>
        `;
      }).join("")}
    `;
  };

  // Tamanhos
  const sizeContainer = document.getElementById("modal-sizes-container");
  sizeContainer.innerHTML = MENU_DATA.sizes.map(sz => `
    <div class="size-pill ${sz.id === appState.selectedSize ? 'selected' : ''}" data-size="${sz.id}">
      <div class="size-name">${sz.name}</div>
      <div class="size-sub">${sz.slices}</div>
    </div>
  `).join("");

  sizeContainer.querySelectorAll(".size-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      appState.selectedSize = pill.dataset.size;
      sizeContainer.querySelectorAll(".size-pill").forEach(p => p.classList.remove("selected"));
      pill.classList.add("selected");
      updateSecondFlavorOptions();
      calculateModalPrice();
    });
  });

  // Inicializa o select com o tamanho padrão
  updateSecondFlavorOptions();

  toggleBtn1.onclick = () => {
    appState.isHalfAndHalf = false;
    appState.secondFlavor = null;
    toggleBtn1.classList.add("active");
    toggleBtn2.classList.remove("active");
    secondFlavorBox.style.display = "none";
    calculateModalPrice();
  };

  toggleBtn2.onclick = () => {
    appState.isHalfAndHalf = true;
    toggleBtn2.classList.add("active");
    toggleBtn1.classList.remove("active");
    secondFlavorBox.style.display = "block";
    updateSecondFlavorOptions();
    calculateModalPrice();
  };

  selectSecondFlavor.onchange = (e) => {
    const found = allPizzas.find(p => p.id === e.target.value);
    appState.secondFlavor = found || null;
    calculateModalPrice();
  };

  // Bordas
  const selectCrust = document.getElementById("select-crust");
  selectCrust.innerHTML = MENU_DATA.crusts.map(crust => `
    <option value="${crust.id}">
      ${crust.name} ${crust.price > 0 ? `(+ ${formatMoney(crust.price)})` : '(Grátis)'}
    </option>
  `).join("");
  selectCrust.value = appState.selectedCrust;
  selectCrust.onchange = (e) => {
    appState.selectedCrust = e.target.value;
    calculateModalPrice();
  };

  // Adicionais no Topo
  const selectExtra = document.getElementById("select-extra-top");
  selectExtra.innerHTML = `
    <option value="">Nenhum adicional</option>
    ${MENU_DATA.extraToppings.map(ex => `
      <option value="${ex.id}">
        ${ex.name} (+ ${formatMoney(ex.price)})
      </option>
    `).join("")}
  `;
  selectExtra.value = appState.selectedExtraTop || "";
  selectExtra.onchange = (e) => {
    appState.selectedExtraTop = e.target.value || null;
    calculateModalPrice();
  };

  // Observações
  const obsInput = document.getElementById("modal-pizza-obs");
  obsInput.value = "";
  obsInput.oninput = (e) => {
    appState.observation = e.target.value;
  };
}

// Cálculo dinâmico de preço com regra do maior valor ou média
function calculateModalPrice() {
  const item = appState.modalItem;
  if (!item) return 0;

  const size = appState.selectedSize;
  let basePrice = item.prices[size] || 0;

  // Regra de Meio a Meio: Adota o valor do sabor mais caro (Padrão mais justo e seguro da restauração)
  if (appState.isHalfAndHalf && appState.secondFlavor) {
    const secondPrice = appState.secondFlavor.prices[size] || 0;
    basePrice = Math.max(basePrice, secondPrice);
  }

  // Preço da Borda
  const crustObj = MENU_DATA.crusts.find(c => c.id === appState.selectedCrust);
  const crustPrice = crustObj ? crustObj.price : 0;

  // Preço do Adicional no topo
  const extraObj = MENU_DATA.extraToppings.find(e => e.id === appState.selectedExtraTop);
  const extraPrice = extraObj ? extraObj.price : 0;

  const finalPrice = basePrice + crustPrice + extraPrice;

  document.getElementById("modal-calculated-price").innerText = formatMoney(finalPrice);
  return finalPrice;
}

// Botão Adicionar Pizza ao Carrinho
function confirmAddPizzaToCart() {
  const item = appState.modalItem;
  if (!item) return;

  if (appState.isHalfAndHalf && !appState.secondFlavor) {
    alert("Por favor, selecione o 2º sabor da sua pizza meio a meio!");
    return;
  }

  const finalPrice = calculateModalPrice();
  const crustObj = MENU_DATA.crusts.find(c => c.id === appState.selectedCrust);
  const extraObj = MENU_DATA.extraToppings.find(e => e.id === appState.selectedExtraTop);

  let flavorDescription = `1x Inteira: ${item.name}`;
  if (appState.isHalfAndHalf && appState.secondFlavor) {
    flavorDescription = `1/2 ${item.name} + 1/2 ${appState.secondFlavor.name}`;
  }

  const detailsList = [];
  detailsList.push(`Tamanho: ${appState.selectedSize}`);
  if (crustObj && crustObj.price > 0) detailsList.push(crustObj.name);
  if (extraObj) detailsList.push(`Extra: ${extraObj.name}`);
  if (appState.observation.trim() !== "") detailsList.push(`Obs: "${appState.observation.trim()}"`);

  addToCart({
    id: `pizza_${Date.now()}`,
    originalId: item.id,
    name: `Pizza ${item.name} (${appState.selectedSize})`,
    category: item.category,
    type: "pizza",
    flavorDescription: flavorDescription,
    details: detailsList.join(" | "),
    unitPrice: finalPrice,
    quantity: 1,
    totalPrice: finalPrice,
    observation: appState.observation.trim()
  });

  closePizzaCustomizer();
}

function closePizzaCustomizer() {
  const modal = document.getElementById("pizza-modal");
  if (modal) modal.classList.remove("active");
  appState.modalItem = null;
}

// Gerenciamento de Carrinho
function addToCart(cartItem) {
  appState.cart.push(cartItem);
  saveCartToStorage();
  updateCartUI();
  animateCartButton();
}

function updateCartQuantity(cartItemId, delta) {
  const index = appState.cart.findIndex(i => i.id === cartItemId);
  if (index === -1) return;

  appState.cart[index].quantity += delta;
  if (appState.cart[index].quantity <= 0) {
    appState.cart.splice(index, 1);
  } else {
    appState.cart[index].totalPrice = appState.cart[index].quantity * appState.cart[index].unitPrice;
  }

  saveCartToStorage();
  updateCartUI();
  renderCartDrawerItems();
}

function getCartSubtotal() {
  return appState.cart.reduce((sum, item) => sum + item.totalPrice, 0);
}

function updateCartUI() {
  const count = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = getCartSubtotal();

  const countBadge = document.getElementById("cart-floating-count");
  const subtotalEl = document.getElementById("cart-floating-subtotal");
  const floatingBar = document.getElementById("cart-floating-bar");

  if (countBadge) countBadge.innerText = count;
  if (subtotalEl) subtotalEl.innerText = formatMoney(subtotal);

  if (floatingBar) {
    if (count > 0) {
      floatingBar.style.display = "flex";
    } else {
      floatingBar.style.display = "none";
    }
  }
}

function animateCartButton() {
  const bar = document.getElementById("cart-floating-bar");
  if (bar) {
    bar.style.transform = "translateX(-50%) scale(1.08)";
    setTimeout(() => {
      bar.style.transform = "translateX(-50%) scale(1)";
    }, 200);
  }
}

function saveCartToStorage() {
  localStorage.setItem("elieudo_cart", JSON.stringify(appState.cart));
}

function loadCartFromStorage() {
  const saved = localStorage.getItem("elieudo_cart");
  if (saved) {
    try {
      appState.cart = JSON.parse(saved);
    } catch (e) {
      appState.cart = [];
    }
  }
}

// Drawer / Modal de Checkout
function openCartDrawer() {
  renderCartDrawerItems();
  const drawer = document.getElementById("cart-drawer-modal");
  if (drawer) drawer.classList.add("active");
}

function closeCartDrawer() {
  const drawer = document.getElementById("cart-drawer-modal");
  if (drawer) drawer.classList.remove("active");
}

// ============================================================
// FRENTE 3: CUPONS DE DESCONTO NO CARRINHO
// ============================================================

function applyCartCoupon() {
  const input = document.getElementById("input-cart-coupon");
  const fb = document.getElementById("coupon-feedback-msg");
  const code = input ? input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim() : "";

  const showErr = (msg) => {
    if (fb) {
      fb.style.display = "block";
      fb.className = "error";
      fb.innerText = msg;
    }
  };

  const showSuccess = (msg) => {
    if (fb) {
      fb.style.display = "block";
      fb.className = "success";
      fb.innerText = msg;
    }
  };

  if (!code) {
    showErr("Por favor, digite o código do cupom!");
    return;
  }

  // Buscar nos cupons disponíveis (Firebase ou LocalStorage)
  let couponsList = appState.availableCoupons || [];
  if (couponsList.length === 0) {
    try {
      couponsList = JSON.parse(localStorage.getItem("elieudo_coupons_db") || "[]");
    } catch (e) {}
  }

  const found = couponsList.find(c => c.code === code);

  if (!found || !found.active) {
    showErr("❌ Cupom inválido, esgotado ou expirado.");
    return;
  }

  const subtotal = getCartSubtotal();
  if (found.minOrder && subtotal < found.minOrder) {
    showErr(`⚠️ Este cupom exige um pedido mínimo de ${formatMoney(found.minOrder)} em itens.`);
    return;
  }

  appState.appliedCoupon = found;
  showSuccess(`✅ Cupom ${found.code} aplicado com sucesso!`);
  renderCartDrawerItems();
}
window.applyCartCoupon = applyCartCoupon;

function removeCartCoupon() {
  appState.appliedCoupon = null;
  const input = document.getElementById("input-cart-coupon");
  const fb = document.getElementById("coupon-feedback-msg");
  if (input) input.value = "";
  if (fb) {
    fb.style.display = "none";
    fb.innerText = "";
  }
  renderCartDrawerItems();
}
window.removeCartCoupon = removeCartCoupon;

function revalidateAppliedCoupon() {
  if (!appState.appliedCoupon) return;
  const subtotal = getCartSubtotal();
  let couponsList = appState.availableCoupons || [];
  const current = couponsList.find(c => c.code === appState.appliedCoupon.code);

  if (!current || !current.active || (current.minOrder && subtotal < current.minOrder)) {
    appState.appliedCoupon = null;
    const fb = document.getElementById("coupon-feedback-msg");
    if (fb) {
      fb.style.display = "block";
      fb.className = "error";
      fb.innerText = "⚠️ O cupom aplicado foi removido pois não atende mais às regras.";
    }
  } else {
    appState.appliedCoupon = current;
  }
  renderCartDrawerItems();
}

function renderCartDrawerItems() {
  const container = document.getElementById("cart-items-list");
  const subtotalEl = document.getElementById("checkout-subtotal-val");
  const totalEl = document.getElementById("checkout-total-val");
  const discountRow = document.getElementById("checkout-discount-row");
  const discountValEl = document.getElementById("checkout-discount-val");
  const discountLabelEl = document.getElementById("checkout-discount-label");

  if (!container) return;

  if (appState.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <p style="font-size: 2rem; margin-bottom: 8px;">🛒</p>
        <p>Seu carrinho está vazio.</p>
        <span style="font-size: 0.85rem; color: var(--text-dim);">Escolha suas pizzas e delícias favoritas!</span>
      </div>
    `;
    if (subtotalEl) subtotalEl.innerText = formatMoney(0);
    if (totalEl) totalEl.innerText = formatMoney(0);
    if (discountRow) discountRow.style.display = "none";
    return;
  }

  container.innerHTML = appState.cart.map(item => `
    <div class="cart-drawer-item">
      <div style="flex: 1;">
        <div class="cart-item-title">${item.flavorDescription || item.name}</div>
        <div class="cart-item-details">${item.details}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
          <span style="font-weight: 700; font-size: 0.9rem;">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
        </div>
      </div>
      <div class="cart-item-price">
        ${formatMoney(item.totalPrice)}
      </div>
    </div>
  `).join("");

  const subtotal = getCartSubtotal();
  let discountAmount = 0;

  if (appState.appliedCoupon) {
    const c = appState.appliedCoupon;
    if (c.minOrder && subtotal < c.minOrder) {
      // Pedido ficou abaixo do mínimo após mudar quantidades
      appState.appliedCoupon = null;
      if (discountRow) discountRow.style.display = "none";
    } else {
      if (c.type === "percent") {
        discountAmount = (subtotal * c.value) / 100;
      } else {
        discountAmount = Math.min(subtotal, c.value);
      }
      if (discountRow) {
        discountRow.style.display = "flex";
        if (discountLabelEl) discountLabelEl.innerText = `Desconto (${c.code}):`;
        if (discountValEl) discountValEl.innerText = `- ${formatMoney(discountAmount)}`;
      }
    }
  } else {
    if (discountRow) discountRow.style.display = "none";
  }

  const finalTotal = Math.max(0, subtotal - discountAmount);

  if (subtotalEl) subtotalEl.innerText = formatMoney(subtotal);
  if (totalEl) totalEl.innerText = formatMoney(finalTotal);
}

// ============================================================
// ENVIO DO PEDIDO (FRENTE 1: CONFIRMAR E DEPOIS ENVIAR WHATSAPP)
// ============================================================

async function submitCustomerOrder() {
  // 1. Verificar se a loja está aberta
  const storeSettings = getStoreSettings();
  if (!storeSettings.isOpen) {
    alert(`A Pizzaria do Elieudo está fechada no momento para novos pedidos.\n\nHorário de atendimento:\n${storeSettings.openingHours}\n\n${storeSettings.closedMessage || ''}`);
    return;
  }

  // 2. Verificar se há itens no carrinho
  if (appState.cart.length === 0) {
    alert("Adicione pelo menos um item ao seu carrinho!");
    return;
  }

  const nameInput = document.getElementById("input-customer-name");
  const phoneInput = document.getElementById("input-customer-phone");
  const addressInput = document.getElementById("input-customer-address");
  const referenceInput = document.getElementById("input-customer-reference");
  const paymentSelect = document.getElementById("select-payment-method");
  const changeInput = document.getElementById("input-change-for");
  const submitBtn = document.getElementById("btn-submit-order");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const address = addressInput ? addressInput.value.trim() : "";
  const reference = referenceInput ? referenceInput.value.trim() : "";
  const payment = paymentSelect ? paymentSelect.value : "pix";
  const changeVal = changeInput ? changeInput.value.trim() : "";

  if (!name) {
    alert("Por favor, informe seu nome!");
    nameInput && nameInput.focus();
    return;
  }

  if (appState.deliveryType === "delivery" && !address) {
    alert("Por favor, informe o endereço para entrega (Rua, Número e Bairro)!");
    addressInput && addressInput.focus();
    return;
  }

  // Travar botão com feedback visual
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳ Registrando Pedido...</span>`;
  }

  const subtotal = getCartSubtotal();
  let discountAmount = 0;
  let couponCode = null;

  if (appState.appliedCoupon) {
    couponCode = appState.appliedCoupon.code;
    if (appState.appliedCoupon.type === "percent") {
      discountAmount = (subtotal * appState.appliedCoupon.value) / 100;
    } else {
      discountAmount = Math.min(subtotal, appState.appliedCoupon.value);
    }
  }

  const finalTotal = Math.max(0, subtotal - discountAmount);
  const orderId = `#${Math.floor(1000 + Math.random() * 9000)}`;

  let paymentText = "PIX";
  if (payment === "cartao") paymentText = "Cartão (Levar maquininha na entrega)";
  if (payment === "dinheiro") {
    paymentText = "Dinheiro";
    if (changeVal) paymentText += ` (Troco para ${changeVal})`;
  }

  // Montar mensagem para o WhatsApp
  let msg = `🍕 *PEDIDO ${orderId} - PIZZARIA DO ELIEUDO*\n`;
  msg += `-------------------------------------------\n`;
  msg += `👤 *Cliente:* ${name}\n`;
  if (phone) msg += `📱 *Telefone:* ${phone}\n`;
  msg += `🛵 *Tipo:* ${appState.deliveryType === "delivery" ? "DELIVERY (Entrega)" : "RETIRADA NO BALCÃO"}\n`;
  
  if (appState.deliveryType === "delivery") {
    msg += `📍 *Endereço:* ${address}\n`;
    if (reference) msg += `📌 *Ponto de Ref:* ${reference}\n`;
  }
  msg += `-------------------------------------------\n`;
  msg += `📋 *ITENS DO PEDIDO:*\n\n`;

  appState.cart.forEach((item, index) => {
    msg += `${index + 1}. *${item.quantity}x ${item.flavorDescription || item.name}*\n`;
    if (item.details) msg += `   ℹ️ _${item.details}_\n`;
    msg += `   💵 Valor: ${formatMoney(item.totalPrice)}\n\n`;
  });

  msg += `-------------------------------------------\n`;
  msg += `Subtotal: ${formatMoney(subtotal)}\n`;
  if (discountAmount > 0) {
    msg += `🎟️ *Cupom de Desconto:* ${couponCode} (- ${formatMoney(discountAmount)})\n`;
  }
  msg += `💰 *TOTAL A PAGAR: ${formatMoney(finalTotal)}*\n`;
  msg += `💳 *Forma de Pagamento:* ${paymentText}\n`;

  if (payment === "pix") {
    msg += `🔑 *Chave PIX da Pizzaria:* ${MENU_DATA.restaurant.pixKey}\n`;
  }

  const cleanId = orderId.replace('#', '');
  let baseUrl = window.location.href.split('?')[0].split('#')[0];
  if (!baseUrl || baseUrl.startsWith("file:") || window.location.origin === "null") {
    baseUrl = "https://romariog3fis-collab.github.io/pizzaria-do-elieudo/";
  }
  const trackingUrl = `${baseUrl}?pedido=${cleanId}`;
  msg += `🛵 *Acompanhe seu pedido em tempo real:*\n${trackingUrl}\n`;
  msg += `-------------------------------------------\n`;
  msg += `_Enviado pelo Cardápio Digital Elieudo_`;

  // Objeto estruturado do pedido
  const newOrderRecord = {
    id: orderId,
    timestamp: Date.now(),
    dateStr: new Date().toLocaleDateString('pt-BR'),
    timeStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    customer: {
      name: name,
      phone: phone,
      address: address,
      reference: reference
    },
    deliveryType: appState.deliveryType,
    paymentMethod: paymentText,
    items: JSON.parse(JSON.stringify(appState.cart)),
    subtotal: subtotal,
    discountAmount: discountAmount,
    couponCode: couponCode,
    totalPrice: finalTotal,
    status: "pendente"
  };

  // 1. Salvar no localStorage local
  try {
    const existingOrders = JSON.parse(localStorage.getItem("elieudo_orders_db") || "[]");
    existingOrders.unshift(newOrderRecord);
    localStorage.setItem("elieudo_orders_db", JSON.stringify(existingOrders));
    localStorage.setItem("elieudo_last_order_id", orderId);
  } catch (e) {
    console.error("Erro no localStorage:", e);
  }

  // 2. Salvar no Firebase em tempo real (com timeout de segurança)
  if (typeof fbSaveOrder === "function") {
    try {
      await Promise.race([
        fbSaveOrder(newOrderRecord),
        new Promise(resolve => setTimeout(resolve, 1800)) // timeout máximo de 1.8s
      ]);
    } catch (err) {
      console.error("Tentativa de envio Firebase:", err);
    }
  }

  // 3. Notificar abas abertas via BroadcastChannel
  if (window.BroadcastChannel) {
    try {
      const channel = new BroadcastChannel("elieudo_orders_bus");
      channel.postMessage({ type: "NEW_ORDER", order: newOrderRecord });
      channel.close();
    } catch (e) {}
  }

  // 4. Limpar o carrinho
  appState.cart = [];
  appState.appliedCoupon = null;
  saveCartToStorage();
  updateCartUI();

  // 5. Fechar a gaveta do carrinho
  closeCartDrawer();

  // 6. Restaurar botão
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>✅ Confirmar & Enviar Pedido</span>`;
  }

  // 7. Configurar e Exibir o Modal de Sucesso com o Botão de Chamar no WhatsApp
  const successModal = document.getElementById("order-success-modal");
  const idEl = document.getElementById("success-order-id");
  const nameEl = document.getElementById("success-customer-name");
  const totEl = document.getElementById("success-order-total");
  const waLink = document.getElementById("btn-whatsapp-success-link");

  if (idEl) idEl.innerText = orderId;
  if (nameEl) nameEl.innerText = name;
  if (totEl) totEl.innerText = formatMoney(finalTotal);

  const encodedMsg = encodeURIComponent(msg);
  // Usa api.whatsapp.com que funciona perfeitamente em mobile e desktop
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${MENU_DATA.restaurant.phone}&text=${encodedMsg}`;

  if (waLink) {
    waLink.href = whatsappUrl;
  }

  if (successModal) {
    successModal.classList.add("active");
  }
}
window.submitCustomerOrder = submitCustomerOrder;
window.submitOrderViaWhatsApp = submitCustomerOrder; // retrocompatibilidade

function dismissOrderSuccessModal() {
  const successModal = document.getElementById("order-success-modal");
  if (successModal) successModal.classList.remove("active");
}
window.dismissOrderSuccessModal = dismissOrderSuccessModal;

// Preparação e Impressão Térmica 80mm
function prepareThermalReceipt(orderId, name, phone, address, paymentText, subtotal) {
  const receiptEl = document.getElementById("thermal-receipt");
  if (!receiptEl) return;

  receiptEl.innerHTML = `
    <div class="receipt-header">
      <div class="receipt-title">${MENU_DATA.restaurant.name}</div>
      <div>DELIVERY & BALCÃO</div>
      <div>Tel: ${MENU_DATA.restaurant.phoneFormatted}</div>
      <div>${MENU_DATA.restaurant.address}</div>
      <div style="margin-top: 4px; font-weight: bold;">PEDIDO ${orderId}</div>
      <div>Data: ${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR')}</div>
    </div>
    <div class="receipt-body">
      <div><strong>CLIENTE:</strong> ${name}</div>
      ${phone ? `<div><strong>TEL:</strong> ${phone}</div>` : ""}
      <div><strong>TIPO:</strong> ${appState.deliveryType.toUpperCase()}</div>
      ${address ? `<div><strong>END:</strong> ${address}</div>` : ""}
      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      <div style="font-weight: bold; margin-bottom: 4px;">ITENS:</div>
      ${appState.cart.map(item => `
        <div class="receipt-row">
          <span>${item.quantity}x ${item.flavorDescription || item.name}</span>
          <span>${formatMoney(item.totalPrice)}</span>
        </div>
        ${item.details ? `<div style="font-size: 10px; color: #333;">>> ${item.details}</div>` : ""}
      `).join("")}
      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      <div class="receipt-total">
        <span>TOTAL:</span>
        <span>${formatMoney(subtotal)}</span>
      </div>
      <div><strong>PAGAMENTO:</strong> ${paymentText}</div>
    </div>
    <div class="receipt-footer">
      <div>Agradecemos a sua preferência!</div>
      <div>Instagram: ${MENU_DATA.restaurant.instagram}</div>
    </div>
  `;
}

function printThermalReceipt() {
  if (appState.cart.length === 0) {
    alert("Carrinho vazio!");
    return;
  }
  prepareThermalReceipt(
    `#${Math.floor(1000 + Math.random() * 9000)}`,
    document.getElementById("input-customer-name").value || "Cliente",
    document.getElementById("input-customer-phone").value || "",
    document.getElementById("input-customer-address").value || "",
    document.getElementById("select-payment-method").value || "PIX",
    getCartSubtotal()
  );
  window.print();
}

// Configuração dos Event Listeners Gerais
function setupEventListeners() {
  // Botão flutuante do carrinho
  const floatingBar = document.getElementById("cart-floating-bar");
  if (floatingBar) floatingBar.onclick = openCartDrawer;

  // Fechar modais
  document.getElementById("btn-close-pizza-modal").onclick = closePizzaCustomizer;
  document.getElementById("btn-close-cart-drawer").onclick = closeCartDrawer;

  // Confirmar adição de pizza
  document.getElementById("btn-modal-add-cart").onclick = confirmAddPizzaToCart;

  // Tipo de Entrega (Delivery vs Balcão)
  const tabDelivery = document.getElementById("tab-type-delivery");
  const tabBalcao = document.getElementById("tab-type-balcao");
  const addressGroup = document.getElementById("delivery-address-group");

  if (tabDelivery && tabBalcao) {
    tabDelivery.onclick = () => {
      appState.deliveryType = "delivery";
      tabDelivery.classList.add("active");
      tabBalcao.classList.remove("active");
      if (addressGroup) addressGroup.style.display = "block";
    };
    tabBalcao.onclick = () => {
      appState.deliveryType = "balcao";
      tabBalcao.classList.add("active");
      tabDelivery.classList.remove("active");
      if (addressGroup) addressGroup.style.display = "none";
    };
  }

  // Troco para dinheiro
  const paymentSelect = document.getElementById("select-payment-method");
  const changeGroup = document.getElementById("change-input-group");
  if (paymentSelect && changeGroup) {
    paymentSelect.onchange = (e) => {
      if (e.target.value === "dinheiro") {
        changeGroup.style.display = "block";
      } else {
        changeGroup.style.display = "none";
      }
    };
  }

  // Finalizar WhatsApp
  const btnCheckout = document.getElementById("btn-submit-whatsapp");
  if (btnCheckout) btnCheckout.onclick = submitOrderViaWhatsApp;

  // Imprimir Pedido (se presente, ex: em painel operacional)
  const btnPrint = document.getElementById("btn-print-receipt");
  if (btnPrint) btnPrint.onclick = printThermalReceipt;
}

// ==========================================================================
// MÓDULO DE RASTREAMENTO DE PEDIDO EM TEMPO REAL (ORDER TRACKING)
// ==========================================================================

let activeTrackingUnsubscribe = null;
let currentTrackingOrderId = null;

function initOrderTracking() {
  // 1. Checa se veio parâmetro de URL (ex: ?pedido=1264 ou ?tracking=1264)
  const params = new URLSearchParams(window.location.search);
  const orderParam = params.get("pedido") || params.get("tracking") || params.get("order");

  if (orderParam) {
    const cleanId = orderParam.replace(/^#/, "").replace(/^ord_/, "").trim();
    try {
      localStorage.setItem("elieudo_last_order_id", "#" + cleanId);
    } catch (e) {}
    // Abre direto o modal com o pedido especificado
    setTimeout(() => {
      openOrderTrackingModal(cleanId);
    }, 150);
  } else {
    // Checa se há pedido ativo salvo para exibir a barra flutuante
    checkActiveOrderBanner();
  }

  // 2. Ouve eventos locais para atualizar a barra flutuante em tempo real
  if (window.BroadcastChannel) {
    try {
      const channel = new BroadcastChannel("elieudo_orders_bus");
      channel.onmessage = (evt) => {
        if (evt.data && evt.data.type === "ORDER_STATUS_CHANGED") {
          checkActiveOrderBanner();
        }
      };
    } catch (e) {}
  }

  window.addEventListener("storage", (e) => {
    if (e.key === "elieudo_orders_db" || e.key === "elieudo_last_order_id") {
      checkActiveOrderBanner();
    }
  });
}

/**
 * Abre o rastreamento a partir do modal de sucesso pós-pedido
 */
function openOrderTrackingFromSuccess() {
  const lastId = localStorage.getItem("elieudo_last_order_id");
  dismissOrderSuccessModal();
  openOrderTrackingModal(lastId);
}
window.openOrderTrackingFromSuccess = openOrderTrackingFromSuccess;

/**
 * Abre o Modal de Rastreamento de Pedido
 */
function openOrderTrackingModal(rawOrderId) {
  const modal = document.getElementById("order-tracking-modal");
  const inputEl = document.getElementById("track-order-input");
  if (!modal) return;

  // Cancela ouvinte anterior se houver
  if (typeof activeTrackingUnsubscribe === "function") {
    activeTrackingUnsubscribe();
    activeTrackingUnsubscribe = null;
  }

  let orderId = rawOrderId || localStorage.getItem("elieudo_last_order_id");

  modal.classList.add("active");

  if (orderId) {
    const cleanId = orderId.toString().replace(/^#/, "").replace(/^ord_/, "").trim();
    if (inputEl) inputEl.value = "#" + cleanId;
    currentTrackingOrderId = "#" + cleanId;

    renderTrackingLoading();

    // Inicia ouvinte em tempo real no Firebase + local
    if (typeof fbListenSingleOrder === "function") {
      activeTrackingUnsubscribe = fbListenSingleOrder(cleanId, (orderData) => {
        if (orderData) {
          renderOrderTrackingUI(orderData);
          checkActiveOrderBanner();
        } else {
          renderTrackingNotFound(cleanId);
        }
      });
    } else {
      // Fallback buscando direto
      if (typeof fbGetOrderById === "function") {
        fbGetOrderById(cleanId).then((orderData) => {
          if (orderData) renderOrderTrackingUI(orderData);
          else renderTrackingNotFound(cleanId);
        });
      }
    }
  } else {
    // Sem pedido recente, exibe formulário de busca
    if (inputEl) inputEl.value = "";
    renderTrackingEmptySearch();
  }
}
window.openOrderTrackingModal = openOrderTrackingModal;

/**
 * Fecha o modal de rastreamento
 */
function closeOrderTrackingModal() {
  const modal = document.getElementById("order-tracking-modal");
  if (modal) modal.classList.remove("active");

  if (typeof activeTrackingUnsubscribe === "function") {
    activeTrackingUnsubscribe();
    activeTrackingUnsubscribe = null;
  }
}
window.closeOrderTrackingModal = closeOrderTrackingModal;

/**
 * Busca pelo input do usuário
 */
function trackOrderByInput() {
  const input = document.getElementById("track-order-input");
  if (!input || !input.value.trim()) {
    alert("Por favor, digite o número do pedido (ex: 1264).");
    return;
  }
  openOrderTrackingModal(input.value.trim());
}
window.trackOrderByInput = trackOrderByInput;

/**
 * Renderiza estado de carregando
 */
function renderTrackingLoading() {
  const container = document.getElementById("tracking-main-content");
  if (!container) return;
  container.innerHTML = `
    <div class="tracking-loading-state">
      <div class="tracking-spinner"></div>
      <p>Localizando informações do seu pedido...</p>
    </div>
  `;
}

/**
 * Renderiza estado vazio para digitar código
 */
function renderTrackingEmptySearch() {
  const container = document.getElementById("tracking-main-content");
  if (!container) return;
  container.innerHTML = `
    <div class="tracking-empty-state">
      <div class="tracking-empty-icon">🔍</div>
      <h3>Digite o código do seu pedido</h3>
      <p>Digite o número do seu pedido acima (ex: 1264) para acompanhar a preparação e entrega em tempo real.</p>
    </div>
  `;
}

/**
 * Renderiza estado de pedido não encontrado
 */
function renderTrackingNotFound(searchedId) {
  const container = document.getElementById("tracking-main-content");
  if (!container) return;
  container.innerHTML = `
    <div class="tracking-empty-state">
      <div class="tracking-empty-icon">❓</div>
      <h3>Pedido #${searchedId} não encontrado</h3>
      <p>Verifique se digitou o número corretamente ou clique abaixo para falar diretamente com nossa equipe no WhatsApp.</p>
      <a href="https://api.whatsapp.com/send?phone=${MENU_DATA.restaurant.phone}&text=${encodeURIComponent(`Olá! Preciso de ajuda para localizar meu pedido #${searchedId}`)}" target="_blank" class="btn-tracking-whatsapp">
        <span>📲 Falar no WhatsApp da Pizzaria</span>
      </a>
    </div>
  `;
}

/**
 * Renderiza a interface do Pedido e o Stepper das 4 Etapas
 */
function renderOrderTrackingUI(order) {
  const container = document.getElementById("tracking-main-content");
  if (!container || !order) return;

  const st = (order.status || "pendente").toLowerCase();
  const isDelivery = order.deliveryType !== "balcao";

  // Mapeamento das 4 etapas
  // 1: pendente, 2: preparando, 3: entrega, 4: finalizado
  let activeStepNum = 1;
  let currentStatusBadge = {
    title: "Pedido Recebido",
    desc: "Seu pedido foi registrado e aguarda confirmação e entrada no forno.",
    icon: "📋",
    colorClass: "status-pendente"
  };

  if (st === "preparando") {
    activeStepNum = 2;
    currentStatusBadge = {
      title: "No Forno / Cozinha",
      desc: "O pizzaiolo já está montando e assando suas pizzas no forno a lenha quentinho!",
      icon: "🔥",
      colorClass: "status-preparando"
    };
  } else if (st === "entrega") {
    activeStepNum = 3;
    if (isDelivery) {
      currentStatusBadge = {
        title: "Saiu para Entrega!",
        desc: "O motoboy já recolheu sua pizza e está em rota para o seu endereço.",
        icon: "🛵",
        colorClass: "status-entrega"
      };
    } else {
      currentStatusBadge = {
        title: "Pronto para Retirada no Balcão!",
        desc: "Sua pizza está pronta e quentinha aguardando sua retirada no balcão da pizzaria.",
        icon: "🏪",
        colorClass: "status-balcao"
      };
    }
  } else if (st === "finalizado") {
    activeStepNum = 4;
    currentStatusBadge = {
      title: "Pedido Concluído!",
      desc: "Pedido finalizado com sucesso. Muito obrigado pela preferência e bom apetite!",
      icon: "🎉",
      colorClass: "status-finalizado"
    };
  }

  // Progresso da linha conectora: 1->0%, 2->33.3%, 3->66.6%, 4->100%
  const progressPercent = Math.min(100, Math.round(((activeStepNum - 1) / 3) * 100));

  // WhatsApp de suporte pré-configurado
  const whatsappHelpUrl = `https://api.whatsapp.com/send?phone=${MENU_DATA.restaurant.phone}&text=${encodeURIComponent(`Olá! Gostaria de informações sobre o meu pedido ${order.id}.`)}`;

  container.innerHTML = `
    <!-- Card do Status Atual com Animação -->
    <div class="tracking-current-status-card ${currentStatusBadge.colorClass}">
      <div class="tracking-status-icon-wrap">
        <span class="tracking-status-large-icon">${currentStatusBadge.icon}</span>
      </div>
      <div class="tracking-status-info">
        <span class="tracking-step-indicator">ETAPA ${activeStepNum} DE 4</span>
        <h3 class="tracking-status-title">${currentStatusBadge.title}</h3>
        <p class="tracking-status-desc">${currentStatusBadge.desc}</p>
      </div>
    </div>

    <!-- Stepper Visual Interativo (Linha de Tempo) -->
    <div class="tracking-stepper-box">
      <div class="tracking-stepper-line-bg">
        <div class="tracking-stepper-line-fill" style="width: ${progressPercent}%;"></div>
      </div>
      <div class="tracking-steps-row">
        
        <!-- Passo 1: Recebido -->
        <div class="tracking-step-node ${activeStepNum >= 1 ? 'completed' : ''} ${activeStepNum === 1 ? 'current' : ''}">
          <div class="step-circle">
            ${activeStepNum > 1 ? '✓' : '1'}
          </div>
          <span class="step-label">Recebido</span>
        </div>

        <!-- Passo 2: No Forno -->
        <div class="tracking-step-node ${activeStepNum >= 2 ? 'completed' : ''} ${activeStepNum === 2 ? 'current' : ''}">
          <div class="step-circle">
            ${activeStepNum > 2 ? '✓' : '2'}
          </div>
          <span class="step-label">No Forno</span>
        </div>

        <!-- Passo 3: Em Rota / Pronto -->
        <div class="tracking-step-node ${activeStepNum >= 3 ? 'completed' : ''} ${activeStepNum === 3 ? 'current' : ''}">
          <div class="step-circle">
            ${activeStepNum > 3 ? '✓' : '3'}
          </div>
          <span class="step-label">${isDelivery ? 'A Caminho' : 'Balcão'}</span>
        </div>

        <!-- Passo 4: Entregue -->
        <div class="tracking-step-node ${activeStepNum >= 4 ? 'completed' : ''} ${activeStepNum === 4 ? 'current' : ''}">
          <div class="step-circle">
            ${activeStepNum >= 4 ? '✓' : '4'}
          </div>
          <span class="step-label">Entregue</span>
        </div>

      </div>
    </div>

    <!-- Resumo dos Dados do Pedido -->
    <div class="tracking-details-card">
      <div class="tracking-details-header">
        <div>
          <span class="tracking-order-badge">${order.id}</span>
          <span class="tracking-time-badge">🕒 ${order.timeStr || ''}</span>
        </div>
        <span class="tracking-type-badge ${isDelivery ? 'badge-delivery' : 'badge-balcao'}">
          ${isDelivery ? '🛵 Entrega' : '🏪 Balcão'}
        </span>
      </div>

      <div class="tracking-customer-box">
        <div class="customer-row"><strong>Cliente:</strong> <span>${(order.customer && order.customer.name) || 'Cliente'}</span></div>
        ${order.customer && order.customer.phone ? `<div class="customer-row"><strong>Telefone:</strong> <span>${order.customer.phone}</span></div>` : ''}
        ${isDelivery && order.customer && order.customer.address ? `<div class="customer-row"><strong>Endereço:</strong> <span>📍 ${order.customer.address}</span></div>` : ''}
        ${isDelivery && order.customer && order.customer.reference ? `<div class="customer-row"><strong>Ponto de Ref:</strong> <span>📌 ${order.customer.reference}</span></div>` : ''}
        <div class="customer-row"><strong>Pagamento:</strong> <span>${order.paymentMethod || 'A combinar'}</span></div>
      </div>

      <div class="tracking-items-summary">
        <div class="tracking-items-title">Itens do Pedido:</div>
        <div class="tracking-items-list">
          ${(order.items || []).map(item => `
            <div class="tracking-item-row">
              <span class="tracking-item-qty">${item.quantity}x</span>
              <div class="tracking-item-name">
                <div>${item.flavorDescription || item.name}</div>
                ${item.details ? `<div class="tracking-item-sub">${item.details}</div>` : ''}
              </div>
              <span class="tracking-item-price">${formatMoney(item.totalPrice)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="tracking-total-row">
        <span>Total:</span>
        <strong>${formatMoney(order.totalPrice || order.subtotal || 0)}</strong>
      </div>
    </div>

    <!-- Ações de Suporte e Recarregamento -->
    <div class="tracking-actions-footer">
      <a href="${whatsappHelpUrl}" target="_blank" class="btn-tracking-whatsapp">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/></svg>
        <span>Falar com a Pizzaria</span>
      </a>
      <button type="button" class="btn-tracking-refresh" onclick="openOrderTrackingModal('${order.id}')" title="Atualizar dados agora">
        <span>🔄 Atualizar</span>
      </button>
    </div>
  `;
}

/**
 * Verifica se existe pedido em andamento e atualiza a barra flutuante
 */
function checkActiveOrderBanner() {
  const banner = document.getElementById("active-order-floating-banner");
  if (!banner) return;

  const lastOrderId = localStorage.getItem("elieudo_last_order_id");
  if (!lastOrderId) {
    banner.style.display = "none";
    return;
  }

  const cleanId = lastOrderId.replace(/^#/, "").replace(/^ord_/, "").trim();

  if (typeof fbGetOrderById === "function") {
    fbGetOrderById(cleanId).then((ord) => {
      if (!ord || ord.status === "finalizado") {
        banner.style.display = "none";
        return;
      }

      // Pedido ativo em andamento!
      const iconEl = document.getElementById("floating-banner-icon");
      const idEl = document.getElementById("floating-banner-order-id");
      const descEl = document.getElementById("floating-banner-status-desc");

      if (idEl) idEl.innerText = ord.id || ("#" + cleanId);

      let icon = "📋";
      let desc = "Recebido / Na fila";
      if (ord.status === "preparando") {
        icon = "🔥";
        desc = "No Forno / Preparando";
      } else if (ord.status === "entrega") {
        icon = ord.deliveryType === "balcao" ? "🏪" : "🛵";
        desc = ord.deliveryType === "balcao" ? "Pronto no Balcão!" : "Saiu para Entrega!";
      }

      if (iconEl) iconEl.innerText = icon;
      if (descEl) descEl.innerText = desc;

      banner.style.display = "block";
    });
  }
}
window.checkActiveOrderBanner = checkActiveOrderBanner;

// ========================================================
// FRENTE 2: COMANDA DIGITAL PRIVADA DA MESA (QR CODE CLIENTE)
// ========================================================

appState.activeClientTable = null;
window._autoOpenTableModalPending = false;

function initClientTableTracking() {
  const urlParams = new URLSearchParams(window.location.search);
  let mesaParam = urlParams.get("mesa");
  let tokenParam = urlParams.get("token");

  // Se veio parâmetro mesa na URL, o cliente acabou de escanear o QR Code!
  if (mesaParam) {
    window._autoOpenTableModalPending = true;
    try {
      sessionStorage.setItem("elieudo_client_mesa", mesaParam.trim());
      if (tokenParam) {
        sessionStorage.setItem("elieudo_client_token", tokenParam.trim());
      }
    } catch (e) {}
  } else {
    // Se não veio na URL, tenta recuperar da sessão ativa nesta aba
    try {
      mesaParam = sessionStorage.getItem("elieudo_client_mesa");
      tokenParam = sessionStorage.getItem("elieudo_client_token");
    } catch (e) {}
  }

  if (!mesaParam) return;

  const cleanMesa = parseInt(mesaParam, 10);
  if (isNaN(cleanMesa) || cleanMesa <= 0) return;

  const listenFn = window.fbListenSingleTableWithToken || (typeof fbListenSingleTableWithToken === "function" ? fbListenSingleTableWithToken : null);
  if (listenFn) {
    listenFn(cleanMesa, tokenParam, onClientTableDataReceived);
  }
}

function onClientTableDataReceived(res) {
  const topBar = document.getElementById("table-client-top-bar");
  const modal = document.getElementById("client-table-modal");
  const btnTrack = document.getElementById("btn-header-track");

  if (res && res.authorized && res.table && res.table.currentSession) {
    appState.activeClientTable = res.table;

    // Salva token da sessão caso tenha vindo na resposta
    if (res.sessionToken) {
      try {
        sessionStorage.setItem("elieudo_client_token", res.sessionToken);
      } catch (e) {}
    }

    const num = res.table.number;
    const numStr = num < 10 ? '0' + num : num;
    const total = res.table.currentSession.total || res.table.currentSession.subtotal || 0;

    // Atualizar Barra Superior Fixa
    if (topBar) {
      const numEl = document.getElementById("table-bar-num");
      const subEl = document.getElementById("table-bar-parcial");
      if (numEl) numEl.innerText = `🍽️ Mesa ${numStr}`;
      if (subEl) subEl.innerText = `Parcial: ${formatMoney(total)}`;
      topBar.style.display = "flex";
    }

    // Atualizar Botão do Cabeçalho para refletir a mesa conectada
    if (btnTrack) {
      btnTrack.innerHTML = `<span>🍽️ Mesa ${numStr} • Ver Comanda</span>`;
      btnTrack.classList.add("table-mode");
      btnTrack.title = "Toque para ver a comanda ao vivo da sua mesa";
    }

    // Atualiza conteúdo interno da comanda
    renderClientTableDetails();

    // Se acabou de escanear o QR Code, ABRE AUTOMATICAMENTE NA HORA!
    if (window._autoOpenTableModalPending) {
      window._autoOpenTableModalPending = false;
      setTimeout(() => {
        openClientTableModal();
      }, 100);
    }
  } else if (res && res.error === "closed") {
    // Mesa fechada ou ainda não aberta no salão
    const num = res.tableNum || (res.table && res.table.number);
    if (window._autoOpenTableModalPending && num) {
      window._autoOpenTableModalPending = false;
      showTableWaitingOpenModal(num);
    }
  } else if (res && res.error === "invalid_token") {
    if (topBar) topBar.style.display = "none";
    if (modal) modal.classList.remove("active");
    try {
      sessionStorage.removeItem("elieudo_client_mesa");
      sessionStorage.removeItem("elieudo_client_token");
    } catch (e) {}
    alert("Esta comanda não está mais ativa ou o QR Code expirou. Por favor, solicite um novo QR Code ao garçom.");
  }
}

function showTableWaitingOpenModal(tableNum) {
  const modal = document.getElementById("client-table-modal");
  if (!modal) return;

  const cleanNum = parseInt(tableNum, 10) || 1;
  const numStr = cleanNum < 10 ? '0' + cleanNum : cleanNum;

  const titleEl = document.getElementById("client-modal-title");
  const subEl = document.getElementById("client-modal-subtitle");
  const totalEl = document.getElementById("client-bill-total");
  const roundsContainer = document.getElementById("client-rounds-container");

  if (titleEl) titleEl.innerText = `Mesa ${numStr}`;
  if (subEl) subEl.innerText = `Aguardando abertura no salão`;
  if (totalEl) totalEl.innerText = `R$ 0,00`;

  if (roundsContainer) {
    roundsContainer.innerHTML = `
      <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.35); border-radius: 12px; padding: 22px 16px; text-align: center;">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">🍽️</div>
        <h3 style="font-size: 1rem; color: #fbbf24; margin: 0 0 6px 0;">Mesa ${numStr} • Aguardando Atendimento</h3>
        <p style="font-size: 0.82rem; color: #cbd5e1; margin: 0 0 16px 0; line-height: 1.4;">
          Esta mesa ainda não foi aberta no salão. Peça ao garçom para iniciar seu atendimento ou toque no botão abaixo!
        </p>
        <button type="button" class="btn-client-call" style="width: 100%; max-width: 260px; margin: 0 auto; display: inline-flex; justify-content: center; align-items: center; gap: 8px; padding: 10px 16px;" onclick="clientCallWaiterQuick(${cleanNum})">
          <span>🙋‍♂️ Chamar Garçom para Abrir Mesa</span>
        </button>
      </div>
    `;
  }

  modal.classList.add("active");
}
window.showTableWaitingOpenModal = showTableWaitingOpenModal;

async function clientCallWaiterQuick(num) {
  try {
    if (typeof fbCallWaiter === "function") {
      await fbCallWaiter(num, true);
    }
    alert(`🙋‍♂️ Garçom chamado para a Mesa ${num < 10 ? '0' + num : num}! O atendente já virá até sua mesa.`);
  } catch (e) {
    console.error(e);
  }
}
window.clientCallWaiterQuick = clientCallWaiterQuick;

// Ação centralizada inteligente do botão de rastreamento do cabeçalho
function handleHeaderTrackClick() {
  // 1. Se estiver conectado a uma mesa ativa do salão
  if (appState.activeClientTable && appState.activeClientTable.currentSession) {
    openClientTableModal();
    return;
  }

  // 2. Se houver número de mesa salva na sessão
  const savedMesa = sessionStorage.getItem("elieudo_client_mesa");
  if (savedMesa) {
    if (appState.activeClientTable && appState.activeClientTable.currentSession) {
      openClientTableModal();
      return;
    } else {
      showTableWaitingOpenModal(savedMesa);
      return;
    }
  }

  // 3. Se houver pedido recente de delivery/balcão salvo
  const lastOrderId = localStorage.getItem("elieudo_last_order_id");
  if (lastOrderId) {
    openOrderTrackingModal(lastOrderId);
    return;
  }

  // 4. Se não tem nada ativo, abre busca normal para digitar o código
  openOrderTrackingModal();
}
window.handleHeaderTrackClick = handleHeaderTrackClick;

function openClientTableModal() {
  if (!appState.activeClientTable) {
    const savedMesa = sessionStorage.getItem("elieudo_client_mesa");
    if (savedMesa) {
      showTableWaitingOpenModal(savedMesa);
      return;
    }
    alert("Nenhuma mesa conectada no momento.");
    return;
  }
  renderClientTableDetails();
  const modal = document.getElementById("client-table-modal");
  if (modal) modal.classList.add("active");
}
window.openClientTableModal = openClientTableModal;

function closeClientTableModal() {
  const modal = document.getElementById("client-table-modal");
  if (modal) modal.classList.remove("active");
}
window.closeClientTableModal = closeClientTableModal;

function renderClientTableDetails() {
  const table = appState.activeClientTable;
  if (!table || !table.currentSession) return;

  const session = table.currentSession;
  const num = table.number;

  const titleEl = document.getElementById("client-modal-title");
  const subEl = document.getElementById("client-modal-subtitle");
  const totalEl = document.getElementById("client-bill-total");
  const roundsContainer = document.getElementById("client-rounds-container");

  if (titleEl) titleEl.innerText = `Mesa ${num < 10 ? '0' + num : num} • ${session.customerName || 'Cliente'}`;
  if (subEl) subEl.innerText = `Aberta às ${session.openedTimeStr || '--:--'} • Atendida por ${session.waiterName || 'Salão'}`;
  if (totalEl) totalEl.innerText = formatMoney(session.total || session.subtotal || 0);

  // Avisos de Garçom ou Conta
  const callMsg = document.getElementById("client-waiter-called-msg");
  const billMsg = document.getElementById("client-bill-requested-msg");
  if (callMsg) callMsg.style.display = table.callWaiter ? "block" : "none";
  if (billMsg) billMsg.style.display = table.status === "aguardando_conta" ? "block" : "none";

  if (!roundsContainer) return;
  roundsContainer.innerHTML = "";

  const rounds = session.rounds || [];
  if (rounds.length === 0) {
    roundsContainer.innerHTML = `
      <div style="background: #11151e; border: 1px dashed var(--border-subtle); border-radius: 12px; padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Seus pedidos foram abertos! O garçom está anotando os itens e eles aparecerão aqui em tempo real.
      </div>
    `;
    return;
  }

  rounds.forEach(r => {
    const card = document.createElement("div");
    card.className = "client-round-card";

    let statusText = "📋 Recebido na Cozinha";
    if (r.status === "preparando") statusText = "🔥 No Forno a Lenha";
    else if (r.status === "finalizado") statusText = "✅ Entregue na Mesa";

    card.innerHTML = `
      <div class="client-round-head">
        <span>${r.roundNumber}ª Rodada (${r.timeStr})</span>
        <span>${statusText}</span>
      </div>
      <div>
        ${(r.items || []).map(it => `
          <div class="client-item-row">
            <div>
              <div class="client-item-desc"><strong>${it.quantity}x</strong> ${it.flavorDescription || it.name}</div>
              ${it.details ? `<div class="client-item-details">${it.details}</div>` : ''}
            </div>
            <div class="client-item-price">${formatMoney(it.totalPrice || (it.unitPrice * it.quantity))}</div>
          </div>
        `).join('')}
      </div>
    `;

    roundsContainer.appendChild(card);
  });
}

async function clientCallWaiter() {
  if (!appState.activeClientTable) return;
  const num = appState.activeClientTable.number;

  const btnTop = document.getElementById("btn-bar-call-waiter");
  const btnModal = document.getElementById("btn-modal-call-waiter");
  if (btnTop) btnTop.innerText = "⏳ Chamando...";
  if (btnModal) btnModal.innerText = "⏳ Chamando...";

  try {
    if (typeof fbCallWaiter === "function") {
      await fbCallWaiter(num, true);
    }
    const callMsg = document.getElementById("client-waiter-called-msg");
    if (callMsg) callMsg.style.display = "block";
    alert("🙋‍♂️ Garçom chamado com sucesso! Um atendente virá à sua mesa.");
  } catch (e) {
    console.error("Erro ao chamar garçom:", e);
  } finally {
    if (btnTop) btnTop.innerHTML = `<span>🙋‍♂️ Garçom</span>`;
    if (btnModal) btnModal.innerHTML = `<span>🙋‍♂️ Chamar Garçom</span>`;
  }
}
window.clientCallWaiter = clientCallWaiter;

async function clientRequestBill() {
  if (!appState.activeClientTable) return;
  const num = appState.activeClientTable.number;

  if (!confirm("Deseja solicitar a conta da sua mesa ao garçom?")) return;

  const btnModal = document.getElementById("btn-modal-request-bill");
  if (btnModal) btnModal.innerText = "⏳ Solicitando...";

  try {
    if (typeof fbRequestBill === "function") {
      await fbRequestBill(num);
    }
    const billMsg = document.getElementById("client-bill-requested-msg");
    if (billMsg) billMsg.style.display = "block";
    alert("🧾 Conta solicitada! O garçom já foi avisado e trará a conferência/maquineta até a sua mesa.");
  } catch (e) {
    console.error("Erro ao solicitar conta:", e);
  } finally {
    if (btnModal) btnModal.innerHTML = `<span>🧾 Pedir a Conta</span>`;
  }
}
window.clientRequestBill = clientRequestBill;

