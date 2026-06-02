const { parseBrand, enrichProduct } = require('./productService');

function createComputerService(category, db) {
  async function filterProducts(options = {}) {
    const {
      search = '', brands = [], minPrice = 0, maxPrice = Infinity,
      sort = 'relevancia', page = 1, limit = 12,
    } = options;

    let products = await db.getAllProducts(category);

    if (search || brands.length > 0 || minPrice > 0 || maxPrice < Infinity) {
      const searchLower = search.toLowerCase();
      products = products.filter(p => {
        const name = (p.nombre || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const brand = parseBrand(p.nombre);
        const matchesSearch = !search || name.includes(searchLower) || sku.includes(searchLower) || brand.toLowerCase().includes(searchLower);
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
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const totalPages = Math.ceil(total / safeLimit);
    const startIndex = (safePage - 1) * safeLimit;
    const paginatedProducts = products.slice(startIndex, startIndex + safeLimit);
    const enrichedProducts = paginatedProducts.map(enrichProduct);

    return { products: enrichedProducts, total, page: safePage, totalPages, limit: safeLimit };
  }

  async function getBrandCounts() {
    const products = await db.getAllProducts(category);
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

  async function getPriceRange() {
    const products = await db.getAllProducts(category);
    const prices = products.map(p => p.precio).filter(p => typeof p === 'number' && p > 0);
    if (prices.length === 0) return { min: 0, max: 3000 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }

  async function getRelatedProducts(sku, maxResults = 8) {
    const allProducts = await db.getAllProducts(category);
    const currentProduct = allProducts.find(p => p.sku === sku);
    if (!currentProduct) return [];
    const brand = parseBrand(currentProduct.nombre);
    let related = allProducts.filter(p => p.sku !== sku);
    const sameBrand = related.filter(p => parseBrand(p.nombre) === brand);
    if (sameBrand.length >= maxResults / 2) {
      related = sameBrand;
    } else {
      const priceMin = currentProduct.precio * 0.8;
      const priceMax = currentProduct.precio * 1.2;
      const similarPrice = related.filter(p => p.precio >= priceMin && p.precio <= priceMax);
      const combined = [...sameBrand, ...similarPrice];
      related = combined.filter((item, idx) => combined.findIndex(x => x.sku === item.sku) === idx);
    }
    related = related.sort(() => 0.5 - Math.random()).slice(0, maxResults);
    return related.map(enrichProduct);
  }

  return { filterProducts, getBrandCounts, getPriceRange, getRelatedProducts };
}

module.exports = { createComputerService };
