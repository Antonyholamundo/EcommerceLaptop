const express = require('express');
const router = express.Router();
const dbManager = require('../database');
const { createComputerService } = require('../services/computerService');
const { enrichProduct } = require('../services/productService');

// Usamos el id de la categoria como parámetro para que todo sea dinámico
// ej: /api/components/procesadores, /api/components/tarjetas-video

// Cache de servicios instanciados
const servicesMap = {};

function getComponentService(category) {
  if (!servicesMap[category]) {
    servicesMap[category] = createComputerService(category, dbManager);
  }
  return servicesMap[category];
}

router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const service = getComponentService(category);

    const { search = '', brands = '', minPrice, maxPrice, sort = 'relevancia', page = '1', limit = '12' } = req.query;
    const brandsArray = brands ? brands.split(',').filter(Boolean) : [];
    
    const result = await service.filterProducts({
      search, brands: brandsArray,
      minPrice: minPrice !== undefined ? parseFloat(minPrice) : 0,
      maxPrice: maxPrice !== undefined ? parseFloat(maxPrice) : Infinity,
      sort, page: parseInt(page) || 1, limit: parseInt(limit) || 12,
    });
    
    res.json(result);
  } catch (error) {
    console.error(`Error al filtrar componentes en ${req.params.category}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:category/brands', async (req, res) => {
  try {
    const { category } = req.params;
    const service = getComponentService(category);
    const brands = await service.getBrandCounts();
    res.json(brands);
  } catch (error) {
    console.error(`Error al obtener marcas de ${req.params.category}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:category/price-range', async (req, res) => {
  try {
    const { category } = req.params;
    const service = getComponentService(category);
    const range = await service.getPriceRange();
    res.json(range);
  } catch (error) {
    console.error(`Error al obtener rango de precios de ${req.params.category}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:category/all', async (req, res) => {
  try {
    const { category } = req.params;
    const products = await dbManager.getAllProducts(category);
    res.json(products);
  } catch (error) {
    console.error(`Error al obtener todos los productos de ${req.params.category}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:category/product/:sku', async (req, res) => {
  try {
    const { category, sku } = req.params;
    const products = await dbManager.getAllProducts(category);
    const product = products.find(p => p.sku === sku);
    
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(enrichProduct(product));
  } catch (error) {
    console.error(`Error al obtener producto ${req.params.sku} en ${req.params.category}:`, error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:category/product/:sku/related', async (req, res) => {
  try {
    const { category, sku } = req.params;
    const service = getComponentService(category);
    const limit = parseInt(req.query.limit) || 8;
    
    const related = await service.getRelatedProducts(sku, limit);
    res.json(related);
  } catch (error) {
    console.error(`Error al obtener relacionados para ${req.params.sku}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
