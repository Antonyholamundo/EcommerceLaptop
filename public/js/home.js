/**
 * home.js — Lógica de la Página de Inicio para Tienda Gamer EC
 * Maneja la Barra de Categorías y el renderizado dinámico de carruseles de productos.
 */

document.addEventListener('DOMContentLoaded', () => {
  let allProducts = [];
  const sectionsContainer = document.getElementById('home-products-sections');
  const categoriesScrollContainer = document.getElementById('categories-scroll-container');

  // 1. Fetch inicial de productos
  fetchHomeProducts();

  async function fetchHomeProducts() {
    try {
      // Consultamos el endpoint all con category=all para obtener todos los productos de la BD
      const response = await fetch('/api/products/all?category=all');
      if (!response.ok) throw new Error('Error al conectar con la base de datos local');
      allProducts = await response.json();

      // Renderizar la vista inicial ("Todos")
      renderHomeSections('all');
      setupCategoryClickListeners();
    } catch (error) {
      console.error('Error fetching home products:', error);
      sectionsContainer.innerHTML = `
        <div class="empty-catalog-state" style="padding: 3rem 1rem; text-align: center; background: #ffffff;">
          <p style="color:var(--danger);font-weight:600;font-size:1.1rem;margin-bottom:0.5rem;">
            Error al conectar con la base de datos local
          </p>
          <p style="color:var(--text-secondary);font-size:0.9rem;">
            Por favor, asegúrate de que el servidor está corriendo en Express e intenta de nuevo.
          </p>
        </div>
      `;
    }
  }

  // 2. Determinar qué secciones mostrar según el filtro de categoría
  function renderHomeSections(selectedCategory) {
    sectionsContainer.innerHTML = '';

    if (!allProducts || allProducts.length === 0) {
      sectionsContainer.innerHTML = `
        <div class="empty-catalog-state" style="padding:3rem 1rem; text-align:center;">
          <p>No hay productos disponibles en la base de datos.</p>
        </div>
      `;
      return;
    }

    let sections = [];

    if (selectedCategory === 'all') {
      // Modo "Todos": Mostrar categorías y secciones mixtas destacadas
      
      // 2.1 Ofertas Relámpago (Productos con más de 10% de descuento)
      const deals = allProducts.filter(p => p.pricing && p.pricing.savingsPercent >= 10);
      if (deals.length > 0) {
        sections.push({
          title: 'Sigue comprando ofertas',
          moreUrl: '/componentes/procesadores', // Enlace genérico a componentes
          products: deals.slice(0, 15)
        });
      }

      // 2.2 Laptops Destacadas
      const laptops = allProducts.filter(p => p.categoria === 'laptops');
      if (laptops.length > 0) {
        sections.push({
          title: 'Laptops y Portátiles Destacados',
          moreUrl: '/laptops-gaming',
          products: laptops.slice(0, 12)
        });
      }

      // 2.3 Monitores y Pantallas
      const monitors = allProducts.filter(p => p.categoria === 'monitors' || p.categoria === 'gaming-monitors');
      if (monitors.length > 0) {
        sections.push({
          title: 'Monitores de Oficina y Gaming',
          moreUrl: '/monitores',
          products: monitors.slice(0, 12)
        });
      }

      // 2.4 Placas Madre y Componentes PC
      const motherboards = allProducts.filter(p => p.categoria === 'motherboards');
      if (motherboards.length > 0) {
        sections.push({
          title: 'Motherboards y Placas Base',
          moreUrl: '/motherboards',
          products: motherboards.slice(0, 12)
        });
      }

      // 2.5 Más vendidos (Mixto)
      const bestSellers = allProducts.slice().sort((a, b) => b.precio - a.precio).slice(0, 15);
      sections.push({
        title: 'Los Más Vendidos de la Semana',
        moreUrl: '/componentes/ram',
        products: bestSellers
      });

    } else {
      // Categoría específica seleccionada: Mostrar secciones relativas a ella
      const label = getCategoryLabel(selectedCategory);
      const filtered = allProducts.filter(p => p.categoria === selectedCategory);

      if (filtered.length === 0) {
        sectionsContainer.innerHTML = `
          <div class="empty-catalog-state" style="padding:4rem 1rem; text-align:center; background:#ffffff;">
            <svg class="laptop-placeholder-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="width:60px;height:60px;margin-bottom:1rem;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <p style="font-weight:600;color:var(--text-primary);">Próximamente en ${label}</p>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.25rem;">
              Estamos sincronizando las existencias de este hardware con nuestro mayorista oficial.
            </p>
          </div>
        `;
        return;
      }

      // Filtrar subsecciones para esta categoría específica
      const categoryDeals = filtered.filter(p => p.pricing && p.pricing.savingsPercent >= 10);
      const categoryBestSellers = filtered.slice().sort((a, b) => b.precio - a.precio);
      const categoryNewStock = filtered.slice();

      if (categoryDeals.length > 0) {
        sections.push({
          title: `${label} en Oferta Especial`,
          moreUrl: getMoreUrl(selectedCategory),
          products: categoryDeals.slice(0, 12)
        });
      }
      sections.push({
        title: `${label} Recomendados`,
        moreUrl: getMoreUrl(selectedCategory),
        products: categoryBestSellers.slice(0, 12)
      });
      sections.push({
        title: `Últimos Ingresos de ${label}`,
        moreUrl: getMoreUrl(selectedCategory),
        products: categoryNewStock.slice(0, 12)
      });
    }

    // Renderizar cada sección construida
    sections.forEach((sec, idx) => {
      // Agregar divisor entre secciones (excepto antes de la primera)
      if (idx > 0) {
        const div = document.createElement('div');
        div.className = 'section-divider';
        sectionsContainer.appendChild(div);
      }

      const sectionEl = createSectionElement(sec);
      sectionsContainer.appendChild(sectionEl);
    });
  }

  // 3. Crear el nodo del DOM para una sección
  function createSectionElement(sec) {
    const section = document.createElement('section');
    section.className = 'product-section';

    // Cabecera de la sección
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <h2 class="section-title">${sec.title}</h2>
      <a href="${sec.moreUrl}" class="section-more-link">Ver más</a>
    `;
    section.appendChild(header);

    // Envoltura del Carrusel
    const wrapper = document.createElement('div');
    wrapper.className = 'carousel-wrapper';

    // Flecha izquierda
    const prevBtn = document.createElement('button');
    prevBtn.className = 'carousel-arrow prev';
    prevBtn.innerHTML = '&lt;';
    prevBtn.ariaLabel = 'Desplazar a la izquierda';

    // Contenedor de las tarjetas
    const container = document.createElement('div');
    container.className = 'carousel-container';

    // Flecha derecha
    const nextBtn = document.createElement('button');
    nextBtn.className = 'carousel-arrow next';
    nextBtn.innerHTML = '&gt;';
    nextBtn.ariaLabel = 'Desplazar a la derecha';

    // Generar las tarjetas de productos
    const placeholderImg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjNkI3MjgwIiBzdHJva2Utd2lkdGg9IjEuMiI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNOSAxNy4yNXYxLjAwN2EzIDMgMCAwIDEtLjg3OSAyLjEyMkw3LjUgMjFoOWwtLjYyMS0uNjIxQTMgMyAwIDAgMSAxNSAxOC4yNTdWMTcuMjVtNi0xMlYxNWEyLjI1IDIuMjUgMCAwIDEtMi4yNSAyLjI1SDUuMjVBMi4yNSAyLjI1IDAgMCAxIDMgMTVWNS4yNW0xOCAwQTIuMjUgMi4yNSAwIDAgMCAxOC43NSAzSDUuMjVBMi4yNSAyLjI1IDAgMCAwIDMgNS4yNW0xOCAwVjEyYTIuMjUgMi4yNSAwIDAgMS0yLjI1IDIuMjVINS4yNUEyLjI1IDIuMjUgMCAwIDEgMyAxMlY1LjI1IiAvPjwvc3ZnPg==';

    container.innerHTML = sec.products.map(p => {
      const { rating, reviews } = getDeterministicRating(p.sku);
      const isPrime = getDeterministicPrime(p.sku);

      // Render de badges semánticos
      let badgesHtml = '';
      const savingsPercent = p.pricing ? p.pricing.savingsPercent : 0;
      const priceFormatted = p.pricing ? p.pricing.priceFormatted : ('$' + p.precio.toFixed(2));
      const referencePriceFormatted = p.pricing ? p.pricing.referencePriceFormatted : '';

      if (savingsPercent > 0) {
        badgesHtml += `<span class="pbadge pbadge-discount">-${savingsPercent}%</span>`;
      }
      if (savingsPercent >= 13) {
        badgesHtml += `<span class="pbadge pbadge-lightning">Oferta Relámpago</span>`;
        badgesHtml += `<span class="pbadge pbadge-timer">Finaliza en 02h 45m</span>`;
      }
      if (isPrime) {
        badgesHtml += `<span class="pbadge pbadge-prime">Prime</span>`;
      }

      return `
        <a href="/producto/${p.categoria}/${p.sku}" class="pcard" title="${p.nombre}">
          <div class="pcard-image-wrapper">
            <img src="${p.imagen_url || placeholderImg}" alt="${p.nombre} - Tienda Gamer EC" loading="lazy" onerror="this.src='${placeholderImg}';this.onerror=null;">
          </div>
          <h3 class="pcard-title">${p.nombre}</h3>
          
          <div class="pcard-stars-row">
            <div class="pcard-stars">${renderStarsHtml(rating)}</div>
            <span class="pcard-reviews-count">${reviews}</span>
          </div>

          <div class="pcard-badges-row">${badgesHtml}</div>

          <div class="pcard-price-row">
            <span class="pcard-price">${priceFormatted}</span>
            ${savingsPercent > 0 ? `<span class="pcard-price-original">${referencePriceFormatted}</span>` : ''}
          </div>
        </a>
      `;
    }).join('');

    wrapper.appendChild(prevBtn);
    wrapper.appendChild(container);
    wrapper.appendChild(nextBtn);
    section.appendChild(wrapper);

    // Lógica de control de flechas y scroll suave
    setTimeout(() => {
      updateArrowButtons(container, prevBtn, nextBtn);
    }, 100);

    container.addEventListener('scroll', () => {
      updateArrowButtons(container, prevBtn, nextBtn);
    });

    prevBtn.addEventListener('click', () => {
      const cardWidth = container.querySelector('.pcard')?.offsetWidth || 210;
      const scrollAmt = (cardWidth + 12) * 3; // Desplaza 3 tarjetas
      container.scrollBy({ left: -scrollAmt, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      const cardWidth = container.querySelector('.pcard')?.offsetWidth || 210;
      const scrollAmt = (cardWidth + 12) * 3;
      container.scrollBy({ left: scrollAmt, behavior: 'smooth' });
    });

    return section;
  }

  // Auxiliar para habilitar/deshabilitar u ocultar flechas
  function updateArrowButtons(container, prevBtn, nextBtn) {
    const scrollLeft = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;
    
    // Si no hay suficiente ancho para scroll, ocultar flechas por completo
    if (container.scrollWidth <= container.clientWidth) {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      return;
    }

    prevBtn.style.display = 'flex';
    nextBtn.style.display = 'flex';

    // Desactivación visual según posición
    if (scrollLeft <= 5) {
      prevBtn.style.opacity = '0.2';
      prevBtn.style.pointerEvents = 'none';
    } else {
      prevBtn.style.opacity = '1';
      prevBtn.style.pointerEvents = 'auto';
    }

    if (scrollLeft >= maxScroll - 5) {
      nextBtn.style.opacity = '0.2';
      nextBtn.style.pointerEvents = 'none';
    } else {
      nextBtn.style.opacity = '1';
      nextBtn.style.pointerEvents = 'auto';
    }
  }

  // 4. Configurar eventos de clic en las pestañas de categorías
  function setupCategoryClickListeners() {
    const buttons = categoriesScrollContainer.querySelectorAll('.category-item');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remover clase activa
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Filtrar y volver a renderizar secciones
        const cat = btn.getAttribute('data-category');
        renderHomeSections(cat);

        // Scroll suave al contenedor de categorías seleccionado
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    });
  }

  // ============================================================
  // HELPERS Y AUXILIARES
  // ============================================================

  // Genera valoración y volumen de reseñas deterministas basadas en el SKU
  function getDeterministicRating(sku) {
    let sum = 0;
    for (let i = 0; i < sku.length; i++) {
      sum += sku.charCodeAt(i);
    }
    const rating = 4.0 + (sum % 11) / 10;
    const reviews = (sum % 180) + 12;
    return { rating, reviews };
  }

  // Determina si califica a Prime (50% de probabilidad fija)
  function getDeterministicPrime(sku) {
    let sum = 0;
    for (let i = 0; i < sku.length; i++) {
      sum += sku.charCodeAt(i);
    }
    return sum % 2 === 0;
  }

  // Dibuja estrellas amarillas
  function renderStarsHtml(rating) {
    let starsHtml = '';
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        starsHtml += `<svg viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
      } else {
        starsHtml += `<svg viewBox="0 0 20 20" style="color:#D1D5DB;"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
      }
    }
    return starsHtml;
  }

  // Traduce el ID de categoría al nombre de visualización
  function getCategoryLabel(cat) {
    const labels = {
      'desktops': 'PC de Escritorio',
      'laptops': 'Laptops',
      'motherboards': 'Motherboards',
      'monitors': 'Monitores',
      'gaming-monitors': 'Monitores Gaming',
      'procesadores': 'Procesadores',
      'tarjetas-video': 'Tarjetas Gráficas',
      'ram': 'Memoria RAM',
      'almacenamiento': 'Almacenamiento',
      'fuentes': 'Fuentes de Poder',
      'cases': 'Cases y Gabinetes'
    };
    return labels[cat] || cat;
  }

  // Traduce categoría al enlace de su catálogo
  function getMoreUrl(cat) {
    const urls = {
      'desktops': '/computadoras',
      'laptops': '/laptops-gaming',
      'motherboards': '/motherboards',
      'monitors': '/monitores',
      'gaming-monitors': '/monitores-gaming',
      'procesadores': '/componentes/procesadores',
      'tarjetas-video': '/componentes/tarjetas-video',
      'ram': '/componentes/ram',
      'almacenamiento': '/componentes/almacenamiento',
      'fuentes': '/componentes/fuentes',
      'cases': '/componentes/cases'
    };
    return urls[cat] || `/componentes/${cat}`;
  }
});
