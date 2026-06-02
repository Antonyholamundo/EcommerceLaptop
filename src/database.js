const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'productos.db');

// Promisified DB wrapper
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos SQLite', err.message);
  }
});

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

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS productos (
      sku TEXT PRIMARY KEY,
      nombre TEXT,
      precio REAL,
      imagen_url TEXT,
      categoria TEXT,
      ultima_actualizacion TEXT
    )
  `);
  // Crear índice por categoría para optimizar consultas
  await run(`CREATE INDEX IF NOT EXISTS idx_categoria ON productos(categoria)`);
}

async function upsertProduct(categoria, sku, nombre, precio, imagenUrl) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ultimaActualizacion = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  const sql = `
    INSERT INTO productos (sku, nombre, precio, imagen_url, categoria, ultima_actualizacion)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(sku) DO UPDATE SET
      nombre=excluded.nombre,
      precio=excluded.precio,
      imagen_url=excluded.imagen_url,
      categoria=excluded.categoria,
      ultima_actualizacion=excluded.ultima_actualizacion
  `;
  
  return await run(sql, [sku, nombre, precio, imagenUrl, categoria, ultimaActualizacion]);
}

async function getAllProducts(categoria) {
  let sql = `SELECT * FROM productos`;
  let params = [];
  
  if (categoria && categoria !== 'all') {
    sql += ` WHERE categoria = ?`;
    params.push(categoria);
  }
  
  sql += ` ORDER BY ultima_actualizacion DESC`;
  return await all(sql, params);
}

module.exports = {
  db,
  initDatabase,
  upsertProduct,
  getAllProducts,
  run,
  get,
  all
};
