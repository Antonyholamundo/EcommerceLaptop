/**
 * routes/scraper.js — ScraperAgent v2
 *
 * Endpoints de sincronización. Ahora devuelven el JSON estructurado completo
 * de cada ciclo de sync (con sync_id, summary, changes, errors).
 *
 * Protección: todos los endpoints de escritura (POST) y los de observabilidad
 * sensible (status, errors) están protegidos con Basic Authentication.
 * Solo GET /api/scrape/categories es público.
 *
 * Endpoints:
 *   GET  /api/scrape/status      → últimos 20 registros de sync_log  [auth]
 *   GET  /api/scrape/errors      → últimos 50 errores de scrape_errors [auth]
 *   GET  /api/scrape/categories  → lista de categorías disponibles    [public]
 *   POST /api/scrape/:category   → sync de una categoría por nombre   [auth]
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const { adminAuth } = require('./admin');

const {
  syncLaptops,
  syncDesktops,
  syncMinipcs,
  syncMotherboards,
  syncMonitors,
  syncGamingMonitors,
  syncAllComponents,
  syncByName,
  syncAll,
} = require('../scraper');

const { CATEGORY_MAP }  = require('../config');
const { getRecentSyncs, getRecentErrors } = require('../database');

// ============================================================
// HELPERS
// ============================================================

/**
 * Wrapper genérico para ejecutar un sync y responder con el JSON estructurado.
 * Maneja errores globales del proceso (no de productos individuales).
 */
function runSync(syncFn, res) {
  syncFn()
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('[routes/scraper] Error crítico:', err);
      res.status(500).json({
        error: 'sync_failed',
        message: err.message || 'El proceso de sincronización falló inesperadamente.',
      });
    });
}

// ============================================================
// SYNC COMPLETO — TODAS LAS CATEGORÍAS
// ============================================================

/**
 * Estado global para evitar syncs simultáneos.
 * Un sync completo puede durar 30-60 min — no queremos dos corriendo a la vez.
 */
let fullSyncRunning = false;
let fullSyncStartedAt = null;

/**
 * POST /api/scrape/all
 * Lanza syncAll() en BACKGROUND y responde 202 inmediatamente.
 * El proceso corre completo aunque el cliente cierre la conexión.
 * Consulta /api/scrape/status para ver el progreso por categoría.
 */
router.post('/all', adminAuth, (req, res) => {
  if (fullSyncRunning) {
    return res.status(409).json({
      error: 'sync_already_running',
      message: 'Ya hay un sync completo en curso.',
      started_at: fullSyncStartedAt,
    });
  }

  fullSyncRunning = true;
  fullSyncStartedAt = new Date().toISOString();

  // Responder inmediatamente — el proceso sigue en background
  res.status(202).json({
    status: 'accepted',
    message: 'Sync completo de todas las categorías iniciado en background.',
    started_at: fullSyncStartedAt,
    categories: 14,
    note: 'Consulta GET /api/scrape/status para ver el avance por categoría.',
  });

  // Lanzar sin await — corre independiente de la respuesta HTTP
  syncAll()
    .then((result) => {
      console.log(`\n✅ [POST /api/scrape/all] Sync completo finalizado.`);
      console.log(`   Resumen: +${result.summary.inserted} | ~${result.summary.updated} | -${result.summary.deleted} | ❌${result.summary.errors}`);
    })
    .catch((err) => {
      console.error(`\n❌ [POST /api/scrape/all] Error crítico en syncAll: ${err.message}`);
    })
    .finally(() => {
      fullSyncRunning = false;
      fullSyncStartedAt = null;
    });
});

/**
 * GET /api/scrape/all/status
 * Indica si hay un sync completo actualmente en curso.
 */
router.get('/all/status', (req, res) => {
  res.json({
    running: fullSyncRunning,
    started_at: fullSyncStartedAt,
  });
});

// ============================================================
// ENDPOINTS DE OBSERVABILIDAD
// ============================================================

/**
 * GET /api/scrape/status
 * Retorna los últimos 20 sync_log para el panel de admin.
 */
router.get('/status', adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const syncs = await getRecentSyncs(limit);
    const parsed = syncs.map((s) => ({
      ...s,
      summary: s.summary_json ? JSON.parse(s.summary_json) : {},
    }));
    res.json({ syncs: parsed, count: parsed.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/scrape/errors
 * Retorna los últimos 50 errores de scraping.
 */
router.get('/errors', adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const errors = await getRecentErrors(limit);
    res.json({ errors, count: errors.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/scrape/categories
 * Lista las categorías disponibles para sync.
 */
router.get('/categories', (req, res) => {
  const categories = Object.entries(CATEGORY_MAP).map(([name, { label }]) => ({
    name,
    label,
  }));
  res.json({ categories });
});

// ============================================================
// ENDPOINTS DE SYNC POR CATEGORÍA (heredados)
// ============================================================

/** POST /api/scrape → sync de laptops (retrocompatibilidad) */
router.post('/', adminAuth, (req, res) => {
  console.log('[API] POST /api/scrape → syncLaptops');
  runSync(syncLaptops, res);
});

/** POST /api/scrape/desktops */
router.post('/desktops', adminAuth, (req, res) => {
  console.log('[API] POST /api/scrape/desktops');
  runSync(syncDesktops, res);
});

/** POST /api/scrape/minipcs */
router.post('/minipcs', adminAuth, (req, res) => {
  console.log('[API] POST /api/scrape/minipcs');
  runSync(syncMinipcs, res);
});

/** POST /api/scrape/motherboards */
router.post('/motherboards', adminAuth, (req, res) => {
  console.log('[API] POST /api/scrape/motherboards');
  runSync(syncMotherboards, res);
});

/** POST /api/scrape/monitors */
router.post('/monitors', adminAuth, (req, res) => {
  console.log('[API] POST /api/scrape/monitors');
  runSync(syncMonitors, res);
});

/** POST /api/scrape/gaming-monitors */
router.post('/gaming-monitors', adminAuth, (req, res) => {
  console.log('[API] POST /api/scrape/gaming-monitors');
  runSync(syncGamingMonitors, res);
});

/** POST /api/scrape/components → sync de los 8 componentes en secuencia */
router.post('/components', adminAuth, (req, res) => {
  console.log('[API] POST /api/scrape/components');
  runSync(syncAllComponents, res);
});

/**
 * POST /api/scrape/:category
 * Sync dinámico por nombre de categoría.
 * e.g. POST /api/scrape/procesadores
 */
router.post('/:category', adminAuth, (req, res) => {
  const { category } = req.params;
  console.log(`[API] POST /api/scrape/${category}`);

  if (!CATEGORY_MAP[category]) {
    return res.status(400).json({
      error: 'unknown_category',
      message: `Categoría '${category}' no reconocida.`,
      available: Object.keys(CATEGORY_MAP),
    });
  }

  runSync(() => syncByName(category), res);
});

module.exports = router;
