/**
 * Configuração e Camada de Sincronização em Tempo Real (Firebase & Fallback Local)
 * Pizzaria do Elieudo
 */

// Chave para armazenar credenciais do Firebase no navegador do administrador
const FB_STORAGE_KEY = "elieudo_firebase_config";
const FB_IMAGES_STORAGE_KEY = "elieudo_custom_images";

// Configuração padrão: se preenchida diretamente aqui ou salva via painel admin
let firebaseConfig = null;

try {
  const savedConfig = localStorage.getItem(FB_STORAGE_KEY);
  if (savedConfig) {
    firebaseConfig = JSON.parse(savedConfig);
  }
} catch (e) {
  console.warn("Nenhuma configuração prévia do Firebase encontrada no armazenamento local.");
}

// Objeto de controle de inicialização
let fbApp = null;
let fbDb = null;
let isFirebaseReady = false;

// Inicializa Firebase se configuração estiver disponível
function initFirebase() {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL && window.firebase) {
    try {
      if (!firebase.apps.length) {
        fbApp = firebase.initializeApp(firebaseConfig);
      } else {
        fbApp = firebase.app();
      }
      fbDb = firebase.database();
      isFirebaseReady = true;
      console.log("🔥 Firebase Realtime Database conectado com sucesso!");
    } catch (err) {
      console.error("Falha ao inicializar Firebase:", err);
      isFirebaseReady = false;
    }
  } else {
    isFirebaseReady = false;
  }
  return isFirebaseReady;
}

// Inicializar na carga inicial
if (window.firebase) {
  initFirebase();
}

/**
 * Salvar e testar nova configuração do Firebase
 */
function fbSaveFirebaseConfig(configObj) {
  try {
    localStorage.setItem(FB_STORAGE_KEY, JSON.stringify(configObj));
    firebaseConfig = configObj;
    return initFirebase();
  } catch (e) {
    console.error("Erro ao salvar configuração do Firebase:", e);
    return false;
  }
}

function fbGetFirebaseConfig() {
  return firebaseConfig;
}

function fbIsConnected() {
  return isFirebaseReady && fbDb !== null;
}

// ==========================================
// MÉTODOS DE PEDIDOS (ORDERS)
// ==========================================

/**
 * Salvar novo pedido (Cliente -> Nuvem / Local)
 */
function fbSaveOrder(order) {
  return new Promise((resolve) => {
    // 1. Sempre salva no localStorage como garantia offline
    try {
      const existing = JSON.parse(localStorage.getItem("elieudo_orders_db") || "[]");
      // Evita duplicar se já existir o ID
      if (!existing.some(o => o.id === order.id)) {
        existing.unshift(order);
        localStorage.setItem("elieudo_orders_db", JSON.stringify(existing));
      }
    } catch (e) {
      console.error("Erro no fallback localStorage:", e);
    }

    // 2. Se Firebase estiver ativo, envia para a nuvem
    if (isFirebaseReady && fbDb) {
      const orderRef = fbDb.ref("orders/" + order.id.replace("#", "ord_"));
      orderRef.set(order)
        .then(() => resolve(true))
        .catch((err) => {
          console.error("Erro ao salvar no Firebase:", err);
          resolve(false);
        });
    } else {
      resolve(true);
    }
  });
}

/**
 * Ouvir pedidos em tempo real (Painel Admin)
 */
function fbListenOrders(onOrdersUpdated, onNewOrderArrived) {
  // Se Firebase estiver ativo, escuta alterações na nuvem
  if (isFirebaseReady && fbDb) {
    const ordersRef = fbDb.ref("orders");
    let initialLoadDone = false;

    // Escuta todos os pedidos
    ordersRef.on("value", (snapshot) => {
      const val = snapshot.val();
      const list = [];
      if (val) {
        Object.keys(val).forEach((key) => {
          list.push(val[key]);
        });
        // Ordena por timestamp decrescente
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
      // Atualiza também cache local
      try {
        localStorage.setItem("elieudo_orders_db", JSON.stringify(list));
      } catch (e) {}

      if (typeof onOrdersUpdated === "function") {
        onOrdersUpdated(list);
      }
      initialLoadDone = true;
    });

    // Notificação sonora apenas para pedidos que chegam após o carregamento inicial
    ordersRef.on("child_added", (snapshot) => {
      if (initialLoadDone) {
        const newOrder = snapshot.val();
        if (typeof onNewOrderArrived === "function" && newOrder) {
          onNewOrderArrived(newOrder);
        }
      }
    });

  } else {
    // Modo Local: Lê do localStorage e usa BroadcastChannel
    try {
      const raw = localStorage.getItem("elieudo_orders_db");
      const list = raw ? JSON.parse(raw) : [];
      if (typeof onOrdersUpdated === "function") {
        onOrdersUpdated(list);
      }
    } catch (e) {}

    if (window.BroadcastChannel) {
      const channel = new BroadcastChannel("elieudo_orders_bus");
      channel.onmessage = (evt) => {
        if (evt.data && evt.data.type === "NEW_ORDER") {
          if (typeof onNewOrderArrived === "function") {
            onNewOrderArrived(evt.data.order);
          }
          try {
            const raw = localStorage.getItem("elieudo_orders_db");
            const list = raw ? JSON.parse(raw) : [];
            if (typeof onOrdersUpdated === "function") {
              onOrdersUpdated(list);
            }
          } catch (e) {}
        }
      };
    }
  }
}

/**
 * Atualizar status do pedido (Pendente -> Preparando -> Entrega -> Finalizado)
 */
function fbUpdateOrderStatus(orderId, newStatus) {
  // Atualiza no cache local
  try {
    const raw = localStorage.getItem("elieudo_orders_db");
    const list = raw ? JSON.parse(raw) : [];
    const item = list.find(o => o.id === orderId);
    if (item) {
      item.status = newStatus;
      localStorage.setItem("elieudo_orders_db", JSON.stringify(list));
    }
  } catch (e) {}

  // Atualiza no Firebase se conectado
  if (isFirebaseReady && fbDb) {
    const safeKey = orderId.replace("#", "ord_");
    return fbDb.ref(`orders/${safeKey}/status`).set(newStatus);
  }
  return Promise.resolve();
}

/**
 * Limpar todos os pedidos (Admin)
 */
function fbClearAllOrders() {
  localStorage.setItem("elieudo_orders_db", JSON.stringify([]));
  if (isFirebaseReady && fbDb) {
    return fbDb.ref("orders").remove();
  }
  return Promise.resolve();
}

// ==========================================
// MÉTODOS DE FOTOS PERSONALIZADAS DOS PRODUTOS
// ==========================================

/**
 * Salvar imagem personalizada de um item
 */
function fbSaveItemImage(itemId, imageDataUrl) {
  // Salva no cache local
  let current = {};
  try {
    current = JSON.parse(localStorage.getItem(FB_IMAGES_STORAGE_KEY) || "{}");
  } catch (e) {}
  current[itemId] = imageDataUrl;
  try {
    localStorage.setItem(FB_IMAGES_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn("Storage local cheio ou bloqueado:", e);
  }

  // Salva no Firebase
  if (isFirebaseReady && fbDb) {
    return fbDb.ref(`custom_images/${itemId}`).set(imageDataUrl);
  }
  return Promise.resolve();
}

/**
 * Remover imagem personalizada de um item (volta ao padrão)
 */
function fbRemoveItemImage(itemId) {
  let current = {};
  try {
    current = JSON.parse(localStorage.getItem(FB_IMAGES_STORAGE_KEY) || "{}");
    delete current[itemId];
    localStorage.setItem(FB_IMAGES_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {}

  if (isFirebaseReady && fbDb) {
    return fbDb.ref(`custom_images/${itemId}`).remove();
  }
  return Promise.resolve();
}

/**
 * Obter e escutar fotos personalizadas
 */
function fbListenItemImages(onImagesUpdated) {
  // Carrega imediatamente do cache local para resposta instantânea
  try {
    const localImages = JSON.parse(localStorage.getItem(FB_IMAGES_STORAGE_KEY) || "{}");
    if (Object.keys(localImages).length > 0 && typeof onImagesUpdated === "function") {
      onImagesUpdated(localImages);
    }
  } catch (e) {}

  // Se conectado ao Firebase, escuta alterações remotas
  if (isFirebaseReady && fbDb) {
    fbDb.ref("custom_images").on("value", (snapshot) => {
      const val = snapshot.val() || {};
      try {
        localStorage.setItem(FB_IMAGES_STORAGE_KEY, JSON.stringify(val));
      } catch (e) {}
      if (typeof onImagesUpdated === "function") {
        onImagesUpdated(val);
      }
    });
  }
}

// ==========================================
// STATUS DA LOJA E ESTOQUE EM TEMPO REAL
// ==========================================

function fbSaveStoreSettings(settings) {
  try {
    localStorage.setItem("elieudo_store_settings", JSON.stringify(settings));
  } catch (e) {}

  if (isFirebaseReady && fbDb) {
    return fbDb.ref("store_settings").set(settings);
  }
  return Promise.resolve();
}

function fbListenStoreSettings(callback) {
  try {
    const local = JSON.parse(localStorage.getItem("elieudo_store_settings") || "null");
    if (local && typeof callback === "function") callback(local);
  } catch (e) {}

  if (isFirebaseReady && fbDb) {
    fbDb.ref("store_settings").on("value", (snapshot) => {
      const val = snapshot.val();
      if (val && typeof callback === "function") {
        try {
          localStorage.setItem("elieudo_store_settings", JSON.stringify(val));
        } catch (e) {}
        callback(val);
      }
    });
  }
}

function fbSaveOutOfStock(list) {
  try {
    localStorage.setItem("elieudo_stock_out_db", JSON.stringify(list));
  } catch (e) {}

  if (isFirebaseReady && fbDb) {
    return fbDb.ref("out_of_stock").set(list);
  }
  return Promise.resolve();
}

function fbListenOutOfStock(callback) {
  try {
    const local = JSON.parse(localStorage.getItem("elieudo_stock_out_db") || "[]");
    if (typeof callback === "function") callback(local);
  } catch (e) {}

  if (isFirebaseReady && fbDb) {
    fbDb.ref("out_of_stock").on("value", (snapshot) => {
      const val = snapshot.val() || [];
      try {
        localStorage.setItem("elieudo_stock_out_db", JSON.stringify(val));
      } catch (e) {}
      if (typeof callback === "function") callback(val);
    });
  }
}
