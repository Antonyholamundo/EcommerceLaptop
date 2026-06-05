/**
 * server.js — Web Service puro (EcuaCOMPU)
 *
 * Responsabilidad única: inicializar la base de datos, montar las rutas
 * de Express y levantar el servidor HTTP.
 *
 * El motor de scraping y la lógica de scheduling han sido movidos a
 * src/run-scraper.js, que se ejecuta como Cron Job independiente en Railway.
 */

'use strict';

// Cargar variables de entorno desde .env (debe ir antes de cualquier otro require)
require('dotenv').config();

const express = require('express');
const path    = require('path');
const { SERVER_CONFIG }  = require('./config');
const { initDatabase }   = require('./database');

const productsRoutes       = require('./routes/products');
const desktopsRoutes       = require('./routes/desktops');
const minipcsRoutes        = require('./routes/minipcs');
const motherboardsRoutes   = require('./routes/motherboards');
const componentsRoutes     = require('./routes/components');
const adminRoutes          = require('./routes/admin').router;
const scraperRoutes        = require('./routes/scraper');
const monitorsRoutes       = require('./routes/monitors');
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

app.use('/api/products',        productsRoutes);
app.use('/api/desktops',        desktopsRoutes);
app.use('/api/minipcs',         minipcsRoutes);
app.use('/api/motherboards',    motherboardsRoutes);
app.use('/api/components',      componentsRoutes);
app.use('/api/monitors',        monitorsRoutes);
app.use('/api/gaming-monitors', gamingMonitorsRoutes);
app.use('/api/scrape',          scraperRoutes);
app.use('/admin',               adminRoutes);

// ============================================================
// RUTAS DE RETROCOMPATIBILIDAD
// ============================================================

app.get('/api/productos/json',    (req, res) => res.redirect(301, '/api/products/all'));
app.get('/api/producto/:sku',     (req, res) => res.redirect(301, `/api/products/${req.params.sku}`));
app.get('/api/productos/marcas',  (req, res) => res.redirect(301, '/api/products/brands'));

// ============================================================
// INICIAR BASE DE DATOS Y SERVIDOR
// ============================================================

initDatabase()
  .then(() => {
    console.log('✅ Base de datos SQLite inicializada correctamente (modo WAL activo).');

    app.listen(SERVER_CONFIG.PORT, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 Servidor iniciado en http://localhost:${SERVER_CONFIG.PORT}`);
      console.log(`📂 Archivos estáticos desde /public`);
      console.log(`📡 API Laptops:         /api/products`);
      console.log(`📡 API PC Desktop:      /api/desktops`);
      console.log(`📡 API Mini PCs:        /api/minipcs`);
      console.log(`📡 API Motherboards:    /api/motherboards`);
      console.log(`📡 API Componentes:     /api/components/*`);
      console.log(`📡 API Monitores:       /api/monitors`);
      console.log(`📡 API Gaming Monitors: /api/gaming-monitors`);
      console.log(`📡 Scraper API:         /api/scrape`);
      console.log(`📊 Sync status:         /api/scrape/status`);
      console.log(`🔧 Panel admin:         /admin?key=${SERVER_CONFIG.ADMIN_KEY}`);
      console.log(`${'='.repeat(60)}\n`);
    });
  })
  .catch((err) => {
    console.error('❌ Error crítico al inicializar la base de datos:', err.message);
    process.exit(1);
  });
