/**
 * run-scraper.js — Punto de entrada exclusivo del Cron Job (Railway)
 *
 * Este script es completamente independiente del servidor web.
 * Se ejecuta una sola vez por invocación del Cron Job, sin setInterval.
 *
 * Flujo:
 *   1. Inicializar la base de datos (crea tablas / aplica WAL si es la primera vez)
 *   2. Ejecutar syncAll() — sincroniza las 14 categorías en secuencia
 *   3. Imprimir resumen en consola (visible en los logs de Railway)
 *   4. process.exit(0) → éxito | process.exit(1) → error fatal
 */

'use strict';

// Cargar variables de entorno desde .env
require('dotenv').config();

const { initDatabase } = require('./database');
const { syncAll }      = require('./scraper');

async function main() {
  console.log('='.repeat(60));
  console.log('🕐 [Cron Job] Scraper iniciado —', new Date().toISOString());
  console.log('='.repeat(60));

  // ── Paso 1: Conectar y preparar la base de datos ─────────────────────────
  try {
    await initDatabase();
    console.log('✅ [Cron Job] Base de datos inicializada (WAL activado).');
  } catch (err) {
    console.error('❌ [Cron Job] Error fatal al inicializar la base de datos:', err.message);
    process.exit(1);
  }

  // ── Paso 2: Ejecutar sync completo ───────────────────────────────────────
  let result;
  try {
    result = await syncAll();
  } catch (err) {
    console.error('❌ [Cron Job] Error fatal durante syncAll():', err.message);
    process.exit(1);
  }

  // ── Paso 3: Imprimir resumen ─────────────────────────────────────────────
  const { duration_seconds, categories_synced, summary } = result;
  console.log('\n' + '='.repeat(60));
  console.log('📊 [Cron Job] Resumen del ciclo de sincronización');
  console.log('='.repeat(60));
  console.log(`  ⏱  Duración total  : ${duration_seconds}s`);
  console.log(`  📂 Categorías sync : ${categories_synced}`);
  console.log(`  ➕ Insertados       : ${summary.inserted}`);
  console.log(`  🔄 Actualizados    : ${summary.updated}`);
  console.log(`  🗑  Eliminados      : ${summary.deleted}`);
  console.log(`  ❌ Errores          : ${summary.errors}`);
  console.log('='.repeat(60));
  console.log('✅ [Cron Job] Ciclo completado —', new Date().toISOString());

  // ── Paso 4: Salir con éxito ───────────────────────────────────────────────
  process.exit(0);
}

main();
