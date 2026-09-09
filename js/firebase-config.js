/**
 * Configuração e Camada de Sincronização em Tempo Real (Firebase & Fallback Local)
 * Pizzaria do Elieudo
 */

// Credenciais Oficiais do Projeto Firebase da Pizzaria do Elieudo
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "pizzaria-do-elieudo",
  appId: "1:515557510318:web:2c5674f1ea49f5737df13f",
  storageBucket: "pizzaria-do-elieudo.firebasestorage.app",
  apiKey: "AIzaSyD-tBrjXuOdCAK1KBQHMclCz6Ji0m5ZQ20",
  authDomain: "pizzaria-do-elieudo.firebaseapp.com",
  messagingSenderId: "515557510318",
  databaseURL: "https://pizzaria-do-elieudo-default-rtdb.firebaseio.com"
};

// Chave para armazenar credenciais customizadas no navegador do administrador
const FB_STORAGE_KEY = "elieudo_firebase_config";
const FB_IMAGES_STORAGE_KEY = "elieudo_custom_images";

let firebaseConfig = DEFAULT_FIREBASE_CONFIG;

try {
  const savedConfig = localStorage.getItem(FB_STORAGE_KEY);
  if (savedConfig) {
    firebaseConfig = Object.assign({}, DEFAULT_FIREBASE_CONFIG, JSON.parse(savedConfig));
  }
} catch (e) {
  firebaseConfig = DEFAULT_FIREBASE_CONFIG;
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
 * Sincronização Híbrida: Nuvem (Firebase) + BroadcastChannel + LocalStorage Event
 */
function fbListenOrders(onOrdersUpdated, onNewOrderArrived) {
  // 1. Sempre escuta o BroadcastChannel (tempo real instantâneo entre abas do mesmo dispositivo)
  if (window.BroadcastChannel) {
    try {
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
    } catch (e) {}
  }

  // 2. Sempre escuta o evento nativo de Storage (garantia 100% de atualização sem F5 no mesmo navegador)
  window.addEventListener("storage", (e) => {
    if (e.key === "elieudo_orders_db") {
      try {
        const raw = e.newValue || localStorage.getItem("elieudo_orders_db");
        const list = raw ? JSON.parse(raw) : [];
        if (typeof onOrdersUpdated === "function") {
          onOrdersUpdated(list);
        }
      } catch (err) {}
    }
  });

  // 3. Se Firebase estiver ativo, escuta alterações remotas na nuvem
  if (isFirebaseReady && fbDb) {
    try {
      const ordersRef = fbDb.ref("orders");
      let initialLoadDone = false;

      // Escuta todos os pedidos da nuvem
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
        // Atualiza cache local com os dados da nuvem
        try {
          localStorage.setItem("elieudo_orders_db", JSON.stringify(list));
        } catch (e) {}

        if (typeof onOrdersUpdated === "function") {
          onOrdersUpdated(list);
        }
        initialLoadDone = true;
      }, (error) => {
        console.warn("Aviso Firebase (Realtime Database pode não estar criado ainda):", error);
      });

      // Notificação sonora para novos pedidos na nuvem
      ordersRef.on("child_added", (snapshot) => {
        if (initialLoadDone) {
          const newOrder = snapshot.val();
          if (typeof onNewOrderArrived === "function" && newOrder) {
            onNewOrderArrived(newOrder);
          }
        }
      });
    } catch (err) {
      console.warn("Falha ao registrar ouvintes do Firebase:", err);
    }
  } else {
    // Carga inicial do cache local se Firebase não estiver pronto
    try {
      const raw = localStorage.getItem("elieudo_orders_db");
      const list = raw ? JSON.parse(raw) : [];
      if (typeof onOrdersUpdated === "function") {
        onOrdersUpdated(list);
      }
    } catch (e) {}
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
    fbDb.ref(`orders/${safeKey}/status`).set(newStatus);
  }

  // Notifica abas locais via BroadcastChannel
  if (window.BroadcastChannel) {
    try {
      const channel = new BroadcastChannel("elieudo_orders_bus");
      channel.postMessage({ type: "ORDER_STATUS_CHANGED", orderId: orderId, newStatus: newStatus });
      channel.close();
    } catch (e) {}
  }
  return Promise.resolve();
}

/**
 * Ouvir um pedido específico em tempo real para o Cliente (Rastreamento)
 */
function fbListenSingleOrder(rawOrderId, onUpdate) {
  if (!rawOrderId) return () => {};
  const cleanId = rawOrderId.toString().replace(/^#/, "").replace(/^ord_/, "").trim();
  const safeKey = "ord_" + cleanId;
  const hashId = "#" + cleanId;

  let hasDeliveredData = false;

  // 1. Ouvir BroadcastChannel local
  let channel = null;
  if (window.BroadcastChannel) {
    try {
      channel = new BroadcastChannel("elieudo_orders_bus");
      channel.onmessage = (evt) => {
        if (evt.data && (evt.data.orderId === hashId || evt.data.orderId === cleanId)) {
          fbGetOrderById(hashId).then((ord) => {
            if (ord && typeof onUpdate === "function") {
              hasDeliveredData = true;
              onUpdate(ord);
            }
          });
        }
      };
    } catch (e) {}
  }

  // 2. Ouvir evento storage
  const storageListener = (e) => {
    if (e.key === "elieudo_orders_db") {
      fbGetOrderById(hashId).then((ord) => {
        if (ord && typeof onUpdate === "function") {
          hasDeliveredData = true;
          onUpdate(ord);
        }
      });
    }
  };
  window.addEventListener("storage", storageListener);

  // 3. Ouvir Firebase Realtime Database
  let fbRef = null;
  let fbCallback = null;
  if (isFirebaseReady && fbDb) {
    try {
      fbRef = fbDb.ref("orders/" + safeKey);
      fbCallback = (snapshot) => {
        const data = snapshot.val();
        if (data) {
          hasDeliveredData = true;
          if (typeof onUpdate === "function") onUpdate(data);
        } else {
          const localOrd = getOrderFromLocalStorage(hashId, cleanId);
          if (localOrd) {
            hasDeliveredData = true;
            if (typeof onUpdate === "function") onUpdate(localOrd);
          } else if (!hasDeliveredData) {
            if (typeof onUpdate === "function") onUpdate(null);
          }
        }
      };
      fbRef.on("value", fbCallback);
    } catch (err) {
      console.warn("Erro ao ouvir pedido no Firebase:", err);
    }
  }

  // Carga inicial de segurança se Firebase demorar ou estiver desconectado
  setTimeout(() => {
    if (!hasDeliveredData) {
      fbGetOrderById(hashId).then((ord) => {
        if (ord) {
          hasDeliveredData = true;
          if (typeof onUpdate === "function") onUpdate(ord);
        } else if (!hasDeliveredData) {
          if (typeof onUpdate === "function") onUpdate(null);
        }
      });
    }
  }, 2200);

  // Retorna função de cancelamento do listener
  return () => {
    if (channel) {
      try { channel.close(); } catch (e) {}
    }
    window.removeEventListener("storage", storageListener);
    if (fbRef && fbCallback) {
      try { fbRef.off("value", fbCallback); } catch (e) {}
    }
  };
}

/**
 * Buscar pedido por ID (Firebase com fallback no LocalStorage e timeout)
 */
function fbGetOrderById(rawOrderId) {
  return new Promise((resolve) => {
    if (!rawOrderId) return resolve(null);
    const cleanId = rawOrderId.toString().replace(/^#/, "").replace(/^ord_/, "").trim();
    const hashId = "#" + cleanId;

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(getOrderFromLocalStorage(hashId, cleanId));
      }
    }, 2200);

    // 1. Tenta Firebase se conectado
    if (isFirebaseReady && fbDb) {
      const safeKey = "ord_" + cleanId;
      fbDb.ref("orders/" + safeKey).once("value")
        .then((snapshot) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            const val = snapshot.val();
            if (val) {
              return resolve(val);
            }
            resolve(getOrderFromLocalStorage(hashId, cleanId));
          }
        })
        .catch(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve(getOrderFromLocalStorage(hashId, cleanId));
          }
        });
    } else {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(getOrderFromLocalStorage(hashId, cleanId));
      }
    }
  });
}

function getOrderFromLocalStorage(hashId, cleanId) {
  try {
    const raw = localStorage.getItem("elieudo_orders_db");
    const list = raw ? JSON.parse(raw) : [];
    return list.find(o => o.id === hashId || o.id === cleanId || o.id === ("ord_" + cleanId)) || null;
  } catch (e) {
    return null;
  }
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

// ==========================================
// CUPONS DE DESCONTO EM TEMPO REAL
// ==========================================

const DEFAULT_COUPONS = [
  { code: "BEMVINDO", type: "percent", value: 10, minOrder: 30, active: true, desc: "10% de desconto na primeira compra" },
  { code: "ELIEUDO5", type: "fixed", value: 5, minOrder: 40, active: true, desc: "R$ 5,00 OFF em pedidos acima de R$ 40" }
];

function fbSaveCoupons(couponsList) {
  try {
    localStorage.setItem("elieudo_coupons_db", JSON.stringify(couponsList));
  } catch (e) {}

  if (isFirebaseReady && fbDb) {
    return fbDb.ref("coupons").set(couponsList);
  }
  return Promise.resolve();
}

function fbListenCoupons(callback) {
  try {
    const local = JSON.parse(localStorage.getItem("elieudo_coupons_db") || "null");
    if (local && Array.isArray(local) && local.length > 0) {
      if (typeof callback === "function") callback(local);
    } else {
      if (typeof callback === "function") callback(DEFAULT_COUPONS);
    }
  } catch (e) {
    if (typeof callback === "function") callback(DEFAULT_COUPONS);
  }

  if (isFirebaseReady && fbDb) {
    fbDb.ref("coupons").on("value", (snapshot) => {
      const val = snapshot.val();
      if (val && Array.isArray(val)) {
        try {
          localStorage.setItem("elieudo_coupons_db", JSON.stringify(val));
        } catch (e) {}
        if (typeof callback === "function") callback(val);
      } else if (val === null) {
        // Se ainda não foi inicializado na nuvem, inicializa com os padrões
        fbDb.ref("coupons").set(DEFAULT_COUPONS);
      }
    });
  }
}

// ==========================================
// PIN DE SEGURANÇA DO ADMIN
// ==========================================

const DEFAULT_ADMIN_PIN = "1234";

function fbSaveAdminPin(newPin) {
  try {
    localStorage.setItem("elieudo_admin_pin", String(newPin));
  } catch (e) {}

  if (isFirebaseReady && fbDb) {
    return fbDb.ref("admin_auth/pin").set(String(newPin));
  }
  return Promise.resolve();
}

function fbListenAdminPin(callback) {
  try {
    const local = localStorage.getItem("elieudo_admin_pin") || DEFAULT_ADMIN_PIN;
    if (typeof callback === "function") callback(local);
  } catch (e) {}

  if (isFirebaseReady && fbDb) {
    fbDb.ref("admin_auth/pin").on("value", (snapshot) => {
      const val = snapshot.val();
      if (val) {
        try {
          localStorage.setItem("elieudo_admin_pin", String(val));
        } catch (e) {}
        if (typeof callback === "function") callback(String(val));
      }
    });
  }
}

