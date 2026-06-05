/**
 * monitores.js — Lógica de catálogo de monitores para Tienda Gamer EC
 * 
 * SIMPLIFICADO: Solo renderiza datos que vienen enriquecidos del backend.
 * Endpoint: /api/monitors
 */

let selectedBrands = [];
let minPrice = 0;
let maxPrice = 3000;
let minPriceLimit = 0;
let maxPriceLimit = 3000;
let searchQuery = '';
let currentSort = 'relevancia';
let itemsPerPage = 12;
let currentPage = 1;
let currentView = 'grid';

let currentResponse = null;

const productsDisplayGrid = document.getElementById('products-display-grid');
const productsCountText = document.getElementById('products-count-text');
const itemsPerPageSelect = document.getElementById('items-per-page-select');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');
const paginationDisplay = document.getElementById('pagination-display');
const searchBox = document.getElementById('search-box');
const btnClearFilters = document.getElementById('btn-clear-filters');
const brandsCheckboxList = document.getElementById('brands-checkbox-list');

const sliderThumbMin = document.getElementById('slider-thumb-min');
const sliderThumbMax = document.getElementById('slider-thumb-max');
const priceTrackHighlight = document.getElementById('price-track-highlight');
const priceInputMin = document.getElementById('price-input-min');
const priceInputMax = document.getElementById('price-input-max');

const brandHeader = document.getElementById('filter-brand-header');
const priceHeader = document.getElementById('filter-price-header');
const sortHeader = document.getElementById('filter-sort-header');
const brandContent = document.getElementById('filter-brand-content');
const priceContent = document.getElementById('filter-price-content');
const sortContent = document.getElementById('filter-sort-content');

const API_BASE = '/api/monitors';

window.addEventListener('DOMContentLoaded', () => {
  setupCollapsibles();
  setupViewToggle();
  setupSearch();
  setupPaginationControls();
  setupPriceSlider();
  setupSortOrder();
  setupClearFilters();

  fetchPriceRange();
  fetchBrands();
  fetchProducts();

  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get('search');
  if (searchParam) {
    searchQuery = searchParam;
    searchBox.value = searchParam;
  }
});

async function fetchProducts() {
  try {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedBrands.length > 0) params.set('brands', selectedBrands.join(','));
    if (minPrice > minPriceLimit) params.set('minPrice', minPrice);
    if (maxPrice < maxPriceLimit) params.set('maxPrice', maxPrice);
    params.set('sort', currentSort);
    params.set('page', currentPage);
    params.set('limit', itemsPerPage);

    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');

    currentResponse = await response.json();

    productsCountText.textContent = currentResponse.total;
    renderCatalogPage(currentResponse.products);
    renderPagination(currentResponse.totalPages);
  } catch (error) {
    console.error('Error fetching monitors:', error);
    productsDisplayGrid.innerHTML = `
      <div class="empty-catalog-state">
        <p style="color:var(--danger);font-weight:600;">Error al conectar con la base de datos local</p>
        <p>Por favor, asegúrate de que el servidor está corriendo e intenta de nuevo.</p>
      </div>
    `;
  }
}

async function fetchPriceRange() {
  try {
    const response = await fetch(`${API_BASE}/price-range`);
    if (!response.ok) return;
    const range = await response.json();

    minPriceLimit = range.min;
    maxPriceLimit = range.max;
    minPrice = range.min;
    maxPrice = range.max;

    priceInputMin.value = minPrice;
    priceInputMin.min = minPriceLimit;
    priceInputMin.max = maxPriceLimit;
    priceInputMax.value = maxPrice;
    priceInputMax.min = minPriceLimit;
    priceInputMax.max = maxPriceLimit;

    updateSliderVisuals();
  } catch (error) {
    console.error('Error fetching price range:', error);
  }
}

async function fetchBrands() {
  try {
    const response = await fetch(`${API_BASE}/brands`);
    if (!response.ok) return;
    const brands = await response.json();
    renderBrandCheckboxes(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
  }
}

function renderCatalogPage(products) {
  if (!products || products.length === 0) {
    productsDisplayGrid.className = 'products-grid';
    productsDisplayGrid.innerHTML = `
      <div class="empty-catalog-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No se encontraron productos que coincidan con los filtros seleccionados.</p>
      </div>
    `;
    return;
  }

  const isGrid = currentView === 'grid';
  productsDisplayGrid.className = isGrid ? 'products-grid' : 'products-list';

  const placeholderBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjNkI3MjgwIiBzdHJva2Utd2lkdGg9IjEuMiI+PHJlY3QgeD0iMiIgeT0iMyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjE0IiByeD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNOCAyMWg4TTEyIDE3djQiLz48L3N2Zz4=';

  productsDisplayGrid.innerHTML = products.map(p => {
    const formattedPrice = p.pricing.priceFormatted;
    const dateOnly = p.dateOnly;
    const brand = p.brand;
    const specs = p.specs;

    const imageElement = `<img src="${p.imagen_url || placeholderBase64}" alt="${p.nombre}" loading="lazy" onerror="this.src='${placeholderBase64}';this.onerror=null;">`;

    if (isGrid) {
      return `
        <div class="grid-card">
          <div class="card-image-wrapper">
            <span class="brand-badge">${brand}</span>
            <a href="/product.html?sku=${p.sku}&cat=monitores">${imageElement}</a>
          </div>
          <div class="card-sku">${p.sku}</div>
          <h3 class="card-title" title="${p.nombre}">
            <a href="/product.html?sku=${p.sku}&cat=monitores">${p.nombre}</a>
          </h3>
          
          <div class="stock-indicator">
            <span class="stock-dot in"></span>
            <span class="stock-text in">En stock</span>
          </div>

          <div class="sync-date-text">Actualizado: ${dateOnly}</div>

          <div class="card-price-row">
            <div class="card-price">${formattedPrice}</div>
          </div>

          <div class="card-actions-wrapper">
            <button class="btn-primary-cart" onclick="addToCart('${p.sku}', '${p.nombre.replace(/'/g, "\\'")}', ${p.precio}, '${p.imagen_url || ''}')">
              Agregar al carrito
            </button>
            <a href="https://tecnomegastore.ec/product/laptop?code=${p.sku}" target="_blank" rel="noopener" class="btn-secondary-link">
              Ver en tienda →
            </a>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="list-card">
          <div class="card-image-wrapper">
            <span class="brand-badge">${brand}</span>
            <a href="/product.html?sku=${p.sku}&cat=monitores">${imageElement}</a>
          </div>
          <div class="list-card-details">
            <div class="card-sku">${p.sku}</div>
            <h3 class="card-title" title="${p.nombre}" style="font-size:1rem;height:auto;-webkit-line-clamp:1;margin-bottom:0.25rem;">
              <a href="/product.html?sku=${p.sku}&cat=monitores">${p.nombre}</a>
            </h3>
            
            <div class="list-specs-container">
              <span class="list-spec-tag">CPU: ${specs.processor}</span>
              <span class="list-spec-tag">RAM: ${specs.ram}</span>
              <span class="list-spec-tag">Disco: ${specs.storage}</span>
              <span class="list-spec-tag">Pantalla: ${specs.screen}</span>
              <span class="list-spec-tag">OS: ${specs.os}</span>
            </div>

            <div class="stock-indicator" style="margin-top:0.75rem;margin-bottom:0.25rem;">
              <span class="stock-dot in"></span>
              <span class="stock-text in">En stock</span>
            </div>
            
            <div class="sync-date-text" style="margin-bottom:0;">Actualizado: ${dateOnly}</div>
          </div>
          
          <div class="list-card-right">
            <div class="card-price" style="font-size:1.4rem;">${formattedPrice}</div>
            <div class="card-actions-wrapper">
              <button class="btn-primary-cart" onclick="addToCart('${p.sku}', '${p.nombre.replace(/'/g, "\\'")}', ${p.precio}, '${p.imagen_url || ''}')">
                Agregar al carrito
              </button>
              <a href="https://tecnomegastore.ec/product/laptop?code=${p.sku}" target="_blank" rel="noopener" class="btn-secondary-link">
                Ver en tienda →
              </a>
            </div>
          </div>
        </div>
      `;
    }
  }).join('');
}

function renderBrandCheckboxes(brands) {
  if (!brands || brands.length === 0) {
    brandsCheckboxList.innerHTML = '<p style="font-size:0.8rem;color:var(--text-secondary);">No se encontraron marcas.</p>';
    return;
  }

  brandsCheckboxList.innerHTML = brands.map(item => `
    <label class="checkbox-label" for="brand-${item.brand}">
      <span class="checkbox-item">
        <input type="checkbox" id="brand-${item.brand}" value="${item.brand}" ${selectedBrands.includes(item.brand) ? 'checked' : ''}>
        <span>${item.brand}</span>
      </span>
      <span class="brand-count">(${item.count})</span>
    </label>
  `).join('');

  brandsCheckboxList.querySelectorAll('input').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const val = e.target.value;
      if (e.target.checked) {
        selectedBrands.push(val);
      } else {
        selectedBrands = selectedBrands.filter(b => b !== val);
      }
      currentPage = 1;
      fetchProducts();
    });
  });
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    paginationDisplay.innerHTML = '';
    return;
  }

  let buttonsHtml = '';

  buttonsHtml += `
    <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" 
            onclick="changePage(${currentPage - 1})" 
            ${currentPage === 1 ? 'disabled' : ''} 
            aria-label="Página anterior">
      &lt;
    </button>
  `;

  const range = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - range && i <= currentPage + range)) {
      buttonsHtml += `
        <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
          ${i}
        </button>
      `;
    } else if (i === 2 && currentPage - range > 2) {
      buttonsHtml += `<span class="pagination-btn dots">...</span>`;
      i = currentPage - range - 1;
    } else if (i === totalPages - 1 && currentPage + range < totalPages - 1) {
      buttonsHtml += `<span class="pagination-btn dots">...</span>`;
      i = totalPages - 1;
    }
  }

  buttonsHtml += `
    <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" 
            onclick="changePage(${currentPage + 1})" 
            ${currentPage === totalPages ? 'disabled' : ''} 
            aria-label="Página siguiente">
      &gt;
    </button>
  `;

  paginationDisplay.innerHTML = buttonsHtml;
}

window.changePage = function (page) {
  const totalPages = currentResponse ? currentResponse.totalPages : 1;
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  fetchProducts();
  window.scrollTo({ top: 180, behavior: 'smooth' });
};

function setupCollapsibles() {
  const toggle = (header, content) => {
    header.addEventListener('click', () => {
      content.classList.toggle('hidden');
      header.classList.toggle('collapsed');
    });
  };
  toggle(brandHeader, brandContent);
  toggle(priceHeader, priceContent);
  toggle(sortHeader, sortContent);
}

function setupViewToggle() {
  viewGridBtn.addEventListener('click', () => {
    currentView = 'grid';
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    if (currentResponse) renderCatalogPage(currentResponse.products);
  });

  viewListBtn.addEventListener('click', () => {
    currentView = 'list';
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    if (currentResponse) renderCatalogPage(currentResponse.products);
  });

  itemsPerPageSelect.addEventListener('change', (e) => {
    itemsPerPage = parseInt(e.target.value);
    currentPage = 1;
    fetchProducts();
  });
}

function setupSearch() {
  let debounceTimeout;
  searchBox.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      searchQuery = e.target.value;
      currentPage = 1;
      fetchProducts();
    }, 300);
  });
}

function setupSortOrder() {
  document.querySelectorAll('input[name="sort-order"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      fetchProducts();
    });
  });
}

function setupPriceSlider() {
  const handleMinInput = () => {
    let val = parseInt(priceInputMin.value);
    if (isNaN(val)) val = minPriceLimit;
    if (val < minPriceLimit) val = minPriceLimit;
    if (val > maxPrice) val = maxPrice;
    minPrice = val;
    priceInputMin.value = val;
    updateSliderVisuals();
    currentPage = 1;
    fetchProducts();
  };

  const handleMaxInput = () => {
    let val = parseInt(priceInputMax.value);
    if (isNaN(val)) val = maxPriceLimit;
    if (val > maxPriceLimit) val = maxPriceLimit;
    if (val < minPrice) val = minPrice;
    maxPrice = val;
    priceInputMax.value = val;
    updateSliderVisuals();
    currentPage = 1;
    fetchProducts();
  };

  priceInputMin.addEventListener('change', handleMinInput);
  priceInputMax.addEventListener('change', handleMaxInput);

  let isDraggingMin = false;
  let isDraggingMax = false;

  const getPercentageFromEvent = (e) => {
    const rect = document.querySelector('.slider-track-wrapper').getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let percent = ((clientX - rect.left) / rect.width) * 100;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    return percent;
  };

  const onDragMin = (e) => {
    if (!isDraggingMin) return;
    const percent = getPercentageFromEvent(e);
    const maxPercent = parseFloat(sliderThumbMax.style.left);
    if (percent > maxPercent) return;

    sliderThumbMin.style.left = `${percent}%`;
    const priceVal = Math.round(minPriceLimit + (percent / 100) * (maxPriceLimit - minPriceLimit));
    minPrice = priceVal;
    priceInputMin.value = priceVal;

    priceTrackHighlight.style.left = `${percent}%`;
    priceTrackHighlight.style.width = `${maxPercent - percent}%`;
  };

  const onDragMax = (e) => {
    if (!isDraggingMax) return;
    const percent = getPercentageFromEvent(e);
    const minPercent = parseFloat(sliderThumbMin.style.left);
    if (percent < minPercent) return;

    sliderThumbMax.style.left = `${percent}%`;
    const priceVal = Math.round(minPriceLimit + (percent / 100) * (maxPriceLimit - minPriceLimit));
    maxPrice = priceVal;
    priceInputMax.value = priceVal;

    priceTrackHighlight.style.width = `${percent - minPercent}%`;
  };

  const stopDrag = () => {
    if (isDraggingMin || isDraggingMax) {
      isDraggingMin = false;
      isDraggingMax = false;
      currentPage = 1;
      fetchProducts();
    }
  };

  sliderThumbMin.addEventListener('mousedown', () => isDraggingMin = true);
  sliderThumbMax.addEventListener('mousedown', () => isDraggingMax = true);
  sliderThumbMin.addEventListener('touchstart', () => isDraggingMin = true);
  sliderThumbMax.addEventListener('touchstart', () => isDraggingMax = true);

  window.addEventListener('mousemove', (e) => {
    if (isDraggingMin) onDragMin(e);
    if (isDraggingMax) onDragMax(e);
  });

  window.addEventListener('touchmove', (e) => {
    if (isDraggingMin) onDragMin(e);
    if (isDraggingMax) onDragMax(e);
  });

  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('touchend', stopDrag);
}

function updateSliderVisuals() {
  const range = maxPriceLimit - minPriceLimit;
  const minPercent = range === 0 ? 0 : ((minPrice - minPriceLimit) / range) * 100;
  const maxPercent = range === 0 ? 100 : ((maxPrice - minPriceLimit) / range) * 100;

  sliderThumbMin.style.left = `${minPercent}%`;
  sliderThumbMax.style.left = `${maxPercent}%`;

  priceTrackHighlight.style.left = `${minPercent}%`;
  priceTrackHighlight.style.width = `${maxPercent - minPercent}%`;
}

function setupClearFilters() {
  btnClearFilters.addEventListener('click', () => {
    searchQuery = '';
    searchBox.value = '';

    selectedBrands = [];
    document.querySelectorAll('#brands-checkbox-list input').forEach(cb => cb.checked = false);

    minPrice = minPriceLimit;
    maxPrice = maxPriceLimit;
    priceInputMin.value = minPriceLimit;
    priceInputMax.value = maxPriceLimit;
    updateSliderVisuals();

    currentSort = 'relevancia';
    const radioDefault = document.querySelector('input[name="sort-order"][value="relevancia"]');
    if (radioDefault) radioDefault.checked = true;

    currentPage = 1;
    fetchProducts();
  });
}

function setupPaginationControls() {
}
