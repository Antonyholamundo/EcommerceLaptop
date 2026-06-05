/**
 * scraper.js — ScraperAgent v2
 *
 * Motor de sincronización incremental del catálogo.
 * No "visita y sobreescribe" — compara, detecta cambios y actúa en consecuencia.
 *
 * Flujo por categoría:
 *   FASE 1 → Snapshot del sitio  (paginación robusta sin while-true)
 *   FASE 2 → Snapshot de la BD   (SKUs activos actuales)
 *   FASE 3 → Diff                (toAdd / toCheck / toDelete)
 *   FASE 4 → Soft-delete         (verificación HTTP individual primero)
 *   FASE 5 → Actualizaciones     (solo si precio o hash de specs cambió)
 *   FASE 6 → Inserciones         (Level 1 + Level 2 completo)
 *   OUTPUT → JSON estructurado con sync_id
 */

'use strict';

const crypto = require('crypto');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const database = require('./database');
const { ECOMMERCE, SCRAPER_CONFIG, CATEGORY_MAP } = require('./config');

chromium.use(stealth);

// ============================================================
// UTILIDADES
// ============================================================

/** Genera un UUID v4 simple sin dependencias externas */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Hash MD5 de un objeto/string para detección de cambios en specs */
function hashSpecs(specsObj) {
  const str = typeof specsObj === 'string' ? specsObj : JSON.stringify(specsObj);
  return crypto.createHash('md5').update(str).digest('hex');
}

/** Limpia y parsea texto de precio a número. Maneja formatos europeos y americanos */
function cleanPrice(text) {
  if (!text) return 0;
  let s = text.replace(/[^0-9.,]/g, '').trim();
  if (!s) return 0;

  const ci = s.lastIndexOf(',');
  const di = s.lastIndexOf('.');

  if (ci > di) {
    // Formato europeo: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (di > ci) {
    // Formato americano: 1,234.56
    s = s.replace(/,/g, '');
  } else if (ci !== -1 && di === -1) {
    // Solo comas: puede ser miles (1,000) o decimal (1,5)
    s = ci === s.length - 3 ? s.replace(',', '') : s.replace(',', '.');
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Pausa asíncrona */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Ejecuta una función con reintentos y backoff exponencial.
 * Si falla todas las veces, loguea el error y devuelve null.
 */
async function withRetry(fn, label, sku, url) {
  const delays = SCRAPER_CONFIG.RETRY_DELAYS_MS;
  let lastError;

  for (let attempt = 0; attempt <= SCRAPER_CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < SCRAPER_CONFIG.MAX_RETRIES) {
        const wait = delays[attempt] || 6000;
        console.warn(`    [${label}] Reintento ${attempt + 1}/${SCRAPER_CONFIG.MAX_RETRIES} en ${wait}ms — SKU ${sku}: ${err.message}`);
        await sleep(wait);
      }
    }
  }

  // Agotados los reintentos → registrar y continuar
  await database.logScrapeError(sku, url, lastError.message, SCRAPER_CONFIG.MAX_RETRIES + 1);
  console.error(`    [${label}] ❌ SKU ${sku} falló tras ${SCRAPER_CONFIG.MAX_RETRIES + 1} intentos. Registrado en scrape_errors.`);
  return null;
}

// ============================================================
// NIVEL 1 — EXTRACCIÓN DE LISTADO (una página)
// ============================================================

/**
 * Extrae todos los productos visibles en una página de categoría.
 * Devuelve array de { sku, nombre, precioTexto, imagenUrl, url }
 */
async function extractPageProducts(page) {
  return page.evaluate(() => {
    const productLinks = Array.from(document.querySelectorAll('a'))
      .filter((a) => a.href && a.href.includes('/product/') && a.href.includes('code='));

    const seen = new Set();
    const results = [];

    for (const link of productLinks) {
      const urlStr = link.href;
      let sku = '';

      try {
        sku = new URL(urlStr).searchParams.get('code') || '';
      } catch (_) {
        const m = urlStr.match(/[?&]code=([^&]+)/);
        if (m) sku = m[1];
      }

      if (!sku || seen.has(sku)) continue;
      seen.add(sku);

      const nombre = link.innerText.trim();
      const card = link.closest('.bg-white') || link.parentElement?.parentElement;

      let precioTexto = '';
      let imagenUrl = '';

      if (card) {
        const imgEl = card.querySelector('img');
        imagenUrl = imgEl ? imgEl.src : '';

        const allEls = Array.from(card.querySelectorAll('*'));
        const priceEl = allEls.find((el) => {
          const txt = el.textContent.trim();
          return txt.startsWith('$') && /\d/.test(txt);
        });

        if (priceEl) {
          precioTexto = priceEl.textContent.trim();
        } else {
          const m = card.innerText.match(/\$\s*([0-9.,]+)/);
          if (m) precioTexto = m[0];
        }
      }

      if (sku && nombre && precioTexto) {
        results.push({ sku, nombre, precioTexto, imagenUrl, url: urlStr });
      }
    }

    return results;
  });
}

// ============================================================
// NIVEL 2 — EXTRACCIÓN DE SPECS (página individual)
// ============================================================

/**
 * Visita la URL individual de un producto y extrae specs + imágenes.
 * Aplica 5 estrategias en orden: JSON-LD, tabla, dl, li, divs.
 */
async function scrapeProductSpecs(page, productUrl, sku, label) {
  const fn = async () => {
    await page.goto(productUrl, {
      waitUntil: 'networkidle',
      timeout: SCRAPER_CONFIG.PRODUCT_TIMEOUT_MS,
    });
    await page.waitForTimeout(SCRAPER_CONFIG.PRODUCT_RENDER_WAIT_MS);

    const result = await page.evaluate(() => {
      const specs = {};
      const images = [];

      // ── Estrategia 1: JSON-LD (más confiable, sin DOM parsing) ──────────
      document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
        try {
          const data = JSON.parse(el.innerText);
          const entries = Array.isArray(data) ? data : [data];
          for (const entry of entries) {
            if (entry['@type'] === 'Product') {
              if (entry.name) specs['nombre_ld'] = entry.name;
              if (entry.description) specs['descripcion'] = entry.description;
              if (entry.brand?.name) specs['marca'] = entry.brand.name;
              if (entry.offers?.price) specs['precio_ld'] = String(entry.offers.price);
              if (entry.image) {
                const imgs = Array.isArray(entry.image) ? entry.image : [entry.image];
                imgs.forEach((i) => { if (i && !images.includes(i)) images.push(i); });
              }
            }
            // Iterar additionalProperty si existe
            if (entry.additionalProperty) {
              for (const prop of entry.additionalProperty) {
                if (prop.name && prop.value) {
                  specs[prop.name.toLowerCase()] = String(prop.value);
                }
              }
            }
          }
        } catch (_) {}
      });

      // ── Estrategia 2: Tablas <table tr th td> ────────────────────────────
      document.querySelectorAll('table tr').forEach((row) => {
        const cells = row.querySelectorAll('th, td');
        if (cells.length >= 2) {
          const key = cells[0].innerText.trim().toLowerCase();
          const val = cells[1].innerText.trim();
          if (key && val && key.length < 80) specs[key] = val;
        }
      });

      // ── Estrategia 3: Listas de definición <dl dt dd> ────────────────────
      document.querySelectorAll('dl').forEach((dl) => {
        const dts = dl.querySelectorAll('dt');
        const dds = dl.querySelectorAll('dd');
        dts.forEach((dt, i) => {
          const key = dt.innerText.trim().toLowerCase();
          const val = dds[i] ? dds[i].innerText.trim() : '';
          if (key && val && key.length < 80) specs[key] = val;
        });
      });

      // ── Estrategia 4: <li> con separador ":" ────────────────────────────
      document.querySelectorAll('ul li, .spec-item, .product-spec, .spec-row').forEach((li) => {
        const txt = li.innerText.trim();
        const idx = txt.indexOf(':');
        if (idx > 0 && idx < 60) {
          const key = txt.substring(0, idx).trim().toLowerCase();
          const val = txt.substring(idx + 1).trim();
          if (key && val) specs[key] = val;
        }
      });

      // ── Estrategia 5: divs con clases spec/feature/detail ───────────────
      document.querySelectorAll('[class*="spec"],[class*="feature"],[class*="detail"]').forEach((el) => {
        const children = el.querySelectorAll('span, p, div');
        if (children.length >= 2) {
          const key = children[0].innerText.trim().toLowerCase();
          const val = children[1].innerText.trim();
          if (key && val && key.length < 80 && val.length < 200) specs[key] = val;
        }
      });

      // ── Extracción de imágenes ────────────────────────────────────────────
      document.querySelectorAll('img').forEach((img) => {
        const src = img.src;
        if (
          src &&
          src.includes('/assets/images/') &&
          !src.includes('logo') &&
          !src.includes('banner') &&
          !src.includes('icon') &&
          !src.includes('servientrega') &&
          !src.includes('default') &&
          !src.includes('placeholder')
        ) {
          // Normalizar thumbnail → full size
          let normalized = src
            .replace('/assets/images/sm/', '/assets/images/lg/')
            .replace('-sm.webp', '-lg.webp')
            .replace('-thumb.', '-full.');

          if (!images.includes(normalized)) images.push(normalized);
        }
      });

      return { specs, images };
    });

    const normalized = normalizeSpecs(result.specs);
    if (!normalized && result.images.length === 0) {
      return null;
    }

    const out = normalized || {};
    out.imagenes = result.images;
    return out;
  };

  return withRetry(fn, label, sku, productUrl);
}

// ============================================================
// NORMALIZACIÓN DE SPECS
// ============================================================

/**
 * Mapea claves crudas del DOM a claves estándar del sistema.
 * Usa coincidencia parcial (includes) para cubrir variaciones.
 */
function normalizeSpecs(raw) {
  if (!raw || Object.keys(raw).length === 0) return null;

  const find = (...candidates) => {
    for (const cand of candidates) {
      for (const [k, v] of Object.entries(raw)) {
        if (k.includes(cand)) return v;
      }
    }
    return null;
  };

  const n = {};

  const proc = find('procesador', 'processor', 'cpu', 'microprocesador');
  if (proc) n.procesador = proc;

  const ram = find('memoria ram', 'ram', 'memoria', 'memory');
  if (ram) n.ram = ram;

  const storage = find('almacenamiento', 'disco', 'storage', 'ssd', 'hdd', 'nvme', 'unidad');
  if (storage) n.almacenamiento = storage;

  const screen = find('pantalla', 'display', 'screen', 'diagonal', 'tamaño de pantalla');
  if (screen) n.pantalla = screen;

  const os = find('sistema operativo', 'operating system', 'os', 's.o.');
  if (os) n.sistema_operativo = os;

  const gpu = find('tarjeta gráfica', 'gpu', 'gráficos', 'graphics', 'video');
  if (gpu) n.gpu = gpu;

  const resolucion = find('resolución', 'resolucion', 'resolution');
  if (resolucion) n.resolucion = resolucion;

  const refresco = find('tasa de refresco', 'refresh', 'hz', 'refresco');
  if (refresco) n.refresco = refresco;

  const frecuencia = find('frecuencia', 'frequency', 'ghz', 'clock');
  if (frecuencia) n.frecuencia = frecuencia;

  const nucleos = find('núcleos', 'nucleos', 'cores', 'core');
  if (nucleos) n.nucleos = nucleos;

  const hilos = find('hilos', 'threads', 'thread');
  if (hilos) n.hilos = hilos;

  const vram = find('vram', 'memoria gráfica', 'memoria video');
  if (vram) n.vram = vram;

  const socket = find('socket', 'zócalo', 'zocalo');
  if (socket) n.socket = socket;

  const tdp = find('tdp', 'consumo', 'potencia', 'watt');
  if (tdp) n.tdp = tdp;

  const velocidad = find('velocidad', 'mhz', 'speed', 'frecuencia de memoria');
  if (velocidad) n.velocidad_ram = velocidad;

  const formato = find('formato', 'form factor', 'factor', 'dimm', 'sodimm');
  if (formato) n.formato = formato;

  const panel = find('panel', 'tipo de panel');
  if (panel) n.panel = panel;

  const cache = find('caché', 'cache', 'memoria caché');
  if (cache) n.cache = cache;

  const bus = find('bus', 'ancho de banda', 'bandwidth');
  if (bus) n.bus = bus;

  const color = find('color', 'colour');
  if (color) n.color = color;

  const peso = find('peso', 'weight');
  if (peso) n.peso = peso;

  const bateria = find('batería', 'battery', 'autonomia', 'autonomía');
  if (bateria) n.bateria = bateria;

  const puertos = find('puertos', 'ports', 'conectividad', 'connectivity', 'conexiones');
  if (puertos) n.puertos = puertos;

  const camara = find('cámara', 'camara', 'webcam', 'camera');
  if (camara) n.camara = camara;

  const teclado = find('teclado', 'keyboard');
  if (teclado) n.teclado = teclado;

  return Object.keys(n).length > 0 ? n : null;
}

// ============================================================
// ============================================================
// FUNCIÓN PRINCIPAL — SYNC DE UNA CATEGORÍA
// ============================================================

/**
 * Sincroniza una categoría completa del sitio con la base de datos.
 * @param {string} categoryUrl  - URL de la categoría en tecnomegastore.ec
 * @param {string} categoryName - Nombre interno (e.g. 'laptops')
 * @param {string} label        - Label para logs (e.g. 'Laptops')
 * @returns {Promise<object>}   - JSON estructurado con resultado del sync
 */
async function syncCategory(categoryUrl, categoryName, label) {
  const syncId = generateUUID();
  const startedAt = new Date().toISOString();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${label}] 🚀 Iniciando sync #${syncId}`);
  console.log(`${'='.repeat(60)}`);

  // ─── Acumuladores del resultado ────────────────────────────────────────
  const result = {
    sync_id: syncId,
    category: categoryName,
    started_at: startedAt,
    finished_at: null,
    duration_seconds: 0,
    summary: { site_total: 0, db_before: 0, inserted: 0, updated: 0, deleted: 0, errors: 0 },
    changes: { inserted: [], updated: [], deleted: [] },
    errors: [],
  };

  // ─── Categoría desconocida ─────────────────────────────────────────────
  if (!categoryUrl) {
    return { error: 'unknown_category', category: categoryName };
  }

  // ─── Lanzar browser Chromium con Stealth ──────────────────────────────
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 1000 },
  });

  const page = await context.newPage();

  try {
    // ══════════════════════════════════════════════════════════════════════
    // FASE 1 — Snapshot del sitio (paginación robusta, sin while-true)
    // ══════════════════════════════════════════════════════════════════════
    console.log(`[${label}] FASE 1 → Extrayendo catálogo del sitio...`);

    /** @type {Map<string, {nombre:string, precioTexto:string, imagenUrl:string, url:string}>} */
    const siteProducts = new Map();

    let pageNum = 1;
    let consecutiveEmpty = 0;
    const MAX_PAGES = SCRAPER_CONFIG.MAX_PAGES;

    while (pageNum <= MAX_PAGES && consecutiveEmpty < SCRAPER_CONFIG.CONSECUTIVE_EMPTY_LIMIT) {
      const url = pageNum === 1 ? categoryUrl : `${categoryUrl}?page=${pageNum}`;
      console.log(`[${label}]   Página ${pageNum}: ${url}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: SCRAPER_CONFIG.PAGE_TIMEOUT_MS });
        await page.waitForTimeout(SCRAPER_CONFIG.RENDER_WAIT_MS);

        // Scroll to bottom slowly to force lazy-loaded images to load
        await page.evaluate(async () => {
          await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 200;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              if (totalHeight >= scrollHeight || totalHeight > 10000) {
                clearInterval(timer);
                resolve();
              }
            }, 50);
          });
        });

        const products = await extractPageProducts(page);
        console.log(`[${label}]   → ${products.length} productos encontrados.`);

        if (products.length === 0) {
          consecutiveEmpty++;
        } else {
          consecutiveEmpty = 0;
          for (const p of products) {
            if (!siteProducts.has(p.sku)) {
              siteProducts.set(p.sku, {
                nombre: p.nombre,
                precioTexto: p.precioTexto,
                imagenUrl: p.imagenUrl,
                url: p.url,
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[${label}]   ⚠ Error en página ${pageNum}: ${err.message}`);
        consecutiveEmpty++;

        // Detectar rate limit
        if (err.message.includes('429')) {
          console.warn(`[${label}]   Rate limit detectado. Esperando ${SCRAPER_CONFIG.RATE_LIMIT_WAIT_MS / 1000}s...`);
          await sleep(SCRAPER_CONFIG.RATE_LIMIT_WAIT_MS);
        }
      }

      await sleep(SCRAPER_CONFIG.PAGES_DELAY_MS);
      pageNum++;
    }

    result.summary.site_total = siteProducts.size;
    console.log(`[${label}] FASE 1 completa. ${siteProducts.size} productos únicos en el sitio.`);

    // ══════════════════════════════════════════════════════════════════════
    // FASE 2 — Snapshot de la BD
    // ══════════════════════════════════════════════════════════════════════
    console.log(`[${label}] FASE 2 → Leyendo SKUs activos de la BD...`);
    const dbSKUs = await database.getActiveSKUs(categoryName);
    result.summary.db_before = dbSKUs.size;
    console.log(`[${label}] FASE 2 completa. ${dbSKUs.size} SKUs activos en BD.`);

    // ══════════════════════════════════════════════════════════════════════
    // FASE 3 — Diff
    // ══════════════════════════════════════════════════════════════════════
    console.log(`[${label}] FASE 3 → Calculando diff...`);

    const siteSKUSet = new Set(siteProducts.keys());
    const dbSKUSet = new Set(dbSKUs.keys());

    const toAdd    = [...siteSKUSet].filter((s) => !dbSKUSet.has(s));
    const toCheck  = [...siteSKUSet].filter((s) => dbSKUSet.has(s));
    const toDelete = [...dbSKUSet].filter((s) => !siteSKUSet.has(s));

    console.log(`[${label}] Diff: +${toAdd.length} nuevos | ~${toCheck.length} a verificar | -${toDelete.length} a eliminar`);

    // ══════════════════════════════════════════════════════════════════════
    // FASE 4 — Eliminaciones
    // Si ya no aparece en el listado de la categoría, lo marcamos como inactivo.
    // ══════════════════════════════════════════════════════════════════════
    if (toDelete.length > 0) {
      console.log(`[${label}] FASE 4 → Ejecutando ${toDelete.length} eliminaciones lógicas...`);

      const confirmedDeletes = toDelete;
      for (const sku of confirmedDeletes) {
        result.changes.deleted.push({ sku, reason: 'not_in_catalog' });
        console.log(`[${label}]   ✓ SKU ${sku} marcado eliminado (ya no está en catálogo).`);
      }

      await database.softDelete(confirmedDeletes);
      result.summary.deleted = confirmedDeletes.length;
      console.log(`[${label}] FASE 4 completa. ${confirmedDeletes.length} SKUs marcados inactivos.`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // FASE 5 — Actualizaciones (si cambió el precio o si necesita corregir placeholders)
    // ══════════════════════════════════════════════════════════════════════
    if (toCheck.length > 0) {
      console.log(`[${label}] FASE 5 → Verificando cambios en ${toCheck.length} productos existentes...`);

      for (const sku of toCheck) {
        const site = siteProducts.get(sku);
        const db   = dbSKUs.get(sku);
        const newPrice = cleanPrice(site.precioTexto);

        if (newPrice === 0) continue; // Nunca guardar precio 0

        const changedFields = [];
        const priceChanged = Math.abs(newPrice - db.precio_costo) > 0.001;
        if (priceChanged) changedFields.push('precio');

        // Detectar si el producto actual en la BD tiene una imagen o specs con placeholders
        const hasPlaceholderImg = !db.imagen_url || db.imagen_url.includes('default.webp') || db.imagen_url.includes('placeholder');
        const hasPlaceholderSpecs = !db.specs_json || db.specs_json.includes('default.webp') || db.specs_json === '{}';
        const needsInfoUpdate = hasPlaceholderImg || hasPlaceholderSpecs;

        if (priceChanged || needsInfoUpdate) {
          // Si la imagen en la categoría sigue siendo placeholder, intentamos usar una existente buena si la tenemos
          const finalImage = (site.imagenUrl && !site.imagenUrl.includes('default.webp'))
            ? site.imagenUrl
            : (db.imagen_url && !db.imagen_url.includes('default.webp') ? db.imagen_url : site.imagenUrl);

          await database.upsertProduct(categoryName, sku, site.nombre, newPrice, finalImage, site.url);
          if (needsInfoUpdate && !priceChanged) {
            changedFields.push('info_fix');
          }
        }

        // Level 2: specs — si el precio cambió o si necesita arreglar placeholders/datos faltantes
        if (priceChanged || needsInfoUpdate) {
          const specs = await scrapeProductSpecs(page, site.url, sku, label);
          if (specs) {
            const specsJson = JSON.stringify(specs);
            const specsHash = hashSpecs(specsJson);
            const changed = await database.upsertProductSpecs(sku, specsJson, specsHash);
            if (changed) changedFields.push('specs');
          }
          await sleep(SCRAPER_CONFIG.PRODUCTS_DELAY_MS);
        }

        if (changedFields.length > 0) {
          result.summary.updated++;
          result.changes.updated.push({ sku, changedFields });
          console.log(`[${label}]   ↑ SKU ${sku} actualizado: [${changedFields.join(', ')}]`);
        }
      }

      console.log(`[${label}] FASE 5 completa. ${result.summary.updated} productos actualizados.`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // FASE 6 — Inserciones (productos nuevos)
    // ══════════════════════════════════════════════════════════════════════
    if (toAdd.length > 0) {
      console.log(`[${label}] FASE 6 → Insertando ${toAdd.length} productos nuevos...`);

      for (const sku of toAdd) {
        const site = siteProducts.get(sku);
        const precio = cleanPrice(site.precioTexto);

        if (precio === 0) {
          console.log(`[${label}]   ⚠ SKU ${sku} ignorado: precio = 0.`);
          continue;
        }

        // Guardar datos del listado primero
        await database.upsertProduct(categoryName, sku, site.nombre, precio, site.imagenUrl, site.url);

        // Level 2: specs individuales
        const specs = await withRetry(
          () => scrapeProductSpecs(page, site.url, sku, label),
          label, sku, site.url
        );

        if (specs) {
          const specsJson = JSON.stringify(specs);
          const specsHash = hashSpecs(specsJson);
          await database.upsertProductSpecs(sku, specsJson, specsHash);

          // Si el listado nos dio un default.webp pero el detail nos dio imágenes reales, actualizamos la imagen principal
          if (site.imagenUrl.includes('default.webp') && specs.imagenes && specs.imagenes.length > 0) {
            const realImg = specs.imagenes[0];
            await database.upsertProduct(categoryName, sku, site.nombre, precio, realImg, site.url);
          }

          console.log(`    [${label}] ✓ SKU ${sku} insertado con ${Object.keys(specs).length} campos de specs.`);
        } else {
          console.log(`    [${label}] ✓ SKU ${sku} insertado (sin specs disponibles).`);
        }

        result.summary.inserted++;
        result.changes.inserted.push({ sku, nombre: site.nombre, precio });

        await sleep(SCRAPER_CONFIG.PRODUCTS_DELAY_MS);
      }

      console.log(`[${label}] FASE 6 completa. ${result.summary.inserted} productos insertados.`);
    }

  } catch (error) {
    console.error(`[${label}] ❌ Error crítico en sync:`, error.message);
    result.errors.push({ phase: 'critical', error: error.message });
    result.summary.errors++;
  } finally {
    await browser.close();
    console.log(`[${label}] Navegador cerrado.`);
  }

  // ─── Finalizar y loguear ───────────────────────────────────────────────
  result.finished_at = new Date().toISOString();
  result.duration_seconds = Math.round(
    (new Date(result.finished_at) - new Date(result.started_at)) / 1000
  );
  result.summary.errors += result.errors.length;

  await database.logSyncResult(
    syncId,
    categoryName,
    result.started_at,
    result.finished_at,
    result.summary
  );

  console.log(`\n[${label}] ✅ Sync #${syncId} completado en ${result.duration_seconds}s`);
  console.log(`[${label}] Resumen: +${result.summary.inserted} | ~${result.summary.updated} | -${result.summary.deleted} | ❌${result.summary.errors}`);

  return result;
}

// ============================================================
// FUNCIONES PÚBLICAS POR CATEGORÍA
// ============================================================

async function syncAll() {
  const ALL_CATEGORIES = [
    { url: ECOMMERCE.LAPTOPS_CATEGORY,        category: 'laptops',          label: 'Laptops' },
    { url: ECOMMERCE.DESKTOPS_CATEGORY,       category: 'desktops',         label: 'PC Desktop' },
    { url: ECOMMERCE.MINIPC_CATEGORY,         category: 'minipcs',          label: 'Mini PC' },
    { url: ECOMMERCE.MOTHERBOARD_CATEGORY,    category: 'motherboards',     label: 'Motherboard' },
    { url: ECOMMERCE.MONITOR_CATEGORY,        category: 'monitores',        label: 'Monitores' },
    { url: ECOMMERCE.GAMING_MONITOR_CATEGORY, category: 'gaming-monitores', label: 'Gaming Monitores' },
    { url: ECOMMERCE.PROCESSOR_CATEGORY,      category: 'procesadores',     label: 'Procesadores' },
    { url: ECOMMERCE.VIDEOCARD_CATEGORY,      category: 'tarjetas-video',   label: 'Tarjetas de Video' },
    { url: ECOMMERCE.POWERSUPPLY_CATEGORY,    category: 'fuentes',          label: 'Fuentes de Poder' },
    { url: ECOMMERCE.COOLER_CATEGORY,         category: 'coolers',          label: 'Coolers' },
    { url: ECOMMERCE.STORAGE_CATEGORY,        category: 'almacenamiento',   label: 'Almacenamiento' },
    { url: ECOMMERCE.RAM_CATEGORY,            category: 'ram',              label: 'Memorias RAM' },
    { url: ECOMMERCE.CASE_CATEGORY,           category: 'cases',            label: 'Cases' },
    { url: ECOMMERCE.FAN_CATEGORY,            category: 'ventiladores',     label: 'Ventiladores' },
  ];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌐 [syncAll] Iniciando sync completo — ${ALL_CATEGORIES.length} categorías`);
  console.log(`${'='.repeat(60)}`);

  const globalStart = Date.now();
  const results = [];
  let totalInserted = 0, totalUpdated = 0, totalDeleted = 0, totalErrors = 0;

  for (let i = 0; i < ALL_CATEGORIES.length; i++) {
    const { url, category, label } = ALL_CATEGORIES[i];
    console.log(`\n[syncAll] (${i + 1}/${ALL_CATEGORIES.length}) → ${label}`);

    try {
      const r = await syncCategory(url, category, label);
      results.push(r);
      totalInserted += r.summary?.inserted ?? 0;
      totalUpdated  += r.summary?.updated  ?? 0;
      totalDeleted  += r.summary?.deleted  ?? 0;
      totalErrors   += r.summary?.errors   ?? 0;
    } catch (err) {
      console.error(`[syncAll] ❌ Error en ${label}: ${err.message}`);
      results.push({ category, error: err.message });
      totalErrors++;
    }

    // Pausa entre categorías (excepto tras la última)
    if (i < ALL_CATEGORIES.length - 1) {
      await sleep(SCRAPER_CONFIG.CATEGORY_PAUSE_MS);
    }
  }

  const elapsed = Math.round((Date.now() - globalStart) / 1000);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ [syncAll] Ciclo completo en ${elapsed}s`);
  console.log(`   Insertados: ${totalInserted} | Actualizados: ${totalUpdated} | Eliminados: ${totalDeleted} | Errores: ${totalErrors}`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    duration_seconds: elapsed,
    categories_synced: ALL_CATEGORIES.length,
    summary: { inserted: totalInserted, updated: totalUpdated, deleted: totalDeleted, errors: totalErrors },
    results,
  };
}

async function syncLaptops()         { return syncCategory(ECOMMERCE.LAPTOPS_CATEGORY,        'laptops',          'Laptops'); }
async function syncDesktops()        { return syncCategory(ECOMMERCE.DESKTOPS_CATEGORY,       'desktops',         'PC Desktop'); }
async function syncMinipcs()         { return syncCategory(ECOMMERCE.MINIPC_CATEGORY,         'minipcs',          'Mini PC'); }
async function syncMotherboards()    { return syncCategory(ECOMMERCE.MOTHERBOARD_CATEGORY,    'motherboards',     'Motherboard'); }
async function syncMonitors()        { return syncCategory(ECOMMERCE.MONITOR_CATEGORY,        'monitores',        'Monitor'); }
async function syncGamingMonitors()  { return syncCategory(ECOMMERCE.GAMING_MONITOR_CATEGORY, 'gaming-monitores', 'Gaming Monitor'); }

/**
 * Sincroniza todas las categorías de componentes secuencialmente.
 * Pausa CATEGORY_PAUSE_MS entre cada una para no saturar el servidor destino.
 */
async function syncAllComponents() {
  const components = [
    { url: ECOMMERCE.PROCESSOR_CATEGORY,   category: 'procesadores',   label: 'Procesadores' },
    { url: ECOMMERCE.VIDEOCARD_CATEGORY,   category: 'tarjetas-video', label: 'Tarjetas de Video' },
    { url: ECOMMERCE.POWERSUPPLY_CATEGORY, category: 'fuentes',        label: 'Fuentes de Poder' },
    { url: ECOMMERCE.COOLER_CATEGORY,      category: 'coolers',        label: 'Coolers' },
    { url: ECOMMERCE.STORAGE_CATEGORY,     category: 'almacenamiento', label: 'Almacenamiento' },
    { url: ECOMMERCE.RAM_CATEGORY,         category: 'ram',            label: 'Memorias RAM' },
    { url: ECOMMERCE.CASE_CATEGORY,        category: 'cases',          label: 'Cases' },
    { url: ECOMMERCE.FAN_CATEGORY,         category: 'ventiladores',   label: 'Ventiladores' },
  ];

  const results = [];
  for (const comp of components) {
    try {
      const r = await syncCategory(comp.url, comp.category, comp.label);
      results.push(r);
    } catch (e) {
      console.error(`[Scraper Global] Error en ${comp.label}:`, e.message);
      results.push({ category: comp.category, error: e.message });
    }
    await sleep(SCRAPER_CONFIG.CATEGORY_PAUSE_MS);
  }
  return results;
}

/**
 * Sincroniza una categoría por nombre interno (usado por la API).
 * @param {string} name - Nombre de la categoría (e.g. 'laptops')
 */
async function syncByName(name) {
  const { CATEGORY_MAP } = require('./config');
  const entry = CATEGORY_MAP[name];
  if (!entry) return { error: 'unknown_category', category: name };
  return syncCategory(entry.url, name, entry.label);
}

// ─── Alias de retrocompatibilidad (mantiene contrato con server.js anterior) ──
const scrapeLaptops         = syncLaptops;
const scrapeDesktops        = syncDesktops;
const scrapeMinipcs         = syncMinipcs;
const scrapeMotherboards    = syncMotherboards;
const scrapeMonitors        = syncMonitors;
const scrapeGamingMonitors  = syncGamingMonitors;
const scrapeAllComponents   = syncAllComponents;

module.exports = {
  // v2 API
  syncCategory,
  syncAll,
  syncLaptops,
  syncDesktops,
  syncMinipcs,
  syncMotherboards,
  syncMonitors,
  syncGamingMonitors,
  syncAllComponents,
  syncByName,
  // Alias retrocompatibles
  scrapeLaptops,
  scrapeDesktops,
  scrapeMinipcs,
  scrapeMotherboards,
  scrapeMonitors,
  scrapeGamingMonitors,
  scrapeAllComponents,
};
