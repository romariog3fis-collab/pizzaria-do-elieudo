/**
 * Cardápio Oficial da Pizzaria do Elieudo
 * Extraído diretamente de cardapio.pdf
 * Contato: (85) 99177-4881
 * Localização: Elieudo Motos - Jacaúna - Aquiraz/CE
 */

const MENU_DATA = {
  restaurant: {
    name: "Pizzaria do Elieudo",
    phone: "5585991774881",
    phoneFormatted: "(85) 99177-4881",
    instagram: "@pizzaria_do_elieudo",
    address: "Elieudo Motos - Jacaúna - Aquiraz/CE",
    serviceFeeNotice: "Cobramos taxa de serviço (opcional)",
    openingHours: "Terça a Domingo das 18:00 às 23:30",
    pixKey: "85991774881"
  },
  
  sizes: [
    { id: "M", name: "Média (M)", slices: "6 fatias", maxFlavors: 2, label: "M" },
    { id: "G", name: "Grande (G)", slices: "8 fatias", maxFlavors: 2, label: "G", default: true },
    { id: "GG", name: "Família (GG)", slices: "12 fatias", maxFlavors: 3, label: "GG" }
  ],

  crusts: [
    { id: "tradicional", name: "Borda Tradicional (Massa Fina e Crocante)", price: 0, category: "padrao" },
    // Bordas Salgadas
    { id: "borda_requeijao", name: "Borda Requeijão Cremoso", price: 8.00, category: "salgada" },
    { id: "borda_cheddar", name: "Borda Cheddar Especial", price: 10.00, category: "salgada" },
    { id: "borda_cream_cheese", name: "Borda Cream Cheese", price: 12.00, category: "salgada" },
    { id: "borda_catupiry", name: "Borda Catupiry Original", price: 15.00, category: "salgada" },
    // Bordas Especiais
    { id: "borda_frango_catupiry", name: "Borda Frango c/ Requeijão ou Cheddar", price: 15.00, category: "especial" },
    { id: "borda_calabresa_catupiry", name: "Borda Calabresa c/ Requeijão ou Cheddar", price: 15.00, category: "especial" },
    { id: "borda_carne_sol", name: "Borda Carne do Sol c/ Requeijão ou Cheddar", price: 17.00, category: "especial" },
    // Bordas Doces
    { id: "borda_choc_leite", name: "Borda Chocolate ao Leite", price: 12.00, category: "doce" },
    { id: "borda_choc_branco", name: "Borda Chocolate Branco", price: 12.00, category: "doce" },
    { id: "borda_choc_avela", name: "Borda Chocolate com Avelã", price: 15.00, category: "doce" }
  ],

  extraToppings: [
    { id: "topo_requeijao", name: "Requeijão Cremoso", price: 8.00 },
    { id: "topo_cheddar", name: "Cheddar Especial", price: 10.00 },
    { id: "topo_cream_cheese", name: "Cream Cheese", price: 12.00 },
    { id: "topo_catupiry", name: "Catupiry Original", price: 15.00 }
  ],

  categories: [
    { id: "pizzas_tradicionais", name: "Pizzas Tradicionais", icon: "🍕", type: "pizza" },
    { id: "pizzas_premium", name: "Pizzas Premium", icon: "⭐", type: "pizza" },
    { id: "pizzas_doces", name: "Pizzas Doces", icon: "🍫", type: "pizza" },
    { id: "esfihas_tradicionais", name: "Esfihas Tradicionais", icon: "🥟", type: "esfiha" },
    { id: "esfihas_especiais", name: "Esfihas Especiais", icon: "✨", type: "esfiha" },
    { id: "esfihas_doces", name: "Esfihas Doces", icon: "🍓", type: "esfiha" },
    { id: "sucos", name: "Sucos Naturais", icon: "🍹", type: "bebida" },
    { id: "bebidas", name: "Refrigerantes & Bebidas", icon: "🥤", type: "bebida" }
  ],

  items: [
    // --- PIZZAS TRADICIONAIS ---
    {
      id: "pz_calabresa",
      category: "pizzas_tradicionais",
      name: "Calabresa",
      description: "Molho, mussarela, calabresa, cebola, orégano e azeitonas.",
      prices: { M: 29.90, G: 39.90, GG: 54.90 },
      badge: "Mais Pedida",
      image: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_frango",
      category: "pizzas_tradicionais",
      name: "Frango",
      description: "Molho, mussarela, frango, milho, orégano e azeitonas.",
      prices: { M: 29.90, G: 39.90, GG: 54.90 },
      image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_mussarela",
      category: "pizzas_tradicionais",
      name: "Mussarela",
      description: "Molho, mussarela, tomate, orégano e azeitonas.",
      prices: { M: 27.90, G: 37.90, GG: 52.90 },
      image: "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_marguerita",
      category: "pizzas_tradicionais",
      name: "Marguerita",
      description: "Molho, mussarela, tomate, manjericão, orégano e azeitonas.",
      prices: { M: 27.90, G: 37.90, GG: 52.90 },
      image: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_baiana",
      category: "pizzas_tradicionais",
      name: "Baiana",
      description: "Molho, mussarela, calabresa picada, pimenta biquinho, cebola roxa, orégano e azeitonas.",
      prices: { M: 32.90, G: 42.90, GG: 57.90 },
      badge: "Apimentada",
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_bacon",
      category: "pizzas_tradicionais",
      name: "Bacon",
      description: "Molho, mussarela, bacon, orégano e azeitonas.",
      prices: { M: 32.90, G: 42.90, GG: 57.90 },
      image: "https://images.unsplash.com/photo-1588315029754-2dd089d39a1a?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_calabresa_bacon",
      category: "pizzas_tradicionais",
      name: "Calabresa c/ Bacon",
      description: "Molho, mussarela, calabresa, bacon, cebola, orégano e azeitonas.",
      prices: { M: 32.90, G: 42.90, GG: 57.90 },
      image: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_milho_verde",
      category: "pizzas_tradicionais",
      name: "Milho Verde",
      description: "Molho, mussarela, milho, orégano e azeitonas.",
      prices: { M: 29.90, G: 39.90, GG: 54.90 },
      image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_mista",
      category: "pizzas_tradicionais",
      name: "Mista",
      description: "Molho, mussarela, presunto, tomate, orégano e azeitonas.",
      prices: { M: 27.90, G: 37.90, GG: 52.90 },
      image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_portuguesa",
      category: "pizzas_tradicionais",
      name: "Portuguesa",
      description: "Molho, mussarela, presunto, ervilha, milho, cebola, tomate, ovo, orégano e azeitonas.",
      prices: { M: 29.90, G: 39.90, GG: 54.90 },
      badge: "Clássica",
      image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_calafrango",
      category: "pizzas_tradicionais",
      name: "Calafrango",
      description: "Molho, mussarela, cebola, milho, frango, calabresa, orégano e azeitonas.",
      prices: { M: 32.90, G: 42.90, GG: 57.90 },
      image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_crocante",
      category: "pizzas_tradicionais",
      name: "Crocante",
      description: "Molho, mussarela, presunto, bacon, batata palha, orégano e azeitonas.",
      prices: { M: 29.90, G: 39.90, GG: 54.90 },
      image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_calamista",
      category: "pizzas_tradicionais",
      name: "Calamista",
      description: "Molho, mussarela, calabresa, presunto, tomate, cebola, orégano e azeitonas.",
      prices: { M: 32.90, G: 42.90, GG: 57.90 },
      image: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_4estacoes",
      category: "pizzas_tradicionais",
      name: "4 Estações",
      description: "2 pedaços de cada: Calabresa, Frango, Portuguesa e Mussarela.",
      prices: { M: 34.90, G: 44.90, GG: 54.90 },
      badge: "4 em 1",
      image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80"
    },

    // --- PIZZAS PREMIUM ---
    {
      id: "pz_italiana",
      category: "pizzas_premium",
      name: "Italiana",
      description: "Molho, mussarela, pepperoni, provolone, champignon, tomate, manjericão, orégano e azeitonas.",
      prices: { M: 34.90, G: 54.90, GG: 64.90 },
      badge: "Chef Especial",
      image: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_amoda",
      category: "pizzas_premium",
      name: "À Moda",
      description: "Molho, mussarela, calabresa, bacon, ovo, cebola, tomate, orégano e azeitonas.",
      prices: { M: 37.90, G: 47.90, GG: 62.90 },
      image: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_camarao",
      category: "pizzas_premium",
      name: "Camarão",
      description: "Molho, mussarela, camarão selecionado, tomate, orégano e azeitonas.",
      prices: { M: 38.90, G: 58.90, GG: 69.90 },
      badge: "Gourmet",
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_carne_sol",
      category: "pizzas_premium",
      name: "Carne do Sol",
      description: "Molho, mussarela, carne do sol desfiada, cebola, orégano e azeitonas.",
      prices: { M: 34.90, G: 54.90, GG: 64.90 },
      badge: "Regional",
      image: "https://images.unsplash.com/photo-1588315029754-2dd089d39a1a?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_do_chefe",
      category: "pizzas_premium",
      name: "Do Chefe",
      description: "Molho, mussarela, presunto, calabresa, carne do sol, catupiry, cheddar, orégano e azeitonas.",
      prices: { M: 34.90, G: 54.90, GG: 64.90 },
      badge: "Campeã",
      image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_lombinho",
      category: "pizzas_premium",
      name: "Lombinho",
      description: "Molho, mussarela, lombinho canadense, cebola, barbecue especial, orégano e azeitonas.",
      prices: { M: 32.90, G: 42.90, GG: 57.90 },
      image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_pepperoni",
      category: "pizzas_premium",
      name: "Pepperoni",
      description: "Molho, mussarela, pepperoni importado, manjericão fresco, orégano e azeitonas.",
      prices: { M: 37.90, G: 47.90, GG: 62.90 },
      badge: "Favorita",
      image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_quatro_queijos",
      category: "pizzas_premium",
      name: "Quatro Queijos",
      description: "Molho, mussarela, gorgonzola, provolone, parmesão ralado, orégano e azeitonas.",
      prices: { M: 37.90, G: 47.90, GG: 62.90 },
      image: "https://images.unsplash.com/photo-1573821663912-569905455b1c?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_original",
      category: "pizzas_premium",
      name: "Original",
      description: "Molho, mussarela, carne do sol, cebola roxa, ovo, cream cheese, orégano e azeitonas.",
      prices: { M: 37.90, G: 47.90, GG: 62.90 },
      badge: "Exclusiva",
      image: "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_nordestina",
      category: "pizzas_premium",
      name: "Nordestina",
      description: "Molho, mussarela, carne do sol, cebola roxa, cream cheese, pimenta biquinho, orégano e azeitonas.",
      prices: { M: 37.90, G: 47.90, GG: 62.90 },
      badge: "Mais Pedida",
      image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_cangaceiro",
      category: "pizzas_premium",
      name: "Cangaceiro",
      description: "Molho, mussarela, carne do sol, alho-poró, rapadura ralada, cebola roxa, orégano e azeitonas.",
      prices: { M: 37.90, G: 47.90, GG: 62.90 },
      badge: "Autêntica Cearense",
      image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80"
    },

    // --- PIZZAS DOCES ---
    {
      id: "pz_choc_leite",
      category: "pizzas_doces",
      name: "Chocolate ao Leite",
      description: "Cobertura cremosa de chocolate ao leite nobre.",
      prices: { M: 37.90, G: 47.90, GG: 57.90 },
      image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_dois_amores",
      category: "pizzas_doces",
      name: "Dois Amores",
      description: "Combinação perfeita de chocolate ao leite e chocolate branco.",
      prices: { M: 37.90, G: 47.90, GG: 57.90 },
      badge: "Delícia",
      image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_mms",
      category: "pizzas_doces",
      name: "M&M's",
      description: "Chocolate ao leite coberto com confeitos crocantes de M&M's.",
      prices: { M: 37.90, G: 47.90, GG: 57.90 },
      badge: "Kids",
      image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_banana_canela",
      category: "pizzas_doces",
      name: "Banana com Canela",
      description: "Fatias de banana fatiada, leite condensado e canela em pó.",
      prices: { M: 24.90, G: 34.90, GG: 44.90 },
      image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_banana_chocolate",
      category: "pizzas_doces",
      name: "Banana com Chocolate",
      description: "Banana caramelizada, leite condensado e gotas de chocolate.",
      prices: { M: 27.90, G: 37.90, GG: 47.90 },
      image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_prestigio",
      category: "pizzas_doces",
      name: "Prestígio",
      description: "Chocolate ao leite, leite condensado e muito coco ralado úmido.",
      prices: { M: 37.90, G: 47.90, GG: 57.90 },
      image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_morango",
      category: "pizzas_doces",
      name: "Morango com Chocolate",
      description: "Chocolate ao leite aveludado com morangos frescos picados.",
      prices: { M: 39.90, G: 49.90, GG: 59.90 },
      badge: "Sensação",
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80"
    },
    {
      id: "pz_brigadeiro",
      category: "pizzas_doces",
      name: "Brigadeiro",
      description: "Creme de brigadeiro artesanal com granulado de chocolate.",
      prices: { M: 37.90, G: 47.90, GG: 57.90 },
      image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=600&auto=format&fit=crop&q=80"
    },

    // --- ESFIHAS TRADICIONAIS (Preço R$ 4,50) ---
    { id: "esf_queijo", category: "esfihas_tradicionais", name: "Esfiha de Queijo", description: "Queijo mussarela derretido e orégano.", price: 4.50 },
    { id: "esf_mista", category: "esfihas_tradicionais", name: "Esfiha Mista", description: "Mussarela e presunto em cubos com orégano.", price: 4.50 },
    { id: "esf_calabresa", category: "esfihas_tradicionais", name: "Esfiha de Calabresa", description: "Calabresa moída temperada.", price: 4.50 },
    { id: "esf_frango", category: "esfihas_tradicionais", name: "Esfiha de Frango", description: "Peito de frango desfiado suculento.", price: 4.50 },
    { id: "esf_marguerita", category: "esfihas_tradicionais", name: "Esfiha Marguerita", description: "Mussarela, tomate e toque de manjericão.", price: 4.50 },
    { id: "esf_calabresa_acebolada", category: "esfihas_tradicionais", name: "Esfiha Calabresa Acebolada", description: "Calabresa com cebola bem refogada.", price: 4.50 },
    { id: "esf_portuguesa", category: "esfihas_tradicionais", name: "Esfiha Portuguesa", description: "Mussarela, presunto, ovo, ervilha e milho.", price: 4.50 },

    // --- ESFIHAS ESPECIAIS (R$ 7,50 a R$ 8,00) ---
    { id: "esf_frango_catupiry", category: "esfihas_especiais", name: "Frango c/ Catupiry", description: "Frango selecionado com Catupiry cremoso.", price: 7.50 },
    { id: "esf_calabresa_catupiry", category: "esfihas_especiais", name: "Calabresa c/ Catupiry", description: "Calabresa temperada com Catupiry.", price: 7.50 },
    { id: "esf_carne_sol_catupiry", category: "esfihas_especiais", name: "Carne do Sol c/ Catupiry", description: "Carne do sol desfiada e Catupiry.", price: 7.50 },
    { id: "esf_pepperoni", category: "esfihas_especiais", name: "Pepperoni", description: "Pepperoni fatiado com queijo derretido.", price: 7.50 },
    { id: "esf_camarao_catupiry", category: "esfihas_especiais", name: "Camarão c/ Catupiry", description: "Camarão especial com Catupiry original.", price: 8.00 },
    { id: "esf_camarao", category: "esfihas_especiais", name: "Camarão Simples", description: "Camarão refogado e bem temperado.", price: 8.00 },
    { id: "esf_2queijos", category: "esfihas_especiais", name: "2 Queijos", description: "Mistura saborosa de queijos nobres.", price: 7.50 },

    // --- ESFIHAS DOCES (R$ 6,50 a R$ 8,00) ---
    { id: "esf_chocolate", category: "esfihas_doces", name: "Esfiha de Chocolate", description: "Creme de chocolate ao leite nobre.", price: 6.50 },
    { id: "esf_mms", category: "esfihas_doces", name: "Esfiha M&M's", description: "Chocolate ao leite coberto com M&M's.", price: 6.50 },
    { id: "esf_brigadeiro", category: "esfihas_doces", name: "Esfiha de Brigadeiro", description: "Brigadeiro cremoso com granulado.", price: 6.50 },
    { id: "esf_banana_canela", category: "esfihas_doces", name: "Banana com Canela", description: "Banana, canela e leite condensado.", price: 6.50 },
    { id: "esf_banana_choc", category: "esfihas_doces", name: "Banana com Chocolate", description: "Banana com cobertura de chocolate.", price: 6.50 },
    { id: "esf_nutella", category: "esfihas_doces", name: "Esfiha de Nutella", description: "Pura e cremosa Nutella de avelã.", price: 8.00, badge: "Premium" },
    { id: "esf_choc_morango", category: "esfihas_doces", name: "Chocolate com Morango", description: "Chocolate ao leite com morango fresco.", price: 7.50 },
    { id: "esf_prestigio", category: "esfihas_doces", name: "Esfiha Prestígio", description: "Chocolate com bastante coco ralado.", price: 6.50 },
    { id: "esf_dois_amores", category: "esfihas_doces", name: "Esfiha Dois Amores", description: "Dueto de chocolate preto e branco.", price: 6.50 },

    // --- SUCOS NATURAIS / POLPAS ---
    { id: "suco_abacaxi", category: "sucos", name: "Suco de Abacaxi", description: "Refrescante suco natural 500ml.", price: 6.90 },
    { id: "suco_caja", category: "sucos", name: "Suco de Cajá", description: "Saboroso suco de cajá do Ceará 500ml.", price: 8.90 },
    { id: "suco_acerola", category: "sucos", name: "Suco de Acerola", description: "Rico em vitamina C 500ml.", price: 6.90 },
    { id: "suco_graviola", category: "sucos", name: "Suco de Graviola", description: "Cremoso e refrescante 500ml.", price: 7.90 },
    { id: "suco_manga", category: "sucos", name: "Suco de Manga", description: "Polpa de manga encorpada 500ml.", price: 6.90 },
    { id: "suco_maracuja", category: "sucos", name: "Suco de Maracujá", description: "Suco natural calmante 500ml.", price: 8.90 },
    { id: "suco_goiaba", category: "sucos", name: "Suco de Goiaba", description: "Polpa selecionada e natural 500ml.", price: 6.90 },

    // --- BEBIDAS E REFRIGERANTES ---
    { id: "beb_agua", category: "bebidas", name: "Água Mineral 500ml", description: "Sem gás natural.", price: 3.00 },
    { id: "beb_agua_gas", category: "bebidas", name: "Água Mineral c/ Gás 500ml", description: "Gaseificada.", price: 4.00 },
    { id: "beb_redbull", category: "bebidas", name: "Energético Red Bull 250ml", description: "Energy Drink original.", price: 12.00 },
    
    // 2 Litros
    { id: "beb_coca_2l", category: "bebidas", name: "Coca-Cola 2 Litros", description: "Garrafa família 2L bem gelada.", price: 15.00 },
    { id: "beb_guarana_2l", category: "bebidas", name: "Guaraná Antarctica 2L", description: "Garrafa família 2L bem gelada.", price: 15.00 },
    { id: "beb_sao_geraldo_2l", category: "bebidas", name: "Refrigerante São Geraldo 2L", description: "O tradicional caju cearense 2 Litros.", price: 15.00, badge: "Tradição Cearense" },

    // 1 Litro
    { id: "beb_coca_1l", category: "bebidas", name: "Coca-Cola 1 Litro", description: "Garrafa 1L descartável.", price: 10.00 },
    { id: "beb_coca_zero_1l", category: "bebidas", name: "Coca-Cola Zero 1 Litro", description: "Sem açúcar 1 Litro.", price: 10.00 },
    { id: "beb_guarana_1l", category: "bebidas", name: "Guaraná Antarctica 1L", description: "Garrafa 1L descartável.", price: 10.00 },
    { id: "beb_sao_geraldo_1l", category: "bebidas", name: "Refrigerante São Geraldo 1L", description: "Sabor caju 1 Litro.", price: 10.00 },

    // Lata 350ml
    { id: "beb_coca_lata", category: "bebidas", name: "Coca-Cola Lata 350ml", description: "Lata trincando de gelada.", price: 6.00 },
    { id: "beb_coca_lata_zero", category: "bebidas", name: "Coca-Cola Zero Lata 350ml", description: "Lata sem açúcar 350ml.", price: 6.00 },
    { id: "beb_guarana_lata", category: "bebidas", name: "Guaraná Antarctica Lata 350ml", description: "Lata 350ml.", price: 6.00 },
    { id: "beb_fanta_laranja_lata", category: "bebidas", name: "Fanta Laranja Lata 350ml", description: "Lata 350ml.", price: 6.00 },
    { id: "beb_fanta_uva_lata", category: "bebidas", name: "Fanta Uva Lata 350ml", description: "Lata 350ml.", price: 6.00 },
    { id: "beb_sao_geraldo_lata", category: "bebidas", name: "São Geraldo Caju Lata 350ml", description: "Tradição em lata 350ml.", price: 6.00, badge: "Sucesso" }
  ]
};

if (typeof window !== "undefined") {
  window.MENU_DATA = MENU_DATA;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = MENU_DATA;
}
