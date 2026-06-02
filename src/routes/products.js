const express = require('express');
const router = express.Router();
const {
  filterProducts,
  getBrandCounts,
  getRelatedProducts,
  enrichProduct,
  getPriceRange,
} = require('../services/productService');
const { getAllProducts } = require('../database');

router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      brands = '',
      minPrice,
      maxPrice,
      sort = 'relevancia',
      page = '1',
      limit = '12',
    } = req.query;

    const brandsArray = brands ? brands.split(',').filter(Boolean) : [];

    const result = await filterProducts({
      search,
      brands: brandsArray,
      minPrice: minPrice !== undefined ? parseFloat(minPrice) : 0,
      maxPrice: maxPrice !== undefined ? parseFloat(maxPrice) : Infinity,
      sort,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 12,
      category: 'laptops'
    });

    res.json(result);
  } catch (error) {
    console.error('Error al filtrar productos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/brands', async (req, res) => {
  try {
    const brands = await getBrandCounts('laptops');
    res.json(brands);
  } catch (error) {
    console.error('Error al obtener marcas:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/price-range', async (req, res) => {
  try {
    const range = await getPriceRange('laptops');
    res.json(range);
  } catch (error) {
    console.error('Error al obtener rango de precios:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const products = await getAllProducts('laptops');
    res.json(products);
  } catch (error) {
    console.error('Error al obtener todos los productos:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const products = await getAllProducts('laptops');
    const product = products.find(p => p.sku === sku);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const enriched = enrichProduct(product);
    res.json(enriched);
  } catch (error) {
    console.error('Error al obtener producto por SKU:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:sku/related', async (req, res) => {
  try {
    const { sku } = req.params;
    const limit = parseInt(req.query.limit) || 8;
    const related = await getRelatedProducts(sku, limit, 'laptops');
    res.json(related);
  } catch (error) {
    console.error('Error al obtener productos relacionados:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
