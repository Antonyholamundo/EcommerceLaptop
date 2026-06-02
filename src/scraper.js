const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const database = require('./database');
const { ECOMMERCE } = require('./config');

chromium.use(stealth);

function cleanPrice(priceText) {
  if (!priceText) return 0;

  let clean = priceText.replace(/[^0-9.,]/g, '').trim();

  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');

  if (lastComma > lastDot) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    clean = clean.replace(/,/g, '');
  } else {
    clean = clean.replace(',', '.');
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

async function scrapeCategory(categoryUrl, categoryName, label) {
  console.log(`[${label}] Iniciando navegador Chromium en modo Stealth...`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 1000 }
  });

  const page = await context.newPage();

  let allProducts = [];
  let pageNum = 1;

  try {
    while (true) {
      const url = pageNum === 1 ? categoryUrl : `${categoryUrl}?page=${pageNum}`;
      console.log(`[${label}] Navegando a la URL: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      console.log(`[${label}] Esperando estabilización de renderizado dinámico...`);
      await page.waitForTimeout(5000);

      console.log(`[${label}] Extrayendo información de los productos...`);
      const productsData = await page.evaluate(() => {
        const productLinks = Array.from(document.querySelectorAll('a'))
          .filter(a => a.href && a.href.includes('/product/') && a.href.includes('code='));

        const results = [];

        productLinks.forEach(link => {
          const urlStr = link.href;
          let sku = '';
          try {
            const urlObj = new URL(urlStr);
            sku = urlObj.searchParams.get('code') || '';
          } catch (e) {
            const match = urlStr.match(/[?&]code=([^&]+)/);
            if (match) sku = match[1];
          }

          const nombre = link.innerText.trim();

          const card = link.closest('.bg-white') || link.parentElement?.parentElement;

          let precioTexto = '';
          let imagenUrl = '';
          if (card) {
            const imgEl = card.querySelector('img');
            imagenUrl = imgEl ? imgEl.src : '';

            const allElements = Array.from(card.querySelectorAll('*'));
            const priceElement = allElements.find(el => {
              const txt = el.textContent.trim();
              return txt.startsWith('$') && /\d/.test(txt);
            });

            if (priceElement) {
              precioTexto = priceElement.textContent.trim();
            } else {
              const matchPrice = card.innerText.match(/\$\s*([0-9.,]+)/);
              if (matchPrice) {
                precioTexto = matchPrice[0];
              }
            }
          }

          if (sku && nombre && precioTexto) {
            results.push({ sku, nombre, precioTexto, imagenUrl });
          }
        });

        return results;
      });

      console.log(`[${label}] Se encontraron ${productsData.length} productos en página ${pageNum}.`);

      if (productsData.length === 0) {
        console.log(`[${label}] No se encontraron más productos. Finalizando paginación.`);
        break;
      }

      allProducts = allProducts.concat(productsData);
      pageNum++;
    }

    console.log(`[${label}] Total de productos recolectados: ${allProducts.length}. Guardando en Base de Datos SQLite...`);

    let savedCount = 0;
    for (const item of allProducts) {
      const precioCosto = cleanPrice(item.precioTexto);

      if (precioCosto > 0) {
        await database.upsertProduct(categoryName, item.sku, item.nombre, precioCosto, item.imagenUrl);
        savedCount++;
      }
    }

    console.log(`[${label}] Scraping finalizado. ${savedCount} productos guardados en SQLite en la categoría ${categoryName}.`);
    return savedCount;

  } catch (error) {
    console.error(`[${label}] Error durante el proceso de scraping:`, error);
    throw error;
  } finally {
    await browser.close();
    console.log(`[${label}] Navegador cerrado.`);
  }
}

async function scrapeLaptops() {
  return scrapeCategory(ECOMMERCE.LAPTOPS_CATEGORY, 'laptops', 'Laptops');
}

async function scrapeDesktops() {
  return scrapeCategory(ECOMMERCE.DESKTOPS_CATEGORY, 'desktops', 'PC Desktop');
}

async function scrapeMinipcs() {
  return scrapeCategory(ECOMMERCE.MINIPC_CATEGORY, 'minipcs', 'Mini PC');
}

async function scrapeMotherboards() {
  return scrapeCategory(ECOMMERCE.MOTHERBOARD_CATEGORY, 'motherboards', 'Motherboard');
}

async function scrapeMonitors() {
  return scrapeCategory(ECOMMERCE.MONITOR_CATEGORY, 'monitores', 'Monitor');
}

async function scrapeGamingMonitors() {
  return scrapeCategory(ECOMMERCE.GAMING_MONITOR_CATEGORY, 'gaming-monitores', 'Gaming Monitor');
}

const componentConfigs = [
  { url: ECOMMERCE.PROCESSOR_CATEGORY, category: 'procesadores', label: 'Procesadores' },
  { url: ECOMMERCE.VIDEOCARD_CATEGORY, category: 'tarjetas-video', label: 'Tarjetas de Video' },
  { url: ECOMMERCE.POWERSUPPLY_CATEGORY, category: 'fuentes', label: 'Fuentes de Poder' },
  { url: ECOMMERCE.COOLER_CATEGORY, category: 'coolers', label: 'Coolers' },
  { url: ECOMMERCE.STORAGE_CATEGORY, category: 'almacenamiento', label: 'Almacenamiento' },
  { url: ECOMMERCE.RAM_CATEGORY, category: 'ram', label: 'Memorias RAM' },
  { url: ECOMMERCE.CASE_CATEGORY, category: 'cases', label: 'Cases' },
  { url: ECOMMERCE.FAN_CATEGORY, category: 'ventiladores', label: 'Ventiladores' }
];

async function scrapeAllComponents() {
  let totalSaved = 0;
  for (const comp of componentConfigs) {
    try {
      const saved = await scrapeCategory(comp.url, comp.category, comp.label);
      totalSaved += saved;
      // Pausa entre componentes para no saturar
      await new Promise(res => setTimeout(res, 5000));
    } catch (e) {
      console.error(`[Scraper Global] Error extrayendo ${comp.label}:`, e.message);
    }
  }
  return totalSaved;
}

module.exports = {
  scrapeLaptops,
  scrapeDesktops,
  scrapeMinipcs,
  scrapeMotherboards,
  scrapeMonitors,
  scrapeGamingMonitors,
  scrapeAllComponents
};
