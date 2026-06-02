/**
 * admin.js — Lógica de panel admin de NoteStore Ecuador
 * 
 * SIMPLIFICADO: La autenticación ahora es exclusivamente server-side.
 * El scraping devuelve JSON en vez de HTML.
 */

async function fetchLastProducts() {
  try {
    const response = await fetch('/api/products/all');
    if (!response.ok) return;
    const products = await response.json();

    // Ordenar descendente por la fecha de última actualización
    products.sort((a, b) => {
      return new Date(b.ultima_actualizacion) - new Date(a.ultima_actualizacion);
    });

    const latest = products.slice(0, 5);
    const tbody = document.getElementById('last-products-tbody');
    
    if (latest.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted);">
            No hay laptops registradas en la base de datos.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = latest.map(p => {
      const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.precio);
      return `
        <tr>
          <td class="sku">${p.sku}</td>
          <td style="color:#ffffff;">${p.nombre}</td>
          <td class="price">${formattedPrice}</td>
          <td>${p.ultima_actualizacion}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Error al cargar últimos productos actualizados:', error);
  }
}

async function fetchLastDesktops() {
  try {
    const response = await fetch('/api/desktops/all');
    if (!response.ok) return;
    const products = await response.json();

    products.sort((a, b) => new Date(b.ultima_actualizacion) - new Date(a.ultima_actualizacion));

    const latest = products.slice(0, 5);
    const tbody = document.getElementById('last-desktops-tbody');

    if (latest.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted);">No hay computadoras de escritorio registradas en la base de datos.</td></tr>`;
      return;
    }

    tbody.innerHTML = latest.map(p => {
      const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.precio);
      return `<tr><td class="sku">${p.sku}</td><td style="color:#ffffff;">${p.nombre}</td><td class="price">${formattedPrice}</td><td>${p.ultima_actualizacion}</td></tr>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar últimos desktops:', error);
  }
}

async function fetchLastMinipcs() {
  try {
    const response = await fetch('/api/minipcs/all');
    if (!response.ok) return;
    const products = await response.json();

    products.sort((a, b) => new Date(b.ultima_actualizacion) - new Date(a.ultima_actualizacion));

    const latest = products.slice(0, 5);
    const tbody = document.getElementById('last-minipcs-tbody');

    if (latest.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted);">No hay Mini PCs registradas en la base de datos.</td></tr>`;
      return;
    }

    tbody.innerHTML = latest.map(p => {
      const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.precio);
      return `<tr><td class="sku">${p.sku}</td><td style="color:#ffffff;">${p.nombre}</td><td class="price">${formattedPrice}</td><td>${p.ultima_actualizacion}</td></tr>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar últimos minipcs:', error);
  }
}

async function fetchLastMotherboards() {
  try {
    const response = await fetch('/api/motherboards/all');
    if (!response.ok) return;
    const products = await response.json();

    products.sort((a, b) => new Date(b.ultima_actualizacion) - new Date(a.ultima_actualizacion));

    const latest = products.slice(0, 5);
    const tbody = document.getElementById('last-motherboards-tbody');

    if (latest.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted);">No hay motherboards registradas en la base de datos.</td></tr>`;
      return;
    }

    tbody.innerHTML = latest.map(p => {
      const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.precio);
      return `<tr><td class="sku">${p.sku}</td><td style="color:#ffffff;">${p.nombre}</td><td class="price">${formattedPrice}</td><td>${p.ultima_actualizacion}</td></tr>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar últimos motherboards:', error);
  }
}

async function fetchCatalogCards() {
  try {
    const response = await fetch('/api/products/all');
    if (!response.ok) throw new Error('Error al cargar productos');
    const products = await response.json();

    const container = document.getElementById('tabla-productos');

    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="empty-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p>El catálogo local está vacío. Presiona "Actualizar Catálogo" para iniciar el scraping en tiempo real.</p>
        </div>
      `;
      return;
    }

    const formatCurrency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

    container.innerHTML = products.map(p => {
      const dateOnly = p.ultima_actualizacion ? p.ultima_actualizacion.split(' ')[0] : '';
      const productUrl = `https://tecnomegastore.ec/product/laptop?code=${p.sku}`;

      return `
        <div class="product-card animate-fade-in">
          <div class="product-card-header">
            <span class="badge-sku">${p.sku}</span>
            <span class="sync-date">${dateOnly}</span>
          </div>
          
          <div class="product-image-container">
            ${p.imagen_url ? `
              <img src="${p.imagen_url}" alt="${p.nombre}" class="product-image" loading="lazy" />
            ` : `
              <div class="product-image-placeholder" style="border: none; margin: 0; background: transparent; height: 100%; width: 100%;">
                <svg class="laptop-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
                </svg>
              </div>
            `}
          </div>
          
          <div class="product-info">
            <h3 class="product-title" title="${p.nombre}">${p.nombre}</h3>
            
            <div class="price-section">
              <div class="price-group">
                <span class="price-label">Precio</span>
                <span class="price-val price-sell">${formatCurrency(p.precio !== undefined ? p.precio : 0)}</span>
              </div>
            </div>
          </div>
          
          <div class="product-actions">
            <a href="${productUrl}" target="_blank" rel="noopener" class="btn-view-product">
              Ver en tienda
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error al cargar catálogo:', error);
  }
}

async function fetchDesktopCards() {
  try {
    const response = await fetch('/api/desktops/all');
    if (!response.ok) throw new Error('Error al cargar desktops');
    const products = await response.json();

    const container = document.getElementById('tabla-desktops');

    if (!products || products.length === 0) {
      container.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="empty-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg><p>El catálogo de PC desktop está vacío. Presiona "Actualizar PC Desktop" para iniciar el scraping.</p></div>`;
      return;
    }

    const formatCurrency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

    container.innerHTML = products.map(p => {
      const dateOnly = p.ultima_actualizacion ? p.ultima_actualizacion.split(' ')[0] : '';
      const productUrl = `https://tecnomegastore.ec/product/laptop?code=${p.sku}`;
      return `
        <div class="product-card animate-fade-in">
          <div class="product-card-header">
            <span class="badge-sku">${p.sku}</span>
            <span class="sync-date">${dateOnly}</span>
          </div>
          <div class="product-image-container">
            ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre}" class="product-image" loading="lazy" />` : `<div class="product-image-placeholder" style="border: none; margin: 0; background: transparent; height: 100%; width: 100%;"><svg class="laptop-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="3" width="18" height="12" rx="2" stroke-linecap="round" stroke-linejoin="round" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v4M9 19h6M7 21h10" /></svg></div>`}
          </div>
          <div class="product-info">
            <h3 class="product-title" title="${p.nombre}">${p.nombre}</h3>
            <div class="price-section">
              <div class="price-group">
                <span class="price-label">Precio</span>
                <span class="price-val price-sell">${formatCurrency(p.precio !== undefined ? p.precio : 0)}</span>
              </div>
            </div>
          </div>
          <div class="product-actions">
            <a href="${productUrl}" target="_blank" rel="noopener" class="btn-view-product">Ver en tienda<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar catálogo desktops:', error);
  }
}

async function fetchMinipcCards() {
  try {
    const response = await fetch('/api/minipcs/all');
    if (!response.ok) throw new Error('Error al cargar minipcs');
    const products = await response.json();

    const container = document.getElementById('tabla-minipcs');

    if (!products || products.length === 0) {
      container.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="empty-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg><p>El catálogo de Mini PCs está vacío. Presiona "Actualizar Mini PCs" para iniciar el scraping.</p></div>`;
      return;
    }

    const formatCurrency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

    container.innerHTML = products.map(p => {
      const dateOnly = p.ultima_actualizacion ? p.ultima_actualizacion.split(' ')[0] : '';
      const productUrl = `https://tecnomegastore.ec/product/laptop?code=${p.sku}`;
      return `
        <div class="product-card animate-fade-in">
          <div class="product-card-header">
            <span class="badge-sku">${p.sku}</span>
            <span class="sync-date">${dateOnly}</span>
          </div>
          <div class="product-image-container">
            ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre}" class="product-image" loading="lazy" />` : `<div class="product-image-placeholder" style="border: none; margin: 0; background: transparent; height: 100%; width: 100%;"><svg class="laptop-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="5" width="16" height="14" rx="2" stroke-linecap="round" stroke-linejoin="round" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v2h6v-2M8 10h8M8 14h4" /></svg></div>`}
          </div>
          <div class="product-info">
            <h3 class="product-title" title="${p.nombre}">${p.nombre}</h3>
            <div class="price-section">
              <div class="price-group">
                <span class="price-label">Precio</span>
                <span class="price-val price-sell">${formatCurrency(p.precio !== undefined ? p.precio : 0)}</span>
              </div>
            </div>
          </div>
          <div class="product-actions">
            <a href="${productUrl}" target="_blank" rel="noopener" class="btn-view-product">Ver en tienda<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar catálogo minipcs:', error);
  }
}

async function fetchLastMonitors() {
  try {
    const response = await fetch('/api/monitors/all');
    if (!response.ok) return;
    const products = await response.json();

    products.sort((a, b) => new Date(b.ultima_actualizacion) - new Date(a.ultima_actualizacion));

    const latest = products.slice(0, 5);
    const tbody = document.getElementById('last-monitors-tbody');

    if (latest.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted);">No hay monitores registrados en la base de datos.</td></tr>`;
      return;
    }

    tbody.innerHTML = latest.map(p => {
      const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.precio);
      return `<tr><td class="sku">${p.sku}</td><td style="color:#ffffff;">${p.nombre}</td><td class="price">${formattedPrice}</td><td>${p.ultima_actualizacion}</td></tr>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar últimos monitores:', error);
  }
}

async function fetchMonitorCards() {
  try {
    const response = await fetch('/api/monitors/all');
    if (!response.ok) throw new Error('Error al cargar monitores');
    const products = await response.json();

    const container = document.getElementById('tabla-monitors');

    if (!products || products.length === 0) {
      container.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="empty-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg><p>El catálogo de Monitores está vacío. Presiona "Actualizar Monitores" para iniciar el scraping.</p></div>`;
      return;
    }

    const formatCurrency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

    container.innerHTML = products.map(p => {
      const dateOnly = p.ultima_actualizacion ? p.ultima_actualizacion.split(' ')[0] : '';
      const productUrl = `https://tecnomegastore.ec/product/laptop?code=${p.sku}`;
      return `
        <div class="product-card animate-fade-in">
          <div class="product-card-header">
            <span class="badge-sku">${p.sku}</span>
            <span class="sync-date">${dateOnly}</span>
          </div>
          <div class="product-image-container">
            ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre}" class="product-image" loading="lazy" />` : `<div class="product-image-placeholder" style="border: none; margin: 0; background: transparent; height: 100%; width: 100%;"><svg class="laptop-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="2" y="3" width="20" height="14" rx="2" stroke-linecap="round" stroke-linejoin="round" /><path stroke-linecap="round" stroke-linejoin="round" d="M8 21h8M12 17v4" /></svg></div>`}
          </div>
          <div class="product-info">
            <h3 class="product-title" title="${p.nombre}">${p.nombre}</h3>
            <div class="price-section">
              <div class="price-group">
                <span class="price-label">Precio</span>
                <span class="price-val price-sell">${formatCurrency(p.precio !== undefined ? p.precio : 0)}</span>
              </div>
            </div>
          </div>
          <div class="product-actions">
            <a href="${productUrl}" target="_blank" rel="noopener" class="btn-view-product">Ver en tienda<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar catálogo monitores:', error);
  }
}

async function fetchLastGamingMonitors() {
  try {
    const response = await fetch('/api/gaming-monitors/all');
    if (!response.ok) return;
    const products = await response.json();

    products.sort((a, b) => new Date(b.ultima_actualizacion) - new Date(a.ultima_actualizacion));

    const latest = products.slice(0, 5);
    const tbody = document.getElementById('last-gaming-monitors-tbody');

    if (latest.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-text-muted);">No hay gaming monitores registrados en la base de datos.</td></tr>`;
      return;
    }

    tbody.innerHTML = latest.map(p => {
      const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.precio);
      return `<tr><td class="sku">${p.sku}</td><td style="color:#ffffff;">${p.nombre}</td><td class="price">${formattedPrice}</td><td>${p.ultima_actualizacion}</td></tr>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar últimos gaming monitores:', error);
  }
}

async function fetchGamingMonitorCards() {
  try {
    const response = await fetch('/api/gaming-monitors/all');
    if (!response.ok) throw new Error('Error al cargar gaming monitores');
    const products = await response.json();

    const container = document.getElementById('tabla-gaming-monitors');

    if (!products || products.length === 0) {
      container.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="empty-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg><p>El catálogo de Gaming Monitores está vacío. Presiona "Actualizar Gaming Monitores" para iniciar el scraping.</p></div>`;
      return;
    }

    const formatCurrency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

    container.innerHTML = products.map(p => {
      const dateOnly = p.ultima_actualizacion ? p.ultima_actualizacion.split(' ')[0] : '';
      const productUrl = `https://tecnomegastore.ec/product/laptop?code=${p.sku}`;
      return `
        <div class="product-card animate-fade-in">
          <div class="product-card-header">
            <span class="badge-sku">${p.sku}</span>
            <span class="sync-date">${dateOnly}</span>
          </div>
          <div class="product-image-container">
            ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre}" class="product-image" loading="lazy" />` : `<div class="product-image-placeholder" style="border: none; margin: 0; background: transparent; height: 100%; width: 100%;"><svg class="laptop-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="2" y="3" width="20" height="14" rx="2" stroke-linecap="round" stroke-linejoin="round" /><path stroke-linecap="round" stroke-linejoin="round" d="M8 21h8M12 17v4" /></svg></div>`}
          </div>
          <div class="product-info">
            <h3 class="product-title" title="${p.nombre}">${p.nombre}</h3>
            <div class="price-section">
              <div class="price-group">
                <span class="price-label">Precio</span>
                <span class="price-val price-sell">${formatCurrency(p.precio !== undefined ? p.precio : 0)}</span>
              </div>
            </div>
          </div>
          <div class="product-actions">
            <a href="${productUrl}" target="_blank" rel="noopener" class="btn-view-product">Ver en tienda<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar catálogo gaming monitores:', error);
  }
}

async function handleScrapeGamingMonitors() {
  const btn = document.getElementById('scrape-gaming-monitors-btn');
  const indicator = document.getElementById('loading-indicator');

  btn.disabled = true;
  indicator.style.opacity = '1';

  try {
    const response = await fetch('/api/scrape/gaming-monitors', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      await fetchLastGamingMonitors();
      await fetchGamingMonitorCards();
    } else {
      console.error('Error de scraping gaming monitores:', result.error);
      alert(`Error de Scraping: ${result.error || 'Error desconocido'}\n${result.message || ''}`);
    }
  } catch (error) {
    console.error('Error al ejecutar scrape gaming monitores:', error);
    alert('Error al conectar con el servidor para ejecutar el scraping.');
  } finally {
    btn.disabled = false;
    indicator.style.opacity = '0';
  }
}

async function handleScrapeMonitors() {
  const btn = document.getElementById('scrape-monitors-btn');
  const indicator = document.getElementById('loading-indicator');

  btn.disabled = true;
  indicator.style.opacity = '1';

  try {
    const response = await fetch('/api/scrape/monitors', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      await fetchLastMonitors();
      await fetchMonitorCards();
    } else {
      console.error('Error de scraping monitores:', result.error);
      alert(`Error de Scraping: ${result.error || 'Error desconocido'}\n${result.message || ''}`);
    }
  } catch (error) {
    console.error('Error al ejecutar scrape monitores:', error);
    alert('Error al conectar con el servidor para ejecutar el scraping.');
  } finally {
    btn.disabled = false;
    indicator.style.opacity = '0';
  }
}

async function fetchMotherboardCards() {
  try {
    const response = await fetch('/api/motherboards/all');
    if (!response.ok) throw new Error('Error al cargar motherboards');
    const products = await response.json();

    const container = document.getElementById('tabla-motherboards');

    if (!products || products.length === 0) {
      container.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="empty-icon"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg><p>El catálogo de Motherboards está vacío. Presiona "Actualizar Motherboards" para iniciar el scraping.</p></div>`;
      return;
    }

    const formatCurrency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

    container.innerHTML = products.map(p => {
      const dateOnly = p.ultima_actualizacion ? p.ultima_actualizacion.split(' ')[0] : '';
      const productUrl = `https://tecnomegastore.ec/product/laptop?code=${p.sku}`;
      return `
        <div class="product-card animate-fade-in">
          <div class="product-card-header">
            <span class="badge-sku">${p.sku}</span>
            <span class="sync-date">${dateOnly}</span>
          </div>
          <div class="product-image-container">
            ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre}" class="product-image" loading="lazy" />` : `<div class="product-image-placeholder" style="border: none; margin: 0; background: transparent; height: 100%; width: 100%;"><svg class="laptop-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="5" width="16" height="14" rx="2" stroke-linecap="round" stroke-linejoin="round" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v2h6v-2M8 10h8M8 14h4" /></svg></div>`}
          </div>
          <div class="product-info">
            <h3 class="product-title" title="${p.nombre}">${p.nombre}</h3>
            <div class="price-section">
              <div class="price-group">
                <span class="price-label">Precio</span>
                <span class="price-val price-sell">${formatCurrency(p.precio !== undefined ? p.precio : 0)}</span>
              </div>
            </div>
          </div>
          <div class="product-actions">
            <a href="${productUrl}" target="_blank" rel="noopener" class="btn-view-product">Ver en tienda<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error('Error al cargar catálogo motherboards:', error);
  }
}

async function handleScrape() {
  const btn = document.getElementById('scrape-btn');
  const indicator = document.getElementById('loading-indicator');

  btn.disabled = true;
  indicator.style.opacity = '1';

  try {
    const response = await fetch('/api/scrape', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      await fetchLastProducts();
      await fetchCatalogCards();
    } else {
      console.error('Error de scraping:', result.error);
      alert(`Error de Scraping: ${result.error || 'Error desconocido'}\n${result.message || ''}`);
    }
  } catch (error) {
    console.error('Error al ejecutar scrape:', error);
    alert('Error al conectar con el servidor para ejecutar el scraping.');
  } finally {
    btn.disabled = false;
    indicator.style.opacity = '0';
  }
}

async function handleScrapeDesktops() {
  const btn = document.getElementById('scrape-desktops-btn');
  const indicator = document.getElementById('loading-indicator');

  btn.disabled = true;
  indicator.style.opacity = '1';

  try {
    const response = await fetch('/api/scrape/desktops', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      await fetchLastDesktops();
      await fetchDesktopCards();
    } else {
      console.error('Error de scraping desktops:', result.error);
      alert(`Error de Scraping: ${result.error || 'Error desconocido'}\n${result.message || ''}`);
    }
  } catch (error) {
    console.error('Error al ejecutar scrape desktops:', error);
    alert('Error al conectar con el servidor para ejecutar el scraping.');
  } finally {
    btn.disabled = false;
    indicator.style.opacity = '0';
  }
}

async function handleScrapeMinipcs() {
  const btn = document.getElementById('scrape-minipcs-btn');
  const indicator = document.getElementById('loading-indicator');

  btn.disabled = true;
  indicator.style.opacity = '1';

  try {
    const response = await fetch('/api/scrape/minipcs', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      await fetchLastMinipcs();
      await fetchMinipcCards();
    } else {
      console.error('Error de scraping minipcs:', result.error);
      alert(`Error de Scraping: ${result.error || 'Error desconocido'}\n${result.message || ''}`);
    }
  } catch (error) {
    console.error('Error al ejecutar scrape minipcs:', error);
    alert('Error al conectar con el servidor para ejecutar el scraping.');
  } finally {
    btn.disabled = false;
    indicator.style.opacity = '0';
  }
}

async function handleScrapeMotherboards() {
  const btn = document.getElementById('scrape-motherboards-btn');
  const indicator = document.getElementById('loading-indicator');

  btn.disabled = true;
  indicator.style.opacity = '1';

  try {
    const response = await fetch('/api/scrape/motherboards', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      await fetchLastMotherboards();
      await fetchMotherboardCards();
    } else {
      console.error('Error de scraping motherboards:', result.error);
      alert(`Error de Scraping: ${result.error || 'Error desconocido'}\n${result.message || ''}`);
    }
  } catch (error) {
    console.error('Error al ejecutar scrape motherboards:', error);
    alert('Error al conectar con el servidor para ejecutar el scraping.');
  } finally {
    btn.disabled = false;
    indicator.style.opacity = '0';
  }
}

async function handleScrapeComponents() {
  const btn = document.getElementById('scrape-components-btn');
  const indicator = document.getElementById('loading-indicator');

  btn.disabled = true;
  indicator.style.opacity = '1';

  try {
    const response = await fetch('/api/scrape/components', { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      await fetchComponentCards('procesadores', 'tabla-procesadores');
      await fetchComponentCards('tarjetas-video', 'tabla-tarjetas-video');
    } else {
      console.error('Error de scraping componentes:', result.error);
      alert(`Error de Scraping: ${result.error || 'Error desconocido'}\n${result.message || ''}`);
    }
  } catch (error) {
    console.error('Error al ejecutar scrape componentes:', error);
    alert('Error al conectar con el servidor para ejecutar el scraping.');
  } finally {
    btn.disabled = false;
    indicator.style.opacity = '0';
  }
}

async function fetchComponentCards(cat, containerId) {
  try {
    const response = await fetch(`/api/components/${cat}/all`);
    if (!response.ok) throw new Error(`Error al cargar ${cat}`);
    const products = await response.json();

    const container = document.getElementById(containerId);
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>El catálogo de ${cat} está vacío. Presiona "Actualizar Componentes" para iniciar el scraping.</p></div>`;
      return;
    }

    const formatCurrency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

    container.innerHTML = products.map(p => {
      const dateOnly = p.ultima_actualizacion ? p.ultima_actualizacion.split(' ')[0] : '';
      const productUrl = `https://tecnomegastore.ec/product/laptop?code=${p.sku}`;
      return `
        <div class="product-card animate-fade-in">
          <div class="product-card-header">
            <span class="badge-sku">${p.sku}</span>
            <span class="sync-date">${dateOnly}</span>
          </div>
          <div class="product-image-container">
            ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre}" class="product-image" loading="lazy" />` : `<div class="product-image-placeholder" style="border: none; margin: 0; background: transparent; height: 100%; width: 100%;"><p>No image</p></div>`}
          </div>
          <div class="product-info">
            <h3 class="product-title" title="${p.nombre}">${p.nombre}</h3>
            <div class="price-section">
              <div class="price-group">
                <span class="price-label">Precio</span>
                <span class="price-val price-sell">${formatCurrency(p.precio !== undefined ? p.precio : 0)}</span>
              </div>
            </div>
          </div>
          <div class="product-actions">
            <a href="${productUrl}" target="_blank" rel="noopener" class="btn-view-product">Ver en tienda</a>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error(`Error al cargar catálogo ${cat}:`, error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  fetchLastProducts();
  fetchCatalogCards();
  fetchLastDesktops();
  fetchDesktopCards();
  fetchLastMinipcs();
  fetchMinipcCards();
  fetchLastMotherboards();
  fetchMotherboardCards();
  fetchLastMonitors();
  fetchMonitorCards();
  fetchLastGamingMonitors();
  fetchGamingMonitorCards();

  const scrapeBtn = document.getElementById('scrape-btn');
  if (scrapeBtn) {
    scrapeBtn.removeAttribute('hx-post');
    scrapeBtn.removeAttribute('hx-target');
    scrapeBtn.removeAttribute('hx-indicator');
    scrapeBtn.addEventListener('click', handleScrape);
  }

  const scrapeDesktopsBtn = document.getElementById('scrape-desktops-btn');
  if (scrapeDesktopsBtn) {
    scrapeDesktopsBtn.removeAttribute('hx-post');
    scrapeDesktopsBtn.removeAttribute('hx-target');
    scrapeDesktopsBtn.removeAttribute('hx-indicator');
    scrapeDesktopsBtn.addEventListener('click', handleScrapeDesktops);
  }

  const scrapeMinipcsBtn = document.getElementById('scrape-minipcs-btn');
  if (scrapeMinipcsBtn) {
    scrapeMinipcsBtn.removeAttribute('hx-post');
    scrapeMinipcsBtn.removeAttribute('hx-target');
    scrapeMinipcsBtn.removeAttribute('hx-indicator');
    scrapeMinipcsBtn.addEventListener('click', handleScrapeMinipcs);
  }

  const scrapeMotherboardsBtn = document.getElementById('scrape-motherboards-btn');
  if (scrapeMotherboardsBtn) {
    scrapeMotherboardsBtn.removeAttribute('hx-post');
    scrapeMotherboardsBtn.removeAttribute('hx-target');
    scrapeMotherboardsBtn.removeAttribute('hx-indicator');
    scrapeMotherboardsBtn.addEventListener('click', handleScrapeMotherboards);
  }

  const scrapeMonitorsBtn = document.getElementById('scrape-monitors-btn');
  if (scrapeMonitorsBtn) {
    scrapeMonitorsBtn.removeAttribute('hx-post');
    scrapeMonitorsBtn.removeAttribute('hx-target');
    scrapeMonitorsBtn.removeAttribute('hx-indicator');
    scrapeMonitorsBtn.addEventListener('click', handleScrapeMonitors);
  }

  const scrapeGamingMonitorsBtn = document.getElementById('scrape-gaming-monitors-btn');
  if (scrapeGamingMonitorsBtn) {
    scrapeGamingMonitorsBtn.removeAttribute('hx-post');
    scrapeGamingMonitorsBtn.removeAttribute('hx-target');
    scrapeGamingMonitorsBtn.removeAttribute('hx-indicator');
    scrapeGamingMonitorsBtn.addEventListener('click', handleScrapeGamingMonitors);
  }

  const scrapeComponentsBtn = document.getElementById('scrape-components-btn');
  if (scrapeComponentsBtn) {
    scrapeComponentsBtn.addEventListener('click', handleScrapeComponents);
  }

  fetchComponentCards('procesadores', 'tabla-procesadores');
  fetchComponentCards('tarjetas-video', 'tabla-tarjetas-video');
});
