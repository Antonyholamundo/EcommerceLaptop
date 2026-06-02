const express = require('express');
const router = express.Router();
const dbManager = require('../database');
const { createComputerService } = require('../services/computerService');
const { enrichProduct } = require('../services/productService');

const gamingMonitorService = createComputerService('gaming-monitores', dbManager);

router.get('/', async (req, res) => {
  try {
    const { search = '', brands = '', minPrice, maxPrice, sort = 'relevancia', page = '1', limit = '12' } = req.query;
    const brandsArray = brands ? brands.split(',').filter(Boolean) : [];
    const result = await gamingMonitorService.filterProducts({
      search, brands: brandsArray,
      minPrice: minPrice !== undefined ? parseFloat(minPrice) : 0,
      maxPrice: maxPrice !== undefined ? parseFloat(maxPrice) : Infinity,
      sort, page: parseInt(page) || 1, limit: parseInt(limit) || 12,
    });
    res.json(result);
  } catch (error) {
    console.error('Error al filtrar gaming monitors:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/brands', async (req, res) => {
  try {
    const brands = await gamingMonitorService.getBrandCounts();
    res.json(brands);
  } catch (error) {
    console.error('Error al obtener marcas de gaming monitors:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/price-range', async (req, res) => {
  try {
    const range = await gamingMonitorService.getPriceRange();
    res.json(range);
  } catch (error) {
    console.error('Error al obtener rango de precios de gaming monitors:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const products = await dbManager.getAllProducts('gaming-monitores');
    res.json(products);
  } catch (error) {
    console.error('Error al obtener todos los gaming monitors:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/product/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const products = await dbManager.getAllProducts('gaming-monitores');
    const product = products.find(p => p.sku === sku);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(enrichProduct(product));
  } catch (error) {
    console.error('Error al obtener gaming monitor por SKU:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/product/:sku/related', async (req, res) => {
  try {
    const { sku } = req.params;
    const limit = parseInt(req.query.limit) || 8;
    const related = await gamingMonitorService.getRelatedProducts(sku, limit);
    res.json(related);
  } catch (error) {
    console.error('Error al obtener productos relacionados:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
