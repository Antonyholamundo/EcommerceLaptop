/**
 * config.js — Configuración centralizada de EcuaCOMPU / ScraperAgent v2
 * Única fuente de verdad para constantes de dominio y configuración del servidor.
 */

// ============================================================
// MARCAS CONOCIDAS
// ============================================================
const BRAND_KEYWORDS = [
  'Apple', 'HP', 'Lenovo', 'Dell', 'Dynabook',
  'Quasad', 'Samsung', 'Asus', 'Acer', 'MSI',
  'AMD', 'Intel', 'Nvidia', 'Gigabyte', 'ASRock', 'Zotac',
  'EVGA', 'Kingston', 'Adata', 'Crucial', 'Corsair',
  'Western Digital', 'WD', 'Seagate', 'Toshiba',
  'XPG', 'Teamgroup', 'Lexar', 'PNY', 'Patriot',
  'Thermaltake', 'Thermalright', 'Cougar', 'Deepcool',
  'Cooler Master', 'Antryx', 'Aerocool', 'Seasonic',
  'Be Quiet', 'Lian Li', 'NZXT', 'Redragon',
];

// ============================================================
// PATRONES DE PROCESADORES
// ============================================================
const PROCESSOR_PATTERNS = [
  { keywords: ['core ultra 9', 'ultra 9', 'ultra9'], label: 'Intel Core Ultra 9' },
  { keywords: ['core ultra 7', 'ultra 7', 'ultra7'], label: 'Intel Core Ultra 7' },
  { keywords: ['core ultra 5', 'ultra 5', 'ultra5'], label: 'Intel Core Ultra 5' },
  { keywords: ['i9', 'intel i9', 'core i9'], label: 'Intel Core i9' },
  { keywords: ['i7', 'intel i7', 'core i7'], label: 'Intel Core i7' },
  { keywords: ['i5', 'intel i5', 'core i5'], label: 'Intel Core i5' },
  { keywords: ['i3', 'intel i3', 'core i3'], label: 'Intel Core i3' },
  { keywords: ['ryzen 9', 'ryzen9'], label: 'AMD Ryzen 9' },
  { keywords: ['ryzen 7', 'ryzen7'], label: 'AMD Ryzen 7' },
  { keywords: ['ryzen 5', 'ryzen5'], label: 'AMD Ryzen 5' },
  { keywords: ['ryzen 3', 'ryzen3'], label: 'AMD Ryzen 3' },
  { keywords: ['snapdragon'], label: 'Qualcomm Snapdragon' },
  { keywords: ['a18 pro'], label: 'Apple A18 Pro' },
  { keywords: ['m5'], label: 'Apple M5' },
  { keywords: ['m4'], label: 'Apple M4' },
  { keywords: ['m3'], label: 'Apple M3' },
  { keywords: ['m2'], label: 'Apple M2' },
  { keywords: ['m1'], label: 'Apple M1' },
];

// ============================================================
// PALABRAS CLAVE DE COLOR
// ============================================================
const COLOR_KEYWORDS = [
  'luna gray', 'blue night', 'mystic-blue',
  'silver', 'gray', 'grey', 'blue', 'black',
  'citrus', 'indigo', 'blush', 'plata', 'gris', 'negro', 'azul',
];

// ============================================================
// CONFIGURACIÓN DEL SERVIDOR
// ============================================================
const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,

  // Intervalo del scheduler: 1 hora entre ciclos completos
  SCRAPE_INTERVAL_MS: 60 * 60 * 1000,

  // Pausa entre categorías dentro de un ciclo (5 minutos)
  CATEGORY_DELAY_MS: 5 * 60 * 1000,

  // Delay del primer ciclo tras el boot (10 minutos, para no saturar al arrancar)
  INITIAL_SCRAPE_DELAY_MS: 10 * 60 * 1000,

  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 100,
  ADMIN_KEY: process.env.ADMIN_KEY || 'admin2026',
  REFERENCE_PRICE_MARKUP: 0.15,
  MAX_RELATED_PRODUCTS: 8,
};

// ============================================================
// CONFIGURACIÓN DEL SCRAPER (Rate Limiting & Robustez)
// ============================================================
const SCRAPER_CONFIG = {
  // Paginación robusta
  MAX_PAGES: 100,
  CONSECUTIVE_EMPTY_LIMIT: 2,

  // Delays de navegación (ms)
  PAGES_DELAY_MS: 2000,       // Entre páginas de listado
  PRODUCTS_DELAY_MS: 1500,    // Entre productos individuales (Level 2)
  CATEGORY_PAUSE_MS: 5000,    // Entre categorías en scrapeAllComponents

  // Reintentos por producto
  RETRY_DELAYS_MS: [3000, 6000],  // Backoff: 3s y 6s antes de 2do y 3er intento
  MAX_RETRIES: 2,

  // Rate limiting del servidor destino
  RATE_LIMIT_WAIT_MS: 30000,      // Espera 30s tras recibir 429

  // Verificación de imágenes (HEAD request por cada URL de imagen)
  // true = más preciso pero más lento en Level 2
  CHECK_IMAGE_EXISTS: false,

  // Timeouts de Playwright
  PAGE_TIMEOUT_MS: 60000,
  PRODUCT_TIMEOUT_MS: 45000,
  RENDER_WAIT_MS: 5000,
  PRODUCT_RENDER_WAIT_MS: 2000,
};

// ============================================================
// URLS DEL E-COMMERCE DESTINO
// ============================================================
const ECOMMERCE = {
  BASE_URL: 'https://tecnomegastore.ec',

  // Computadoras
  LAPTOPS_CATEGORY:     'https://tecnomegastore.ec/category/1/3N003-pc-laptop-portatil-notebook',
  DESKTOPS_CATEGORY:    'https://tecnomegastore.ec/category/1/3N004-pc-desktop-torre',
  MINIPC_CATEGORY:      'https://tecnomegastore.ec/category/1/4N013-mini-pc-nuc-intel-core',
  MOTHERBOARD_CATEGORY: 'https://tecnomegastore.ec/category/1/4N062-motherboard-mainboard-amd',

  // Componentes
  PROCESSOR_CATEGORY:   'https://tecnomegastore.ec/category/1/4N060-procesador-intel-core-amd',
  VIDEOCARD_CATEGORY:   'https://tecnomegastore.ec/category/1/4N064-tarjeta-video',
  POWERSUPPLY_CATEGORY: 'https://tecnomegastore.ec/category/1/4N102-fuente-de-poder-80-plus',
  COOLER_CATEGORY:      'https://tecnomegastore.ec/category/1/4N114-cooler-cpu-pc-enfriador-heat-sink',
  STORAGE_CATEGORY:     'https://tecnomegastore.ec/category/1/3N038-disco-duro-ssd-hdd',
  RAM_CATEGORY:         'https://tecnomegastore.ec/category/1/4N061-memoria-ram-dimm-sodimm-hp-dell',
  CASE_CATEGORY:        'https://tecnomegastore.ec/category/1/4N059-case-de-pc',
  FAN_CATEGORY:         'https://tecnomegastore.ec/category/1/4N072-fan-ventilador-pc',

  // Monitores
  MONITOR_CATEGORY:       'https://tecnomegastore.ec/category/1/3N102-monitor-pc-pantalla-samsung-lg-dell',
  GAMING_MONITOR_CATEGORY:'https://tecnomegastore.ec/category/1/3N103-gaming-monitor-samsung-lg-asus',

  // URL individual de producto (genérica)
  PRODUCT_URL: (sku) => `https://tecnomegastore.ec/product/detail?code=${sku}`,
};

// ============================================================
// MAPA: nombre interno → URL de categoría (para syncByName)
// ============================================================
const CATEGORY_MAP = {
  'laptops':          { url: ECOMMERCE.LAPTOPS_CATEGORY,       label: 'Laptops' },
  'desktops':         { url: ECOMMERCE.DESKTOPS_CATEGORY,      label: 'PC Desktop' },
  'minipcs':          { url: ECOMMERCE.MINIPC_CATEGORY,        label: 'Mini PC' },
  'motherboards':     { url: ECOMMERCE.MOTHERBOARD_CATEGORY,   label: 'Motherboard' },
  'procesadores':     { url: ECOMMERCE.PROCESSOR_CATEGORY,     label: 'Procesadores' },
  'tarjetas-video':   { url: ECOMMERCE.VIDEOCARD_CATEGORY,     label: 'Tarjetas de Video' },
  'fuentes':          { url: ECOMMERCE.POWERSUPPLY_CATEGORY,   label: 'Fuentes de Poder' },
  'coolers':          { url: ECOMMERCE.COOLER_CATEGORY,        label: 'Coolers' },
  'almacenamiento':   { url: ECOMMERCE.STORAGE_CATEGORY,       label: 'Almacenamiento' },
  'ram':              { url: ECOMMERCE.RAM_CATEGORY,           label: 'Memorias RAM' },
  'cases':            { url: ECOMMERCE.CASE_CATEGORY,          label: 'Cases' },
  'ventiladores':     { url: ECOMMERCE.FAN_CATEGORY,           label: 'Ventiladores' },
  'monitores':        { url: ECOMMERCE.MONITOR_CATEGORY,       label: 'Monitores' },
  'gaming-monitores': { url: ECOMMERCE.GAMING_MONITOR_CATEGORY,label: 'Gaming Monitores' },
};

module.exports = {
  BRAND_KEYWORDS,
  PROCESSOR_PATTERNS,
  COLOR_KEYWORDS,
  SERVER_CONFIG,
  SCRAPER_CONFIG,
  ECOMMERCE,
  CATEGORY_MAP,
};
