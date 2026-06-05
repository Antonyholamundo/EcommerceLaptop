/**
 * cart.js — Lógica de Carrito de Compras para NoteStore Ecuador
 */

// Estado del Carrito
let cart = [];

// Elementos DOM
const cartDrawer = document.getElementById('cart-drawer');
const cartOverlay = document.getElementById('cart-drawer-overlay');
const cartToggleBtn = document.getElementById('cart-toggle-btn');
const cartCloseBtn = document.getElementById('cart-close-btn');
const cartContinueBtn = document.getElementById('cart-continue-btn');
const cartBadgeCount = document.getElementById('cart-badge-count');
const cartDrawerTitle = document.getElementById('cart-drawer-title');
const cartDrawerBody = document.getElementById('cart-drawer-body');
const cartSubtotalVal = document.getElementById('cart-subtotal-val');
const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
const toastNotification = document.getElementById('toast-notification');
const toastText = document.getElementById('toast-text');

// Inicializar Carrito
window.addEventListener('DOMContentLoaded', () => {
  loadCartFromStorage();
  setupCartDrawerEvents();
});

// Cargar desde localStorage
function loadCartFromStorage() {
  const stored = localStorage.getItem('notestore_cart');
  if (stored) {
    try {
      cart = JSON.parse(stored);
    } catch (e) {
      console.error('Error al parsear carrito de localStorage', e);
      cart = [];
    }
  }
  updateCartUI();
}

// Guardar en localStorage
function saveCartToStorage() {
  localStorage.setItem('notestore_cart', JSON.stringify(cart));
  updateCartUI();
}

// Configurar Eventos del Drawer
function setupCartDrawerEvents() {
  if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCart);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
  if (cartContinueBtn) cartContinueBtn.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  // Botón Finalizar Compra
  if (cartCheckoutBtn) {
    cartCheckoutBtn.addEventListener('click', () => {
      if (cart.length === 0) {
        showToast('El carrito está vacío', 'error');
        return;
      }
      
      // Construir mensaje de WhatsApp
      let message = 'Hola, estoy interesado en comprar los siguientes productos de NoteStore Ecuador:\n\n';
      cart.forEach((item, index) => {
        const itemCat = item.category || 'laptops';
        const itemUrl = `${window.location.origin}/product.html?sku=${item.sku}&cat=${itemCat}`;
        message += `${index + 1}. *${item.name}* (SKU: ${item.sku})\n`;
        message += `   Cantidad: ${item.quantity} | Precio: $${item.price.toFixed(2)}\n`;
        message += `   Enlace: ${itemUrl}\n\n`;
      });
      
      const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      message += `*Total estimado:* $${subtotal.toFixed(2)}`;
      
      const phoneNumber = '593999921624'; // WhatsApp de NoteStore Ecuador (0999921624)
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener');
    });
  }
}

// Abrir Drawer
function openCart() {
  cartDrawer.classList.add('open');
  cartOverlay.classList.add('open');
  document.body.style.overflow = 'hidden'; // Evitar scroll del fondo
}

// Cerrar Drawer
function closeCart() {
  cartDrawer.classList.remove('open');
  cartOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Detectar categoría basada en la página actual
function detectCategoryFromPage() {
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  
  if (path.includes('motherboard.html')) return 'motherboards';
  if (path.includes('monitores.html')) return 'monitores';
  if (path.includes('gaming-monitores.html')) return 'gaming-monitores';
  if (path.includes('computadoras.html')) return 'desktops';
  if (path.includes('minipcs.html')) return 'minipcs';
  if (path.includes('laptops.html')) return 'laptops';
  if (path.includes('catalogo.html')) {
    return urlParams.get('cat') || 'procesadores';
  }
  if (path.includes('product.html')) {
    return urlParams.get('cat') || 'laptops';
  }
  return 'laptops';
}

// Añadir al Carrito (Disponible globalmente)
window.addToCart = function(sku, name, price, imgUrl, url) {
  const existing = cart.find(item => item.sku === sku);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      sku,
      name,
      price: parseFloat(price),
      imgUrl,
      url,
      category: detectCategoryFromPage(),
      quantity: 1
    });
  }
  
  saveCartToStorage();
  animateCartBadge();
  openCart(); // Abrir el drawer automáticamente para una UX premium
};

// Animación del Badge del Carrito
function animateCartBadge() {
  if (cartBadgeCount) {
    cartBadgeCount.classList.remove('animate');
    void cartBadgeCount.offsetWidth; // Trigger reflow para reiniciar CSS animation
    cartBadgeCount.classList.add('animate');
    
    // Quitar clase tras finalizar animación
    setTimeout(() => {
      cartBadgeCount.classList.remove('animate');
    }, 200);
  }
}

// Actualizar Interfaz del Carrito
function updateCartUI() {
  // A. Cantidad Total
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  
  // Badge en cabecera
  if (cartBadgeCount) cartBadgeCount.textContent = totalItems;
  
  // Título del drawer
  if (cartDrawerTitle) {
    cartDrawerTitle.textContent = `Mi carrito (${totalItems} ${totalItems === 1 ? 'producto' : 'productos'})`;
  }

  // B. Render Body
  if (cart.length === 0) {
    cartDrawerBody.innerHTML = `
      <div class="empty-cart-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
        <p>Tu carrito está vacío</p>
      </div>
    `;
    cartSubtotalVal.textContent = '$0.00';
    return;
  }

  cartDrawerBody.innerHTML = cart.map(item => {
    const itemSubtotal = item.price * item.quantity;
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(itemSubtotal);
    
    const fallbackSvg = `data:image/svg+xml;utf8,<svg class=%22laptop-placeholder-svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%221.2%22 xmlns=%22http://www.w3.org/2000/svg%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25%22 /></svg>`;
    
    const imgHtml = item.imgUrl ? 
      `<img src="${item.imgUrl}" alt="${item.name}" onerror="this.src='${fallbackSvg}';this.onerror=null;">` : 
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="width:36px;height:36px;opacity:0.6;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>`;

    return `
      <div class="cart-item-card">
        <div class="cart-item-img">
          ${imgHtml}
        </div>
        <div class="cart-item-info">
          <div>
            <div class="cart-item-title" title="${item.name}">${item.name}</div>
            <div class="cart-item-sku">${item.sku}</div>
          </div>
          <div class="cart-item-controls">
            <!-- Selector de Cantidad -->
            <div class="cart-item-quantity">
              <button onclick="updateQuantity('${item.sku}', ${item.quantity - 1})">-</button>
              <input type="text" readonly value="${item.quantity}">
              <button onclick="updateQuantity('${item.sku}', ${item.quantity + 1})">+</button>
            </div>
            
            <!-- Botón Eliminar -->
            <button class="cart-item-remove-btn" onclick="removeFromCart('${item.sku}')">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Eliminar
            </button>
          </div>
          <div class="cart-item-price" style="margin-top:0.25rem;">${formattedPrice}</div>
        </div>
      </div>
    `;
  }).join('');

  // C. Calcular Subtotal
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  cartSubtotalVal.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal);
}

// Actualizar Cantidad
window.updateQuantity = function(sku, quantity) {
  if (quantity < 1) {
    removeFromCart(sku);
    return;
  }
  const item = cart.find(i => i.sku === sku);
  if (item) {
    item.quantity = quantity;
    saveCartToStorage();
  }
};

// Eliminar del Carrito
window.removeFromCart = function(sku) {
  cart = cart.filter(item => item.sku !== sku);
  saveCartToStorage();
};

// Toast Notifications Helper (Disponible globalmente)
window.showToast = function(text, type = 'success') {
  if (!toastNotification) return;
  
  toastText.textContent = text;
  const icon = toastNotification.querySelector('svg');
  if (type === 'success') {
    icon.style.color = 'var(--success)';
    icon.style.display = 'block';
  } else {
    icon.style.display = 'none';
  }
  
  toastNotification.classList.add('show');
  
  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 2500);
};
