const { BRAND_KEYWORDS, PROCESSOR_PATTERNS, COLOR_KEYWORDS, SERVER_CONFIG } = require('../config');
const { calculatePricing } = require('./priceService');
const { getAllProducts } = require('../database');

function parseBrand(nombre) {
  const nameLower = (nombre || '').toLowerCase();
  for (const brand of BRAND_KEYWORDS) {
    if (nameLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return 'Otros';
}

function parseSpecs(nombre) {
  const lower = (nombre || '').toLowerCase();
  let processor = 'Intel / AMD';
  for (const pattern of PROCESSOR_PATTERNS) {
    if (pattern.keywords.some(kw => lower.includes(kw))) {
      processor = pattern.label;
      break;
    }
  }

  let ram = 'N/D';
  const gbMatches = [...lower.matchAll(/(\d+)\s*(gb|tb)\b/ig)];
  if (gbMatches.length > 0) {
    const gbValues = gbMatches.map(m => {
      let num = parseInt(m[1]);
      if (m[2].toLowerCase() === 'tb') num *= 1024;
      return { str: m[0].toUpperCase(), val: num };
    });
    gbValues.sort((a, b) => a.val - b.val);
    ram = gbValues[0].str;
  }

  let storage = 'N/D';
  const ssdMatch = lower.includes('ssd') || lower.includes('m.2');
  const storageMatches = [...lower.matchAll(/(\d+)\s*(gb|tb)\b/ig)];
  if (storageMatches.length > 1) {
    const gbValues = storageMatches.map(m => {
      let num = parseInt(m[1]);
      if (m[2].toLowerCase() === 'tb') num *= 1024;
      return { str: m[0].toUpperCase(), val: num };
    });
    gbValues.sort((a, b) => a.val - b.val);
    storage = gbValues[1].str + (ssdMatch ? ' SSD' : '');
  } else {
    if (lower.includes('ssd') || lower.includes('m.2') || lower.includes('disco')) {
      const storageOnlyMatch = lower.match(/(\d+)\s*(gb|tb)\b/i);
      if (storageOnlyMatch) storage = storageOnlyMatch[0].toUpperCase() + ' SSD';
    }
  }

  let screen = 'N/D';
  const screenMatch = lower.match(/(\d+(?:\.\d+)?)\s*(inch|pulg|"|")/i);
  if (screenMatch) {
    screen = screenMatch[1] + '"';
  }

  let os = 'Windows 11';
  if (lower.includes('macos') || lower.includes('mac os') || lower.includes('apple mac')) {
    os = 'macOS';
  } else if (lower.includes('freedos') || lower.includes('free dos') || lower.includes('free-dos')) {
    os = 'FreeDOS';
  } else if (lower.includes('win11-pro') || lower.includes('win11 pro') || lower.includes('w11-pro') || lower.includes('w11pro')) {
    os = 'Windows 11 Pro';
  }

  let color = 'N/D';
  for (const ck of COLOR_KEYWORDS) {
    if (lower.includes(ck)) {
      color = ck.charAt(0).toUpperCase() + ck.slice(1);
      break;
    }
  }

  return { processor, ram, storage, screen, os, color };
}

function enrichProduct(product) {
  const brand = parseBrand(product.nombre);
  const specs = parseSpecs(product.nombre);
  const pricing = calculatePricing(product.precio);
  const dateOnly = product.ultima_actualizacion
    ? product.ultima_actualizacion.split(' ')[0]
    : '';

  return {
    ...product,
    brand,
    specs,
    pricing,
    dateOnly,
  };
}

async function filterProducts(options = {}) {
  const {
    search = '',
    brands = [],
    minPrice = 0,
    maxPrice = Infinity,
    sort = 'relevancia',
    page = 1,
    limit = SERVER_CONFIG.DEFAULT_PAGE_SIZE,
    category = 'laptops',
  } = options;

  let products = await getAllProducts(category);

  if (search || brands.length > 0 || minPrice > 0 || maxPrice < Infinity) {
    const searchLower = search.toLowerCase();
    products = products.filter(p => {
      const name = (p.nombre || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const brand = parseBrand(p.nombre);
      const matchesSearch = !search ||
        name.includes(searchLower) ||
        sku.includes(searchLower) ||
        brand.toLowerCase().includes(searchLower);
      const matchesBrand = brands.length === 0 || brands.includes(brand);
      const price = p.precio || 0;
      const matchesPrice = price >= minPrice && price <= maxPrice;
      return matchesSearch && matchesBrand && matchesPrice;
    });
  }

  const total = products.length;

  switch (sort) {
    case 'precio-asc':
      products.sort((a, b) => (a.precio || 0) - (b.precio || 0));
      break;
    case 'precio-desc':
      products.sort((a, b) => (b.precio || 0) - (a.precio || 0));
      break;
    case 'recientes':
      products.sort((a, b) => new Date(b.ultima_actualizacion) - new Date(a.ultima_actualizacion));
      break;
    default:
      products.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
      break;
  }

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), SERVER_CONFIG.MAX_PAGE_SIZE);
  const totalPages = Math.ceil(total / safeLimit);
  const startIndex = (safePage - 1) * safeLimit;
  const paginatedProducts = products.slice(startIndex, startIndex + safeLimit);
  const enrichedProducts = paginatedProducts.map(enrichProduct);

  return {
    products: enrichedProducts,
    total,
    page: safePage,
    totalPages,
    limit: safeLimit,
  };
}

async function getBrandCounts(category = 'laptops') {
  const products = await getAllProducts(category);
  const brandCounts = {};

  products.forEach(p => {
    const brand = parseBrand(p.nombre);
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  });

  return Object.entries(brandCounts)
    .map(([brand, count]) => ({ brand, count }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

async function getRelatedProducts(sku, limitResults = SERVER_CONFIG.MAX_RELATED_PRODUCTS, category = 'laptops') {
  const allProducts = await getAllProducts(category);
  const currentProduct = allProducts.find(p => p.sku === sku);

  if (!currentProduct) return [];

  const brand = parseBrand(currentProduct.nombre);
  let related = allProducts.filter(p => p.sku !== sku);

  const sameBrand = related.filter(p => parseBrand(p.nombre) === brand);

  if (sameBrand.length >= limitResults / 2) {
    related = sameBrand;
  } else {
    const priceMin = currentProduct.precio * 0.8;
    const priceMax = currentProduct.precio * 1.2;
    const similarPrice = related.filter(p => p.precio >= priceMin && p.precio <= priceMax);

    const combined = [...sameBrand, ...similarPrice];
    related = combined.filter((item, idx) => combined.findIndex(x => x.sku === item.sku) === idx);
  }

  related = related.sort(() => 0.5 - Math.random()).slice(0, limitResults);
  return related.map(enrichProduct);
}

async function getPriceRange(category = 'laptops') {
  const products = await getAllProducts(category);
  const prices = products
    .map(p => p.precio)
    .filter(p => typeof p === 'number' && p > 0);

  if (prices.length === 0) return { min: 0, max: 3000 };

  return {
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
  };
}

module.exports = {
  parseBrand,
  parseSpecs,
  enrichProduct,
  filterProducts,
  getBrandCounts,
  getRelatedProducts,
  getPriceRange,
};
