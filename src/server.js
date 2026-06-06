/**
 * server.js — Web Service puro (Tienda Gamer EC)
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
const { initDatabase, getAllProducts } = require('./database');

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
// MIDDLEWARE: Redirección HTTPS y desduplicación WWW (SEO)
// ============================================================
app.use((req, res, next) => {
  // 1. Enforzar HTTPS en producción (detrás de un proxy)
  const isHttp = req.headers['x-forwarded-proto'] === 'http';
  
  // 2. Detectar y quitar 'www.' de manera consistente
  const host = req.headers.host || '';
  const hasWww = host.startsWith('www.');
  
  if (isHttp || hasWww) {
    const cleanHost = hasWww ? host.slice(4) : host;
    const newUrl = `https://${cleanHost}${req.originalUrl}`;
    return res.redirect(301, newUrl);
  }
  
  next();
});

// ============================================================
// PROTECCIÓN: Bloquear acceso directo a admin.html
// ============================================================
app.use((req, res, next) => {
  if (req.path === '/admin.html') {
    return res.redirect('/admin');
  }
  next();
});

// ============================================================
// REDIRECCIONES 301 PARA SEO (Retrocompatibilidad y desduplicación)
// ============================================================
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/laptops.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(301, `/laptops-gaming${query}`);
});
app.get('/computadoras.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(301, `/computadoras${query}`);
});
app.get('/minipcs.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(301, `/mini-pcs${query}`);
});
app.get('/monitores.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(301, `/monitores${query}`);
});
app.get('/gaming-monitores.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(301, `/monitores-gaming${query}`);
});
app.get('/motherboard.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(301, `/motherboards${query}`);
});
app.get('/catalogo.html', (req, res) => {
  const cat = req.query.cat || 'procesadores';
  const queryParams = { ...req.query };
  delete queryParams.cat;
  const qStr = new URLSearchParams(queryParams).toString();
  const suffix = qStr ? `?${qStr}` : '';
  res.redirect(301, `/componentes/${cat}${suffix}`);
});
app.get('/product.html', (req, res) => {
  const sku = req.query.sku;
  const cat = req.query.cat || 'laptops';
  if (sku) {
    res.redirect(301, `/producto/${cat}/${sku}`);
  } else {
    res.redirect(301, '/');
  }
});

// ============================================================
// GENERACIÓN DINÁMICA DE SITEMAP.XML
// ============================================================
app.get('/sitemap.xml', async (req, res) => {
  try {
    const products = await getAllProducts('all'); // Obtener todos los productos activos
    const baseUrl = 'https://tiendagamerec.up.railway.app';
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // 1. Homepage
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    
    // 2. Páginas de Categoría
    const categories = [
      { path: '/laptops-gaming', priority: '0.8' },
      { path: '/computadoras', priority: '0.8' },
      { path: '/mini-pcs', priority: '0.8' },
      { path: '/monitores', priority: '0.8' },
      { path: '/monitores-gaming', priority: '0.8' },
      { path: '/motherboards', priority: '0.8' },
      { path: '/componentes/procesadores', priority: '0.8' },
      { path: '/componentes/tarjetas-video', priority: '0.8' },
      { path: '/componentes/ram', priority: '0.8' },
      { path: '/componentes/almacenamiento', priority: '0.8' },
      { path: '/componentes/fuentes', priority: '0.8' },
      { path: '/componentes/cases', priority: '0.8' },
      { path: '/componentes/coolers', priority: '0.8' },
      { path: '/componentes/ventiladores', priority: '0.8' }
    ];
    
    for (const cat of categories) {
      xml += `  <url>\n    <loc>${baseUrl}${cat.path}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${cat.priority}</priority>\n  </url>\n`;
    }
    
    // 3. Productos individuales
    const today = new Date().toISOString().split('T')[0];
    for (const p of products) {
      const cat = p.categoria || 'laptops';
      const lastmod = p.ultima_actualizacion 
        ? new Date(p.ultima_actualizacion).toISOString().split('T')[0]
        : today;
      xml += `  <url>\n    <loc>${baseUrl}/producto/${cat}/${p.sku}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    }
    
    xml += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (error) {
    console.error('Error al generar sitemap.xml:', error);
    res.status(500).end();
  }
});

// ============================================================
// RUTAS AMIGABLES (URL REWRITING)
// ============================================================
app.get('/laptops-gaming', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'laptops.html'));
});
app.get('/computadoras', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'computadoras.html'));
});
app.get('/mini-pcs', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'minipcs.html'));
});
app.get('/monitores', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'monitores.html'));
});
app.get('/monitores-gaming', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'gaming-monitores.html'));
});
app.get('/motherboards', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'motherboard.html'));
});
app.get('/componentes/:cat', (req, res, next) => {
  const validCategories = ['procesadores', 'tarjetas-video', 'ram', 'almacenamiento', 'fuentes', 'cases', 'coolers', 'ventiladores'];
  if (validCategories.includes(req.params.cat)) {
    res.sendFile(path.join(__dirname, '..', 'public', 'catalogo.html'));
  } else {
    next();
  }
});
app.get('/producto/:sku', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'product.html'));
});
app.get('/producto/:cat/:sku', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'product.html'));
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
