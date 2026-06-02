/**
 * routes/scraper.js — Ruta de ejecución de scraping
 * 
 * Devuelve JSON con el resultado, NO HTML.
 */

const express = require('express');
const router = express.Router();
const { scrapeLaptops, scrapeDesktops, scrapeMinipcs, scrapeMotherboards, scrapeMonitors, scrapeGamingMonitors, scrapeAllComponents } = require('../scraper');
const { getAllProducts } = require('../database');

/**
 * POST /api/scrape
 * 
 * Ejecuta el scraping de laptops y devuelve el resultado como JSON.
 */
router.post('/', async (req, res) => {
  try {
    console.log('Iniciando proceso de scraping de laptops a petición del usuario...');
    const totalScraped = await scrapeLaptops();
    console.log(`Se procesaron ${totalScraped} laptops con éxito.`);

    const products = await getAllProducts('laptops');

    res.json({
      success: true,
      message: `Se procesaron ${totalScraped} laptops con éxito.`,
      totalScraped,
      totalProducts: products.length,
    });
  } catch (error) {
    console.error('Error al ejecutar el scraper:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'No se pudo conectar al sitio web.',
      message: 'Por favor verifica tu conexión a internet o el estado de Tecnomegastore.',
    });
  }
});

/**
 * POST /api/scrape/desktops
 * 
 * Ejecuta el scraping de PC de escritorio y devuelve el resultado como JSON.
 */
router.post('/desktops', async (req, res) => {
  try {
    console.log('Iniciando proceso de scraping de PC desktop a petición del usuario...');
    const totalScraped = await scrapeDesktops();
    console.log(`Se procesaron ${totalScraped} PC desktop con éxito.`);

    res.json({
      success: true,
      message: `Se procesaron ${totalScraped} PC de escritorio con éxito.`,
      totalScraped,
    });
  } catch (error) {
    console.error('Error al ejecutar el scraper de desktops:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'No se pudo conectar al sitio web.',
      message: 'Por favor verifica tu conexión a internet o el estado de Tecnomegastore.',
    });
  }
});

/**
 * POST /api/scrape/minipcs
 * 
 * Ejecuta el scraping de Mini PCs y devuelve el resultado como JSON.
 */
router.post('/minipcs', async (req, res) => {
  try {
    console.log('Iniciando proceso de scraping de Mini PCs a petición del usuario...');
    const totalScraped = await scrapeMinipcs();
    console.log(`Se procesaron ${totalScraped} Mini PCs con éxito.`);

    res.json({
      success: true,
      message: `Se procesaron ${totalScraped} Mini PCs con éxito.`,
      totalScraped,
    });
  } catch (error) {
    console.error('Error al ejecutar el scraper de minipcs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'No se pudo conectar al sitio web.',
      message: 'Por favor verifica tu conexión a internet o el estado de Tecnomegastore.',
    });
  }
});

/**
 * POST /api/scrape/motherboards
 * 
 * Ejecuta el scraping de Motherboards y devuelve el resultado como JSON.
 */
router.post('/motherboards', async (req, res) => {
  try {
    console.log('Iniciando proceso de scraping de Motherboards a petición del usuario...');
    const totalScraped = await scrapeMotherboards();
    console.log(`Se procesaron ${totalScraped} Motherboards con éxito.`);

    res.json({
      success: true,
      message: `Se procesaron ${totalScraped} Motherboards con éxito.`,
      totalScraped,
    });
  } catch (error) {
    console.error('Error al ejecutar el scraper de motherboards:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'No se pudo conectar al sitio web.',
      message: 'Por favor verifica tu conexión a internet o el estado de Tecnomegastore.',
    });
  }
});

/**
 * POST /api/scrape/monitors
 * 
 * Ejecuta el scraping de Monitores y devuelve el resultado como JSON.
 */
router.post('/monitors', async (req, res) => {
  try {
    console.log('Iniciando proceso de scraping de Monitores a petición del usuario...');
    const totalScraped = await scrapeMonitors();
    console.log(`Se procesaron ${totalScraped} Monitores con éxito.`);

    res.json({
      success: true,
      message: `Se procesaron ${totalScraped} Monitores con éxito.`,
      totalScraped,
    });
  } catch (error) {
    console.error('Error al ejecutar el scraper de monitores:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'No se pudo conectar al sitio web.',
      message: 'Por favor verifica tu conexión a internet o el estado de Tecnomegastore.',
    });
  }
});

/**
 * POST /api/scrape/gaming-monitors
 * 
 * Ejecuta el scraping de Gaming Monitores y devuelve el resultado como JSON.
 */
router.post('/gaming-monitors', async (req, res) => {
  try {
    console.log('Iniciando proceso de scraping de Gaming Monitores a petición del usuario...');
    const totalScraped = await scrapeGamingMonitors();
    console.log(`Se procesaron ${totalScraped} Gaming Monitores con éxito.`);

    res.json({
      success: true,
      message: `Se procesaron ${totalScraped} Gaming Monitores con éxito.`,
      totalScraped,
    });
  } catch (error) {
    console.error('Error al ejecutar el scraper de gaming monitors:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'No se pudo conectar al sitio web.',
      message: 'Por favor verifica tu conexión a internet o el estado de Tecnomegastore.',
    });
  }
});

/**
 * POST /api/scrape/components
 * 
 * Ejecuta el scraping secuencial de los 8 componentes y devuelve el resultado.
 */
router.post('/components', async (req, res) => {
  try {
    console.log('Iniciando proceso de scraping global de componentes a petición del usuario...');
    const totalScraped = await scrapeAllComponents();
    console.log(`Se procesaron ${totalScraped} Componentes con éxito.`);

    res.json({
      success: true,
      message: `Se procesaron ${totalScraped} Componentes con éxito en total.`,
      totalScraped,
    });
  } catch (error) {
    console.error('Error al ejecutar el scraper global de componentes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'No se pudo completar el scraping global.',
    });
  }
});

module.exports = router;
