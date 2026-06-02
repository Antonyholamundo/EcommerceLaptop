const express = require('express');
const path = require('path');
const { SERVER_CONFIG } = require('./config');
const { scrapeLaptops, scrapeDesktops, scrapeMinipcs, scrapeMotherboards, scrapeMonitors, scrapeGamingMonitors, scrapeAllComponents } = require('./scraper');

const productsRoutes = require('./routes/products');
const desktopsRoutes = require('./routes/desktops');
const minipcsRoutes = require('./routes/minipcs');
const motherboardsRoutes = require('./routes/motherboards');
const componentsRoutes = require('./routes/components');
const adminRoutes = require('./routes/admin');
const scraperRoutes = require('./routes/scraper');
const monitorsRoutes = require('./routes/monitors');
const gamingMonitorsRoutes = require('./routes/gaming-monitors');

const app = express();

app.use(express.json());

// ============================================================
// PROTECCIÓN: Bloquear acceso directo a admin.html
// ============================================================
app.use((req, res, next) => {
  if (req.path === '/admin.html') {
    return res.redirect('/admin');
  }
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ============================================================
// RUTAS API
// ============================================================

app.use('/api/products', productsRoutes);
app.use('/api/desktops', desktopsRoutes);
app.use('/api/minipcs', minipcsRoutes);
app.use('/api/motherboards', motherboardsRoutes);
app.use('/api/components', componentsRoutes);
app.use('/api/monitors', monitorsRoutes);
app.use('/api/gaming-monitors', gamingMonitorsRoutes);
app.use('/api/scrape', scraperRoutes);
app.use('/admin', adminRoutes);

// ============================================================
// RUTAS DE RETROCOMPATIBILIDAD
// ============================================================

app.get('/api/productos/json', (req, res) => {
  res.redirect(301, '/api/products/all');
});

app.get('/api/producto/:sku', (req, res) => {
  res.redirect(301, `/api/products/${req.params.sku}`);
});

app.get('/api/productos/marcas', (req, res) => {
  res.redirect(301, '/api/products/brands');
});

// ============================================================
// PLANIFICADOR DE ACTUALIZACIÓN AUTOMÁTICA EN SEGUNDO PLANO
// ============================================================

setInterval(async () => {
  console.log('🕒 [Automatización] Iniciando actualización rutinaria de laptops en segundo plano...');
  try {
    const totalScraped = await scrapeLaptops();
    console.log(`🕒 [Automatización] Actualización de laptops exitosa. ${totalScraped} productos sincronizados.`);
  } catch (error) {
    console.error('❌ [Automatización] Fallo en sincronización de laptops:', error.message);
  }
}, SERVER_CONFIG.SCRAPE_INTERVAL_MS);

setInterval(async () => {
  console.log('🕒 [Automatización] Iniciando actualización rutinaria de PC desktop en segundo plano...');
  try {
    const totalScraped = await scrapeDesktops();
    console.log(`🕒 [Automatización] Actualización de PC desktop exitosa. ${totalScraped} productos sincronizados.`);
  } catch (error) {
    console.error('❌ [Automatización] Fallo en sincronización de PC desktop:', error.message);
  }
}, SERVER_CONFIG.SCRAPE_INTERVAL_MS);

setInterval(async () => {
  console.log('🕒 [Automatización] Iniciando actualización rutinaria de Mini PCs en segundo plano...');
  try {
    const totalScraped = await scrapeMinipcs();
    console.log(`🕒 [Automatización] Actualización de Mini PCs exitosa. ${totalScraped} productos sincronizados.`);
  } catch (error) {
    console.error('❌ [Automatización] Fallo en sincronización de Mini PCs:', error.message);
  }
}, SERVER_CONFIG.SCRAPE_INTERVAL_MS);

setInterval(async () => {
  console.log('🕒 [Automatización] Iniciando actualización rutinaria de Motherboards en segundo plano...');
  try {
    const totalScraped = await scrapeMotherboards();
    console.log(`🕒 [Automatización] Actualización de Motherboards exitosa. ${totalScraped} productos sincronizados.`);
  } catch (error) {
    console.error('❌ [Automatización] Fallo en sincronización de Motherboards:', error.message);
  }
}, SERVER_CONFIG.SCRAPE_INTERVAL_MS);

setInterval(async () => {
  console.log('🕒 [Automatización] Iniciando actualización rutinaria de Monitores en segundo plano...');
  try {
    const totalScraped = await scrapeMonitors();
    console.log(`🕒 [Automatización] Actualización de Monitores exitosa. ${totalScraped} productos sincronizados.`);
  } catch (error) {
    console.error('❌ [Automatización] Fallo en sincronización de Monitores:', error.message);
  }
}, SERVER_CONFIG.SCRAPE_INTERVAL_MS);

setInterval(async () => {
  console.log('🕒 [Automatización] Iniciando actualización rutinaria de Gaming Monitores en segundo plano...');
  try {
    const totalScraped = await scrapeGamingMonitors();
    console.log(`🕒 [Automatización] Actualización de Gaming Monitores exitosa. ${totalScraped} productos sincronizados.`);
  } catch (error) {
    console.error('❌ [Automatización] Fallo en sincronización de Gaming Monitores:', error.message);
  }
}, SERVER_CONFIG.SCRAPE_INTERVAL_MS);

// Ciclo unificado para las nuevas categorías de componentes
setInterval(async () => {
  console.log('🕒 [Automatización] Iniciando actualización rutinaria global de componentes...');
  try {
    const totalScraped = await scrapeAllComponents();
    console.log(`🕒 [Automatización] Actualización global de componentes exitosa. ${totalScraped} productos sincronizados.`);
  } catch (error) {
    console.error('❌ [Automatización] Fallo en sincronización global de componentes:', error.message);
  }
}, SERVER_CONFIG.SCRAPE_INTERVAL_MS + 60000); // 1 minuto desfasado de los otros para no solaparse de golpe

// ============================================================
// INICIAR BASE DE DATOS Y SERVIDOR
// ============================================================

const { initDatabase } = require('./database');

initDatabase()
  .then(() => {
    console.log('✅ Base de datos SQLite inicializada correctamente.');
    
    app.listen(SERVER_CONFIG.PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Servidor iniciado en http://localhost:${SERVER_CONFIG.PORT}`);
      console.log(`📂 Servidor estático apuntando a /public`);
      console.log(`📡 API REST en /api/products`);
      console.log(`📡 API PC Desktop en /api/desktops`);
      console.log(`📡 API Mini PCs en /api/minipcs`);
      console.log(`📡 API Motherboards en /api/motherboards`);
      console.log(`📡 API Nuevos Componentes en /api/components/*`);
      console.log(`📡 API Monitores en /api/monitors`);
      console.log(`📡 API Gaming Monitores en /api/gaming-monitors`);
      console.log(`🔧 Panel admin en /admin?key=${SERVER_CONFIG.ADMIN_KEY}`);
      console.log(`======================================================\n`);
    });
  })
  .catch((err) => {
    console.error('❌ Error crítico al inicializar la base de datos:', err.message);
    process.exit(1);
  });
