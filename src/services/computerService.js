const { parseBrand, enrichProduct, BRAND_KEYWORDS_MAP } = require('./productService');

function createComputerService(category, db) {
  /**
   * Filtra, ordena y pagina productos delegando completamente a SQLite.
   * Reemplaza el getAllProducts() + .filter() + .sort() + .slice() en memoria.
   * La carga de memoria pasa de O(N_total) a O(page_size) para esta función.
   */
  async function filterProducts(options = {}) {
    const {
      search   = '',
      brands   = [],
      minPrice = 0,
      maxPrice = Infinity,
      sort     = 'relevancia',
      page     = 1,
      limit    = 12,
    } = options;

    // Delegar todo a la capa SQL. db.getPaginatedProducts recibe
    // brandKeywords para traducir marcas a condiciones LIKE en SQL.
    const { rows, total, page: safePage, totalPages, limit: safeLimit } =
      await db.getPaginatedProducts({
        category,
        search,
        brands,
        brandKeywords: BRAND_KEYWORDS_MAP,
        minPrice,
        maxPrice: maxPrice === Infinity ? 1e9 : maxPrice,
        sort,
        page,
        limit,
      });

    // Solo aplicamos enrichProduct sobre la página ya filtrada y paginada.
    const products = rows.map(enrichProduct);

    return { products, total, page: safePage, totalPages, limit: safeLimit };
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
