/**
 * product.js — Lógica de Detalle de Producto para Tienda Gamer EC
 * 
 * SIMPLIFICADO: Solo renderiza datos que vienen enriquecidos del API.
 * Toda la lógica de negocio (parseBrand, parseSpecs, pricing) 
 * ahora vive en el backend: src/services/productService.js
 */

const laptopPlaceholderBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjNkI3MjgwIiBzdHJva2Utd2lkdGg9IjEuMiI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNOSAxNy4yNXYxLjAwN2EzIDMgMCAwIDEtLjg3OSAyLjEyMkw3LjUgMjFoOWwtLjYyMS0uNjIxQTMgMyAwIDAgMSAxNSAxOC4yNTdWMTcuMjVtNi0xMlYxNWEyLjI1IDIuMjUgMCAwIDEtMi4yNSAyLjI1SDUuMjVBMi4yNSAyLjI1IDAgMCAxIDMgMTVWNS4yNW0xOCAwQTIuMjUgMi4yNSAwIDAgMCAxOC43NSAzSDUuMjVBMi4yNSAyLjI1IDAgMCAwIDMgNS4yNW0xOCAwVjEyYTIuMjUgMi4yNSAwIDAgMS0yLjI1IDIuMjVINS4yNUEyLjI1IDIuMjUgMCAwIDEgMyAxMlY1LjI1IiAvPjwvc3ZnPg==';

const CATEGORY_MAP = {
  laptops: { api: '/api/products', name: 'Laptops', url: '/laptops.html' },
  desktops: { api: '/api/desktops', name: 'PC de Escritorio', url: '/computadoras.html' },
  minipcs: { api: '/api/minipcs', name: 'Mini PCs', url: '/minipcs.html' },
  motherboards: { api: '/api/motherboards', name: 'Motherboards', url: '/motherboard.html' },
  procesadores: { api: '/api/components/procesadores', name: 'Procesadores', url: '/catalogo.html?cat=procesadores' },
  'tarjetas-video': { api: '/api/components/tarjetas-video', name: 'Tarjetas de Video', url: '/catalogo.html?cat=tarjetas-video' },
  fuentes: { api: '/api/components/fuentes', name: 'Fuentes de Poder', url: '/catalogo.html?cat=fuentes' },
  coolers: { api: '/api/components/coolers', name: 'Coolers y Enfriamiento', url: '/catalogo.html?cat=coolers' },
  almacenamiento: { api: '/api/components/almacenamiento', name: 'Almacenamiento', url: '/catalogo.html?cat=almacenamiento' },
  ram: { api: '/api/components/ram', name: 'Memorias RAM', url: '/catalogo.html?cat=ram' },
  cases: { api: '/api/components/cases', name: 'Cases y Gabinetes', url: '/catalogo.html?cat=cases' },
  ventiladores: { api: '/api/components/ventiladores', name: 'Ventiladores', url: '/catalogo.html?cat=ventiladores' },
  monitores: { api: '/api/monitors', name: 'Monitores', url: '/monitores.html' },
  'gaming-monitores': { api: '/api/gaming-monitors', name: 'Gaming Monitores', url: '/gaming-monitores.html' },
};
const DEFAULT_CATEGORY = 'laptops';

// Estado del Producto actual
let currentProduct = null;
let currentQuantity = 1;

// Elementos DOM
const productDetailDisplay = document.getElementById('product-detail-display');
const breadcrumbDisplay = document.getElementById('breadcrumb-display');
const breadcrumbCurrent = document.getElementById('breadcrumb-current');

// Elementos del producto
const imgProduct = document.getElementById('product-detail-image');
const imgBrandBadge = document.getElementById('product-detail-brand');
const labelSku = document.getElementById('product-detail-sku');
const titleProduct = document.getElementById('product-detail-title');
const priceRefProduct = document.getElementById('product-detail-price-ref');
const priceProduct = document.getElementById('product-detail-price');
const dateSyncProduct = document.getElementById('product-detail-sync-date');
const quickSpecsContainer = document.getElementById('quick-specs-container');
const specsTable = document.getElementById('product-specs-table');
const relatedProductsGrid = document.getElementById('related-products-grid');
const thumbnailsRow = document.getElementById('thumbnails-row');

// Botones de Acción
const btnQtyMinus = document.getElementById('btn-qty-minus');
const btnQtyPlus = document.getElementById('btn-qty-plus');
const qtyInput = document.getElementById('qty-input');
const btnAddToCartDetail = document.getElementById('btn-add-to-cart-detail');
const btnOriginDetail = document.getElementById('btn-origin-detail');
const btnShareProduct = document.getElementById('btn-share-product');

// Elementos de Tabs
const tabBtnSpecs = document.getElementById('tab-btn-specs');
const tabBtnReviews = document.getElementById('tab-btn-reviews');
const tabBtnShipping = document.getElementById('tab-btn-shipping');
const tabPanelSpecs = document.getElementById('tab-panel-specs');
const tabPanelReviews = document.getElementById('tab-panel-reviews');
const tabPanelShipping = document.getElementById('tab-panel-shipping');

window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sku = urlParams.get('sku');
  const cat = urlParams.get('cat') || DEFAULT_CATEGORY;

  if (!sku) {
    render404('SKU de producto no especificado');
    return;
  }

  fetchProductDetail(sku, cat);
  setupTabs();
  setupQuantityPicker();
  setupShareButton();
});

// ============================================================
// 1. FETCH DESDE EL API (datos ya enriquecidos)
// ============================================================

async function fetchProductDetail(sku, cat) {
  try {
    const catInfo = CATEGORY_MAP[cat] || CATEGORY_MAP[DEFAULT_CATEGORY];
    let response;

    if (cat === DEFAULT_CATEGORY) {
      response = await fetch(`${catInfo.api}/${sku}`);
    } else {
      response = await fetch(`${catInfo.api}/product/${sku}`);
    }

    if (!response.ok) {
      if (response.status === 404) {
        render404('Producto no encontrado en nuestra base de datos local');
      } else {
        throw new Error('Error al obtener datos');
      }
      return;
    }
    currentProduct = await response.json();
    currentProduct._category = cat;

    renderProductDetail();
    fetchRelatedProducts(sku);
  } catch (error) {
    console.error('Error fetching product detail:', error);
    render404('Error de conexión al cargar la información del producto');
  }
}

// ============================================================
// 2. RENDERIZADO (solo presentación, datos ya procesados)
// ============================================================

function renderProductDetail() {
  const p = currentProduct;
  // Los datos brand, specs y pricing ya vienen del backend
  const brand = p.brand;
  const specs = p.specs;
  const pricing = p.pricing;

  const cat = p._category || DEFAULT_CATEGORY;
  const catInfo = CATEGORY_MAP[cat] || CATEGORY_MAP[DEFAULT_CATEGORY];

  breadcrumbCurrent.textContent = p.nombre;
  breadcrumbDisplay.innerHTML = `
    <a href="/">Inicio</a> &gt; 
    <a href="${catInfo.url}?search=${brand}">${catInfo.name}</a> &gt; 
    <a href="${catInfo.url}?search=${brand}">${brand}</a> &gt; 
    <span style="color:var(--text-secondary);">${p.nombre}</span>
  `;

  // B. Imagen y Badge de Marca
  if (p.imagen_url) {
    imgProduct.src = p.imagen_url;
    imgProduct.onerror = () => {
      imgProduct.src = laptopPlaceholderBase64;
    };
  } else {
    imgProduct.src = laptopPlaceholderBase64;
  }
  imgBrandBadge.textContent = brand;
  imgBrandBadge.href = `${catInfo.url}?search=${brand}`;

  // Miniatura única
  thumbnailsRow.innerHTML = `
    <div class="thumbnail-box">
      <img src="${p.imagen_url || laptopPlaceholderBase64}" alt="Miniatura">
    </div>
  `;

  // C. Títulos, SKU, Fechas
  labelSku.textContent = `SKU: ${p.sku}`;
  titleProduct.textContent = p.nombre;
  
  if (p.ultima_actualizacion) {
    dateSyncProduct.textContent = `Precio sincronizado el ${p.ultima_actualizacion}`;
  } else {
    dateSyncProduct.textContent = 'Precio sincronizado hoy';
  }

  // D. Precios (ya calculados por el backend)
  priceProduct.textContent = pricing.priceFormatted;
  priceRefProduct.textContent = pricing.referencePriceFormatted;

  // E. Botón Destino Tecnomegastore
  btnOriginDetail.href = p.url;

  // F. Agregar al carrito
  btnAddToCartDetail.onclick = () => {
    const qty = parseInt(qtyInput.value) || 1;
    for (let i = 0; i < qty; i++) {
      window.addToCart(p.sku, p.nombre, p.precio, p.imagen_url || '', p.url);
    }
    window.showToast(`¡Añadido al carrito: ${qty} unidad(es)!`);
  };

  // G. Render Specs Rápidas (datos del backend)
  let quickSpecsHtml = '';
  if (specs.type === 'processor') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" /></svg>
        <span><strong>Modelo:</strong> ${specs.model}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V12M12 12L7 7M12 12l5-5M20 12H4" /></svg>
        <span><strong>Socket:</strong> ${specs.socket}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
        <span><strong>Núcleos / Hilos:</strong> ${specs.cores}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <span><strong>Frecuencia:</strong> ${specs.frequency}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        <span><strong>TDP:</strong> ${specs.tdp}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        <span><strong>Caché:</strong> ${specs.cache}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2M8 12h8" /></svg>
        <span><strong>Disipador:</strong> ${specs.cooler}</span>
      </div>
    `;
  } else if (specs.type === 'gpu') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /></svg>
        <span><strong>GPU:</strong> ${specs.gpu}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>
        <span><strong>Memoria VRAM:</strong> ${specs.vram}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><path d="M8 21h8M12 17v4" /></svg>
        <span><strong>Tipo Memoria:</strong> ${specs.memType}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2M8 12h8" /></svg>
        <span><strong>Ancho Bus:</strong> ${specs.bus}</span>
      </div>
    `;
  } else if (specs.type === 'motherboard') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" /></svg>
        <span><strong>Socket:</strong> ${specs.socket}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V12M12 12L7 7M12 12l5-5M20 12H4" /></svg>
        <span><strong>Chipset:</strong> ${specs.chipset}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4a2 2 0 012-2h12a2 2 0 012 2v3M4 17v3a2 2 0 002 2h12a2 2 0 002-2v-3M4 7h16M4 17h16M4 12h16" /></svg>
        <span><strong>Memoria RAM:</strong> ${specs.memType}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
        <span><strong>Factor Forma:</strong> ${specs.formFactor}</span>
      </div>
    `;
  } else if (specs.type === 'ram') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>
        <span><strong>Capacidad:</strong> ${specs.capacity}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4a2 2 0 012-2h12a2 2 0 012 2v3M4 17v3a2 2 0 002 2h12a2 2 0 002-2v-3M4 7h16M4 17h16M4 12h16" /></svg>
        <span><strong>Tipo Memoria:</strong> ${specs.memType}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <span><strong>Velocidad:</strong> ${specs.speed}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
        <span><strong>Formato:</strong> ${specs.format}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
        <span><strong>Módulos (Kit):</strong> ${specs.kit}</span>
      </div>
    `;
  } else if (specs.type === 'storage') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>
        <span><strong>Capacidad:</strong> ${specs.capacity}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        <span><strong>Tipo:</strong> ${specs.type}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
        <span><strong>Formato / Interfaz:</strong> ${specs.formFactor}</span>
      </div>
    `;
  } else if (specs.type === 'power_supply') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
        <span><strong>Potencia:</strong> ${specs.power}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        <span><strong>Certificación:</strong> ${specs.certification}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
        <span><strong>Cables (Modular):</strong> ${specs.modular}</span>
      </div>
    `;
  } else if (specs.type === 'case') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /></svg>
        <span><strong>Formato:</strong> ${specs.formFactor}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
        <span><strong>Ventilación:</strong> ${specs.fans}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        <span><strong>Color:</strong> ${specs.color}</span>
      </div>
    `;
  } else if (specs.type === 'cooling') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
        <span><strong>Tipo Cooler:</strong> ${specs.type}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <span><strong>Tamaño Ventilador:</strong> ${specs.size}</span>
      </div>
    `;
  } else if (specs.type === 'monitor') {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><path d="M8 21h8M12 17v4" /></svg>
        <span><strong>Diagonal Pantalla:</strong> ${specs.size}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>
        <span><strong>Resolución Máxima:</strong> ${specs.resolution}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        <span><strong>Tasa Refresco:</strong> ${specs.refresh}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        <span><strong>Panel:</strong> ${specs.panel}</span>
      </div>
    `;
  } else {
    quickSpecsHtml = `
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
        <span><strong>Procesador:</strong> ${specs.processor}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4a2 2 0 012-2h12a2 2 0 012 2v3M4 17v3a2 2 0 002 2h12a2 2 0 002-2v-3M4 7h16M4 17h16M4 12h16" /></svg>
        <span><strong>RAM:</strong> ${specs.ram}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>
        <span><strong>Almacenamiento:</strong> ${specs.storage}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><path d="M8 21h8M12 17v4" /></svg>
        <span><strong>Pantalla:</strong> ${specs.screen}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
        <span><strong>Sistema Operativo:</strong> ${specs.os}</span>
      </div>
      <div class="quick-spec-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        <span><strong>Color:</strong> ${specs.color}</span>
      </div>
    `;
  }
  quickSpecsContainer.innerHTML = quickSpecsHtml;

  // H. Render Specs Tabla Completa (Tab 1)
  let tableHtml = `
    <tr>
      <td class="spec-name">Característica</td>
      <td class="spec-val" style="font-weight:600;color:var(--text-primary);">Detalle Técnico</td>
    </tr>
  `;
  if (specs.type === 'processor') {
    tableHtml += `
      <tr><td class="spec-name">Modelo / Familia</td><td class="spec-val">${specs.model}</td></tr>
      <tr><td class="spec-name">Zócalo (Socket)</td><td class="spec-val">${specs.socket}</td></tr>
      <tr><td class="spec-name">Núcleos / Hilos</td><td class="spec-val">${specs.cores}</td></tr>
      <tr><td class="spec-name">Frecuencia de Reloj</td><td class="spec-val">${specs.frequency}</td></tr>
      <tr><td class="spec-name">Memoria Caché</td><td class="spec-val">${specs.cache}</td></tr>
      <tr><td class="spec-name">TDP (Consumo)</td><td class="spec-val">${specs.tdp}</td></tr>
      <tr><td class="spec-name">Disipador Térmico</td><td class="spec-val">${specs.cooler}</td></tr>
    `;
  } else if (specs.type === 'gpu') {
    tableHtml += `
      <tr><td class="spec-name">Procesador Gráfico (GPU)</td><td class="spec-val">${specs.gpu}</td></tr>
      <tr><td class="spec-name">Memoria VRAM</td><td class="spec-val">${specs.vram}</td></tr>
      <tr><td class="spec-name">Tipo de Memoria</td><td class="spec-val">${specs.memType}</td></tr>
      <tr><td class="spec-name">Ancho de Bus</td><td class="spec-val">${specs.bus}</td></tr>
    `;
  } else if (specs.type === 'motherboard') {
    tableHtml += `
      <tr><td class="spec-name">Zócalo (Socket)</td><td class="spec-val">${specs.socket}</td></tr>
      <tr><td class="spec-name">Chipset de Placa</td><td class="spec-val">${specs.chipset}</td></tr>
      <tr><td class="spec-name">Tipo de Memoria Soportada</td><td class="spec-val">${specs.memType}</td></tr>
      <tr><td class="spec-name">Factor de Forma</td><td class="spec-val">${specs.formFactor}</td></tr>
    `;
  } else if (specs.type === 'ram') {
    tableHtml += `
      <tr><td class="spec-name">Capacidad Total</td><td class="spec-val">${specs.capacity}</td></tr>
      <tr><td class="spec-name">Tipo de Memoria</td><td class="spec-val">${specs.memType}</td></tr>
      <tr><td class="spec-name">Frecuencia / Velocidad</td><td class="spec-val">${specs.speed}</td></tr>
      <tr><td class="spec-name">Formato de Módulo</td><td class="spec-val">${specs.format}</td></tr>
      <tr><td class="spec-name">Distribución (Kit)</td><td class="spec-val">${specs.kit}</td></tr>
    `;
  } else if (specs.type === 'storage') {
    tableHtml += `
      <tr><td class="spec-name">Capacidad</td><td class="spec-val">${specs.capacity}</td></tr>
      <tr><td class="spec-name">Tipo de Almacenamiento</td><td class="spec-val">${specs.type}</td></tr>
      <tr><td class="spec-name">Factor de Forma / Interfaz</td><td class="spec-val">${specs.formFactor}</td></tr>
    `;
  } else if (specs.type === 'power_supply') {
    tableHtml += `
      <tr><td class="spec-name">Potencia Nominal</td><td class="spec-val">${specs.power}</td></tr>
      <tr><td class="spec-name">Certificación de Eficiencia</td><td class="spec-val">${specs.certification}</td></tr>
      <tr><td class="spec-name">Diseño de Cables (Modular)</td><td class="spec-val">${specs.modular}</td></tr>
    `;
  } else if (specs.type === 'case') {
    tableHtml += `
      <tr><td class="spec-name">Factor de Forma de Gabinete</td><td class="spec-val">${specs.formFactor}</td></tr>
      <tr><td class="spec-name">Ventilación Incluida</td><td class="spec-val">${specs.fans}</td></tr>
      <tr><td class="spec-name">Color de Chasis</td><td class="spec-val">${specs.color}</td></tr>
    `;
  } else if (specs.type === 'cooling') {
    tableHtml += `
      <tr><td class="spec-name">Tipo de Disipador</td><td class="spec-val">${specs.type}</td></tr>
      <tr><td class="spec-name">Diámetro / Tamaño del Ventilador</td><td class="spec-val">${specs.size}</td></tr>
    `;
  } else if (specs.type === 'monitor') {
    tableHtml += `
      <tr><td class="spec-name">Tamaño de Pantalla</td><td class="spec-val">${specs.size}</td></tr>
      <tr><td class="spec-name">Resolución de Pantalla</td><td class="spec-val">${specs.resolution}</td></tr>
      <tr><td class="spec-name">Tasa de Refresco</td><td class="spec-val">${specs.refresh}</td></tr>
      <tr><td class="spec-name">Tipo de Panel</td><td class="spec-val">${specs.panel}</td></tr>
    `;
  } else {
    tableHtml += `
      <tr><td class="spec-name">Procesador</td><td class="spec-val">${specs.processor}</td></tr>
      <tr><td class="spec-name">Memoria RAM</td><td class="spec-val">${specs.ram}</td></tr>
      <tr><td class="spec-name">Capacidad de Disco</td><td class="spec-val">${specs.storage}</td></tr>
      <tr><td class="spec-name">Diagonal de Pantalla</td><td class="spec-val">${specs.screen}</td></tr>
      <tr><td class="spec-name">Sistema Operativo</td><td class="spec-val">${specs.os}</td></tr>
      <tr><td class="spec-name">Color de Chasis</td><td class="spec-val">${specs.color}</td></tr>
    `;
  }
  tableHtml += `
    <tr>
      <td class="spec-name">Identificador SKU</td>
      <td class="spec-val" style="font-family:monospace;">${p.sku}</td>
    </tr>
  `;
  specsTable.innerHTML = tableHtml;
}

// ============================================================
// 3. PRODUCTOS RELACIONADOS (del backend)
// ============================================================

async function fetchRelatedProducts(sku) {
  try {
    const cat = (currentProduct && currentProduct._category) || DEFAULT_CATEGORY;
    const catInfo = CATEGORY_MAP[cat] || CATEGORY_MAP[DEFAULT_CATEGORY];
    const relatedEndpoint = cat === DEFAULT_CATEGORY
      ? `${catInfo.api}/${sku}/related`
      : `${catInfo.api}/product/${sku}/related`;
    const response = await fetch(relatedEndpoint);
    if (!response.ok) return;
    const related = await response.json();

    if (related.length === 0) {
      relatedProductsGrid.innerHTML = '<p style="color:var(--text-secondary);">No hay productos relacionados disponibles.</p>';
      return;
    }

    relatedProductsGrid.innerHTML = related.map(p => {
      // Datos ya enriquecidos del backend
      const formattedPrice = p.pricing.priceFormatted;
      const brand = p.brand;

      const imgHtml = `<img src="${p.imagen_url || laptopPlaceholderBase64}" alt="${p.nombre}" loading="lazy" onerror="this.src='${laptopPlaceholderBase64}';this.onerror=null;">`;

      return `
        <div class="grid-card" style="width:260px;margin-bottom:0;">
          <div class="card-image-wrapper">
            <span class="brand-badge">${brand}</span>
            <a href="/product.html?sku=${p.sku}&cat=${cat}">${imgHtml}</a>
          </div>
          <div class="card-sku">${p.sku}</div>
          <h3 class="card-title" title="${p.nombre}">
            <a href="/product.html?sku=${p.sku}&cat=${cat}">${p.nombre}</a>
          </h3>
          <div class="card-price-row">
            <div class="card-price">${formattedPrice}</div>
          </div>
          <div class="card-actions-wrapper">
            <button class="btn-primary-cart" onclick="addToCart('${p.sku}', '${p.nombre.replace(/'/g, "\\'")}', ${p.precio}, '${p.imagen_url || ''}')">
              Agregar al carrito
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Error fetching related products:', e);
  }
}

// ============================================================
// 4. UI HELPERS
// ============================================================

function setupTabs() {
  const switchTab = (activeBtn, activePanel) => {
    [tabBtnSpecs, tabBtnReviews, tabBtnShipping].forEach(btn => btn.classList.remove('active'));
    [tabPanelSpecs, tabPanelReviews, tabPanelShipping].forEach(panel => panel.classList.remove('active'));

    activeBtn.classList.add('active');
    activePanel.classList.add('active');
  };

  tabBtnSpecs.addEventListener('click', () => switchTab(tabBtnSpecs, tabPanelSpecs));
  tabBtnReviews.addEventListener('click', () => switchTab(tabBtnReviews, tabPanelReviews));
  tabBtnShipping.addEventListener('click', () => switchTab(tabBtnShipping, tabPanelShipping));
}

function setupQuantityPicker() {
  btnQtyMinus.addEventListener('click', () => {
    if (currentQuantity > 1) {
      currentQuantity--;
      qtyInput.value = currentQuantity;
    }
  });

  btnQtyPlus.addEventListener('click', () => {
    currentQuantity++;
    qtyInput.value = currentQuantity;
  });
}

function setupShareButton() {
  btnShareProduct.addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      window.showToast('¡Enlace copiado al portapapeles!');
    }).catch(err => {
      console.error('Error al copiar enlace:', err);
      const dummy = document.createElement('input');
      document.body.appendChild(dummy);
      dummy.value = url;
      dummy.select();
      document.execCommand('copy');
      document.body.removeChild(dummy);
      window.showToast('¡Enlace copiado al portapapeles!');
    });
  });
}

function render404(message) {
  productDetailDisplay.style.display = 'block';
  productDetailDisplay.innerHTML = `
    <div class="empty-catalog-state" style="padding: 6rem 2rem;">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:56px;height:56px;color:var(--danger);opacity:0.8;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h2 style="font-weight:700;margin-top:1rem;color:var(--text-primary);">${message}</h2>
      <p style="margin-bottom:1.5rem;">El SKU consultado puede estar inactivo o haber sido removido.</p>
      <a href="/" class="btn-checkout-drawer" style="padding:0.75rem 2rem;display:inline-block;width:auto;text-decoration:none;">← Volver al catálogo principal</a>
    </div>
  `;
  breadcrumbCurrent.textContent = 'Producto no disponible';
}
