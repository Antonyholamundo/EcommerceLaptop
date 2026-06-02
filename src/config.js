/**
 * config.js — Configuración centralizada de NoteStore Ecuador
 * Única fuente de verdad para constantes de dominio y configuración del servidor.
 */

// Marcas conocidas para extracción automática desde nombres de productos
const BRAND_KEYWORDS = [
  'Apple', 'HP', 'Lenovo', 'Dell', 'Dynabook',
  'Quasad', 'Samsung', 'Asus', 'Acer', 'MSI'
];

// Patrones de procesadores (orden de prioridad: más específicos primero)
const PROCESSOR_PATTERNS = [
  { keywords: ['core ultra 7', 'ultra 7'], label: 'Intel Core Ultra 7' },
  { keywords: ['core ultra 5', 'ultra 5'], label: 'Intel Core Ultra 5' },
  { keywords: ['i7', 'intel i7', 'core i7'], label: 'Intel Core i7' },
  { keywords: ['i5', 'intel i5', 'core i5'], label: 'Intel Core i5' },
  { keywords: ['i3', 'intel i3', 'core i3'], label: 'Intel Core i3' },
  { keywords: ['ryzen 7', 'ryzen7'], label: 'AMD Ryzen 7' },
  { keywords: ['ryzen 5', 'ryzen5'], label: 'AMD Ryzen 5' },
  { keywords: ['ryzen 3', 'ryzen3'], label: 'AMD Ryzen 3' },
  { keywords: ['a18 pro'], label: 'Apple A18 Pro' },
  { keywords: ['m5'], label: 'Apple M5' },
  { keywords: ['m4'], label: 'Apple M4' },
  { keywords: ['m3'], label: 'Apple M3' },
  { keywords: ['m2'], label: 'Apple M2' },
  { keywords: ['m1'], label: 'Apple M1' },
];

// Palabras clave de color (en orden de prioridad)
const COLOR_KEYWORDS = [
  'luna gray', 'blue night', 'mystic-blue',
  'silver', 'gray', 'grey', 'blue', 'black',
  'citrus', 'indigo', 'blush', 'plata', 'gris', 'negro', 'azul'
];

// Configuración del servidor
const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
  SCRAPE_INTERVAL_MS: 60 * 60 * 1000, // 1 hora
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 100,
  ADMIN_KEY: process.env.ADMIN_KEY || 'admin2026',
  REFERENCE_PRICE_MARKUP: 0.15, // 15% para precio de referencia
  MAX_RELATED_PRODUCTS: 8,
};

// URL base del e-commerce destino
const ECOMMERCE = {
  BASE_URL: 'https://tecnomegastore.ec',
  LAPTOPS_CATEGORY: 'https://tecnomegastore.ec/category/1/3N003-pc-laptop-portatil-notebook',
  DESKTOPS_CATEGORY: 'https://tecnomegastore.ec/category/1/3N004-pc-desktop-torre',
  MINIPC_CATEGORY: 'https://tecnomegastore.ec/category/1/4N013-mini-pc-nuc-intel-core',
  MOTHERBOARD_CATEGORY: 'https://tecnomegastore.ec/category/1/4N062-motherboard-mainboard-amd',
  
  // Nuevos componentes
  PROCESSOR_CATEGORY: 'https://tecnomegastore.ec/category/1/4N060-procesador-intel-core-amd',
  VIDEOCARD_CATEGORY: 'https://tecnomegastore.ec/category/1/4N064-tarjeta-video',
  POWERSUPPLY_CATEGORY: 'https://tecnomegastore.ec/category/1/4N102-fuente-de-poder-80-plus',
  COOLER_CATEGORY: 'https://tecnomegastore.ec/category/1/4N114-cooler-cpu-pc-enfriador-heat-sink',
  STORAGE_CATEGORY: 'https://tecnomegastore.ec/category/1/3N038-disco-duro-ssd-hdd',
  RAM_CATEGORY: 'https://tecnomegastore.ec/category/1/4N061-memoria-ram-dimm-sodimm-hp-dell',
  CASE_CATEGORY: 'https://tecnomegastore.ec/category/1/4N059-case-de-pc',
  FAN_CATEGORY: 'https://tecnomegastore.ec/category/1/4N072-fan-ventilador-pc',
  
  // Monitores
  MONITOR_CATEGORY: 'https://tecnomegastore.ec/category/1/3N102-monitor-pc-pantalla-samsung-lg-dell',
  GAMING_MONITOR_CATEGORY: 'https://tecnomegastore.ec/category/1/3N103-gaming-monitor-samsung-lg-asus',
  
  PRODUCT_URL: (sku) => `https://tecnomegastore.ec/product/laptop?code=${sku}`,
};

module.exports = {
  BRAND_KEYWORDS,
  PROCESSOR_PATTERNS,
  COLOR_KEYWORDS,
  SERVER_CONFIG,
  ECOMMERCE,
};
