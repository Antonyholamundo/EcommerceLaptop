const fs = require('fs');
const path = require('path');
const { db, initDatabase, upsertProduct } = require('../src/database');

const MAPPINGS = {
  'productos.json': 'laptops',
  'computadoras.json': 'desktops',
  'minipcs.json': 'minipcs',
  'motherboards.json': 'motherboards',
  'processors.json': 'procesadores',
  'videocards.json': 'tarjetas-video',
  'powersupplies.json': 'fuentes',
  'coolers.json': 'coolers',
  'storage.json': 'almacenamiento',
  'ram.json': 'ram',
  'cases.json': 'cases',
  'fans.json': 'ventiladores'
};

async function runMigration() {
  console.log('Iniciando migración de JSON a SQLite...');
  await initDatabase();

  let totalMigrated = 0;

  for (const [filename, category] of Object.entries(MAPPINGS)) {
    const jsonPath = path.join(__dirname, '..', filename);
    
    if (fs.existsSync(jsonPath)) {
      console.log(`Leyendo archivo: ${filename} (Categoría: ${category})`);
      try {
        const content = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(content);
        
        let count = 0;
        for (const item of data) {
          // El upsert actualiza en caso de conflicto por SKU
          await upsertProduct(category, item.sku, item.nombre, item.precio, item.imagen_url);
          count++;
        }
        
        console.log(`✅ Migrados ${count} productos de ${filename}.`);
        totalMigrated += count;
      } catch (err) {
        console.error(`❌ Error al procesar ${filename}:`, err.message);
      }
    } else {
      console.log(`⚠️ Archivo no encontrado: ${filename}, saltando...`);
    }
  }

  console.log(`🎉 Migración completada. Total de productos insertados/actualizados: ${totalMigrated}`);
  
  // Close the DB process
  db.close((err) => {
    if (err) {
      console.error('Error cerrando la DB:', err.message);
    } else {
      console.log('Base de datos cerrada correctamente.');
    }
  });
}

runMigration();
