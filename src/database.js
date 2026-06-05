/**
 * database.js — ScraperAgent v2
 * Capa de acceso a datos con soporte completo de sincronización incremental.
 *
 * Tablas:
 *   products       — catálogo activo con soft-delete (is_active)
 *   product_specs  — specs JSON + hash para detección de cambios
 *   scrape_errors  — errores por producto con reintentos
 *   sync_log       — historial completo de cada sync ejecutado
 *
 * Migración automática desde tabla legacy `productos` en el primer boot.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'productos.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`Error al abrir la base de datos SQLite en: ${dbPath}`, err.message);
  } else {
    console.log(`Base de datos SQLite conectada en: ${dbPath}`);
  }
});

// ============================================================
// HELPERS PROMISIFICADOS
// ============================================================

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('Error executing query:', sql, err.message);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) {
        console.error('Error in GET query:', sql, err.message);
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error in ALL query:', sql, err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// ============================================================
// INICIALIZACIÓN Y MIGRACIÓN
// ============================================================

async function initDatabase() {
  // ── Modo WAL: permite lecturas concurrentes mientras el Cron Job escribe ──
  // Imprescindible cuando Express (Web Service) y run-scraper.js (Cron Job)
  // apuntan al mismo archivo productos.db en Railway.
  await run(`PRAGMA journal_mode = WAL`);

  // ── Tabla principal de productos (ScraperAgent v2) ──────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS products (
      sku              TEXT PRIMARY KEY,
      category         TEXT NOT NULL,
      nombre           TEXT,
      precio_costo     REAL,
      imagen_url       TEXT,
      product_url      TEXT,
      is_active        INTEGER DEFAULT 1,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now')),
      deleted_at       TEXT
    )
  `);

  // ── Specs separadas con hash para detección incremental ──────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS product_specs (
      sku        TEXT PRIMARY KEY REFERENCES products(sku),
      specs_json TEXT,
      specs_hash TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── Errores de scraping por producto ────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS scrape_errors (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      sku       TEXT,
      url       TEXT,
      error     TEXT,
      retries   INTEGER,
      timestamp TEXT
    )
  `);

  // ── Log de sincronizaciones completas ───────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS sync_log (
      sync_id      TEXT PRIMARY KEY,
      category     TEXT,
      started_at   TEXT,
      finished_at  TEXT,
      summary_json TEXT
    )
  `);

  // ── Índices de rendimiento ───────────────────────────────────────────────
  await run(`CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, is_active)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_scrape_errors_timestamp ON scrape_errors(timestamp)`);
  // Índice compuesto que cubre el patrón exacto de getPaginatedProducts:
  // WHERE category = ? AND is_active = 1 AND precio_costo BETWEEN ? AND ?
  // ORDER BY precio_costo / updated_at
  // Sin este índice, cualquier filtro de precio fuerza un full-scan de la tabla.
  await run(`CREATE INDEX IF NOT EXISTS idx_products_cat_active_precio ON products(category, is_active, precio_costo)`);

  // ── Tabla legacy (compatibilidad hacia atrás) ────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS productos (
      sku                 TEXT PRIMARY KEY,
      nombre              TEXT,
      precio              REAL,
      imagen_url          TEXT,
      categoria           TEXT,
      ultima_actualizacion TEXT,
      url                 TEXT,
      specs_json          TEXT
    )
  `);
  try { await run(`ALTER TABLE productos ADD COLUMN url TEXT`); } catch (_) {}
  try { await run(`ALTER TABLE productos ADD COLUMN specs_json TEXT`); } catch (_) {}
  await run(`CREATE INDEX IF NOT EXISTS idx_categoria ON productos(categoria)`);

  // ── Migración automática desde tabla legacy ──────────────────────────────
  await migrateFromLegacy();
}

/**
 * Copia datos existentes de `productos` → `products` + `product_specs`.
 * Idempotente: usa INSERT OR IGNORE para no duplicar en re-boots.
 */
async function migrateFromLegacy() {
  const legacyRows = await all(`SELECT * FROM productos`);
  if (legacyRows.length === 0) return;

  const existing = await all(`SELECT sku FROM products`);
  const existingSkus = new Set(existing.map(r => r.sku));

  let migrated = 0;
  for (const row of legacyRows) {
    if (existingSkus.has(row.sku)) continue;

    await run(
      `INSERT OR IGNORE INTO products
         (sku, category, nombre, precio_costo, imagen_url, product_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        row.sku,
        row.categoria || 'laptops',
        row.nombre,
        row.precio,
        row.imagen_url,
        row.url,
        row.ultima_actualizacion || new Date().toISOString(),
        row.ultima_actualizacion || new Date().toISOString(),
      ]
    );

    if (row.specs_json) {
      await run(
        `INSERT OR IGNORE INTO product_specs (sku, specs_json, specs_hash, updated_at)
         VALUES (?, ?, ?, ?)`,
        [row.sku, row.specs_json, '', row.ultima_actualizacion || new Date().toISOString()]
      );
    }

    migrated++;
  }

  if (migrated > 0) {
    console.log(`✅ [Migración] ${migrated} productos migrados de tabla legacy → products/product_specs.`);
  }
}

// ============================================================
// LECTURA — SNAPSHOT DE BD
// ============================================================

/**
 * Devuelve un Map de SKU → { precio_costo } para los productos activos de una categoría.
 * Usado en FASE 2 del diff para comparar contra el sitio.
 */
async function getActiveSKUs(category) {
  const rows = await all(
    `SELECT p.sku, p.precio_costo, p.imagen_url, ps.specs_json
     FROM products p
     LEFT JOIN product_specs ps ON p.sku = ps.sku
     WHERE p.category = ? AND p.is_active = 1`,
    [category]
  );
  const map = new Map();
  for (const r of rows) {
    map.set(r.sku, {
      precio_costo: r.precio_costo,
      imagen_url: r.imagen_url,
      specs_json: r.specs_json
    });
  }
  return map;
}

/**
 * Devuelve todos los productos activos de una categoría para las rutas de la API.
 * Compatible con el contrato anterior de getAllProducts().
 */
async function getAllProducts(category) {
  let sql = `
    SELECT
      p.sku,
      p.nombre,
      p.precio_costo  AS precio,
      p.imagen_url,
      p.category      AS categoria,
      p.updated_at    AS ultima_actualizacion,
      p.product_url   AS url,
      ps.specs_json
    FROM products p
    LEFT JOIN product_specs ps ON p.sku = ps.sku
  `;
  const params = [];

  if (category && category !== 'all') {
    sql += ` WHERE p.category = ? AND p.is_active = 1`;
    params.push(category);
  } else {
    sql += ` WHERE p.is_active = 1`;
  }

  sql += ` ORDER BY p.updated_at DESC`;
  return await all(sql, params);
}

/**
 * Filtra, ordena y pagina productos directamente en SQLite.
 *
 * Estrategia de filtros:
 *   - search   → LIKE sobre nombre y sku (ambas columnas indexadas).
 *   - brands   → El campo "marca" no existe como columna; vive dentro del
 *                nombre del producto igual que parseBrand() en JS. Se traduce
 *                a un bloque OR de condiciones LOWER(nombre) LIKE '%keyword%'
 *                usando las mismas palabras clave que BRAND_KEYWORDS.
 *   - precio   → BETWEEN directo sobre precio_costo.
 *   - sort     → ORDER BY traducido a columnas reales.
 *   - page/limit → LIMIT + OFFSET calculados aquí.
 *
 * Devuelve { rows, total } para que el servicio solo aplique enrichProduct().
 *
 * @param {object}   opts
 * @param {string}   [opts.category='laptops']  Categoría a consultar
 * @param {string}   [opts.search='']           Texto libre (nombre / sku)
 * @param {string[]} [opts.brands=[]]           Marcas exactas (ej. ['Lenovo','HP'])
 * @param {string[]} [opts.brandKeywords=[]]    Palabras clave de cada marca (pasadas
 *                                              por el servicio desde BRAND_KEYWORDS)
 * @param {number}   [opts.minPrice=0]          Precio mínimo
 * @param {number}   [opts.maxPrice=1e9]        Precio máximo
 * @param {string}   [opts.sort='relevancia']   Orden: precio-asc|precio-desc|recientes|relevancia
 * @param {number}   [opts.page=1]              Página actual (1-indexed)
 * @param {number}   [opts.limit=12]            Registros por página
 * @returns {Promise<{ rows: object[], total: number }>}
 */
async function getPaginatedProducts(opts = {}) {
  const {
    category     = 'laptops',
    search       = '',
    brands       = [],
    brandKeywords = {},   // Map<brand, keyword[]> enviado por el servicio
    minPrice     = 0,
    maxPrice     = 1e9,
    sort         = 'relevancia',
    page         = 1,
    limit        = 12,
  } = opts;

  // ── Cláusula base ────────────────────────────────────────────────────────
  const conditions = [];
  const params     = [];

  // Siempre filtramos por categoría activa
  if (category && category !== 'all') {
    conditions.push('p.category = ?');
    params.push(category);
  }
  conditions.push('p.is_active = 1');

  // ── Filtro de búsqueda libre: nombre o SKU ────────────────────────────────
  // Usamos un OR entre las dos columnas con un único parámetro reutilizado.
  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    conditions.push('(LOWER(p.nombre) LIKE ? OR LOWER(p.sku) LIKE ?)');
    params.push(term, term);  // dos placeholders, mismo valor
  }

  // ── Filtro de marcas ──────────────────────────────────────────────────────
  // parseBrand() extrae la marca del nombre usando BRAND_KEYWORDS. No existe
  // una columna de marca en la BD. Traducimos cada marca seleccionada a su(s)
  // keyword(s) y construimos: (LOWER(nombre) LIKE '%lenovo%' OR LOWER(nombre) LIKE '%hp%' ...)
  // Los brandKeywords son pasados por el servicio para no importar config aquí.
  if (brands.length > 0 && Object.keys(brandKeywords).length > 0) {
    const brandConditions = [];
    for (const brand of brands) {
      const keywords = brandKeywords[brand.toLowerCase()] || [brand.toLowerCase()];
      for (const kw of keywords) {
        brandConditions.push('LOWER(p.nombre) LIKE ?');
        params.push(`%${kw.toLowerCase()}%`);
      }
    }
    if (brandConditions.length > 0) {
      conditions.push(`(${brandConditions.join(' OR ')})`);
    }
  }

  // ── Filtro de precio ──────────────────────────────────────────────────────
  // Solo añadimos los extremos que realmente acotan (evita un BETWEEN 0 AND 1e9 innecesario)
  if (minPrice > 0) {
    conditions.push('p.precio_costo >= ?');
    params.push(minPrice);
  }
  if (maxPrice < 1e9) {
    conditions.push('p.precio_costo <= ?');
    params.push(maxPrice);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // ── Ordenamiento ─────────────────────────────────────────────────────────
  // Mapeamos el parámetro `sort` a columnas reales. Si el sort es inválido
  // caemos en relevancia (updated_at DESC, sku ASC) como orden estable.
  const ORDER_MAP = {
    'precio-asc':  'p.precio_costo ASC,  p.sku ASC',
    'precio-desc': 'p.precio_costo DESC, p.sku ASC',
    'recientes':   'p.updated_at DESC,   p.sku ASC',
    'relevancia':  'p.updated_at DESC,   p.sku ASC',  // más reciente primero
  };
  const orderBy = ORDER_MAP[sort] || ORDER_MAP['relevancia'];

  // ── Paginación segura ─────────────────────────────────────────────────────
  const safePage  = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const offset    = (safePage - 1) * safeLimit;

  // ── SELECT de campos (JOIN con specs para enrichProduct) ─────────────────
  const selectCols = `
    p.sku,
    p.nombre,
    p.precio_costo  AS precio,
    p.imagen_url,
    p.category      AS categoria,
    p.updated_at    AS ultima_actualizacion,
    p.product_url   AS url,
    ps.specs_json
  `;

  const baseQuery = `
    FROM products p
    LEFT JOIN product_specs ps ON p.sku = ps.sku
    ${whereClause}
  `;

  // ── Ejecutar COUNT y SELECT en paralelo (misma WHERE, distinto SELECT) ──
  // El COUNT usa los mismos `params`; el SELECT añade limit/offset al final.
  const [countRow, rows] = await Promise.all([
    get(`SELECT COUNT(*) AS total ${baseQuery}`, params),
    all(
      `SELECT ${selectCols} ${baseQuery} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    ),
  ]);

  return {
    rows,
    total:      countRow?.total ?? 0,
    page:       safePage,
    totalPages: Math.ceil((countRow?.total ?? 0) / safeLimit),
    limit:      safeLimit,
  };
}

// ============================================================
// ESCRITURA — UPSERTS
// ============================================================

/**
 * Inserta o actualiza un producto en la tabla products.
 * Preserva created_at en actualizaciones. No toca specs.
 */
async function upsertProduct(category, sku, nombre, precioCosto, imagenUrl, productUrl) {
  const now = new Date().toISOString();
  await run(
    `INSERT INTO products (sku, category, nombre, precio_costo, imagen_url, product_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(sku) DO UPDATE SET
       nombre       = excluded.nombre,
       precio_costo = excluded.precio_costo,
       imagen_url   = excluded.imagen_url,
       product_url  = excluded.product_url,
       category     = excluded.category,
       is_active    = 1,
       deleted_at   = NULL,
       updated_at   = excluded.updated_at`,
    [sku, category, nombre, precioCosto, imagenUrl, productUrl, now, now]
  );

  // Espejo en tabla legacy para retrocompatibilidad
  await run(
    `INSERT INTO productos (sku, nombre, precio, imagen_url, categoria, ultima_actualizacion, url)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sku) DO UPDATE SET
       nombre=excluded.nombre,
       precio=excluded.precio,
       imagen_url=excluded.imagen_url,
       categoria=excluded.categoria,
       ultima_actualizacion=excluded.ultima_actualizacion,
       url=excluded.url`,
    [sku, nombre, precioCosto, imagenUrl, category, now, productUrl]
  );
}

/**
 * Inserta o actualiza specs, pero SOLO si el hash cambió.
 * Devuelve true si hubo cambio real, false si era idéntico.
 */
async function upsertProductSpecs(sku, specsJson, specsHash) {
  const existing = await get(`SELECT specs_hash FROM product_specs WHERE sku = ?`, [sku]);

  if (existing && existing.specs_hash === specsHash) {
    return false; // Sin cambios
  }

  const now = new Date().toISOString();
  await run(
    `INSERT INTO product_specs (sku, specs_json, specs_hash, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(sku) DO UPDATE SET
       specs_json = excluded.specs_json,
       specs_hash = excluded.specs_hash,
       updated_at = excluded.updated_at`,
    [sku, specsJson, specsHash, now]
  );

  // Espejo en tabla legacy
  await run(
    `UPDATE productos SET specs_json = ? WHERE sku = ?`,
    [specsJson, sku]
  );

  return true; // Hubo cambio
}

// ============================================================
// ELIMINACIÓN — SOFT DELETE
// ============================================================

/**
 * Marca productos como inactivos en lugar de eliminarlos físicamente.
 * @param {string[]} skus - Lista de SKUs a desactivar
 */
async function softDelete(skus) {
  if (!skus || skus.length === 0) return;
  const now = new Date().toISOString();
  for (const sku of skus) {
    await run(
      `UPDATE products SET is_active = 0, deleted_at = ? WHERE sku = ?`,
      [now, sku]
    );
  }
}

// ============================================================
// LOGGING
// ============================================================

/**
 * Guarda el resumen completo de un ciclo de sync en sync_log.
 */
async function logSyncResult(syncId, category, startedAt, finishedAt, summary) {
  await run(
    `INSERT OR REPLACE INTO sync_log (sync_id, category, started_at, finished_at, summary_json)
     VALUES (?, ?, ?, ?, ?)`,
    [syncId, category, startedAt, finishedAt, JSON.stringify(summary)]
  );
}

/**
 * Registra un error de scraping para un producto específico.
 */
async function logScrapeError(sku, url, errorMsg, retries) {
  const timestamp = new Date().toISOString();
  await run(
    `INSERT INTO scrape_errors (sku, url, error, retries, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [sku, url, errorMsg, retries, timestamp]
  );
}

/**
 * Retorna los últimos N registros de sync_log para el panel de admin.
 */
async function getRecentSyncs(limit = 20) {
  return await all(
    `SELECT sync_id, category, started_at, finished_at, summary_json
     FROM sync_log
     ORDER BY started_at DESC
     LIMIT ?`,
    [limit]
  );
}

/**
 * Retorna los últimos N errores de scraping para el panel de admin.
 */
async function getRecentErrors(limit = 50) {
  return await all(
    `SELECT * FROM scrape_errors ORDER BY timestamp DESC LIMIT ?`,
    [limit]
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase,
  // Lectura
  getActiveSKUs,
  getAllProducts,
  getPaginatedProducts,
  // Escritura
  upsertProduct,
  upsertProductSpecs,
  // Eliminación
  softDelete,
  // Logging
  logSyncResult,
  logScrapeError,
  getRecentSyncs,
  getRecentErrors,
};
