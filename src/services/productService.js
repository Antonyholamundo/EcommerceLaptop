const { BRAND_KEYWORDS, PROCESSOR_PATTERNS, COLOR_KEYWORDS, SERVER_CONFIG } = require('../config');
const { calculatePricing } = require('./priceService');
const { getAllProducts, getPaginatedProducts } = require('../database');

// Mapa de brand → [keywords] generado una vez al arrancar desde BRAND_KEYWORDS.
// Cada entrada de BRAND_KEYWORDS es la forma canónica de la marca (ej. 'Lenovo').
// Lo usamos en getPaginatedProducts para construir las condiciones LIKE de SQL.
// Ejemplo resultado: { 'lenovo': ['lenovo'], 'hp': ['hp'], ... }
const BRAND_KEYWORDS_MAP = {};
for (const brand of BRAND_KEYWORDS) {
  BRAND_KEYWORDS_MAP[brand.toLowerCase()] = [brand.toLowerCase()];
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES DE MARCA
// ─────────────────────────────────────────────────────────────────────────────

function parseBrand(nombre) {
  const nameLower = (nombre || '').toLowerCase();
  for (const brand of BRAND_KEYWORDS) {
    if (nameLower.includes(brand.toLowerCase())) return brand;
  }
  return 'Otros';
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTOR UNIVERSAL DINÁMICO
// Corre contra CUALQUIER nombre de producto sin importar la categoría.
// Detecta automáticamente todas las specs y devuelve un mapa plano.
// Para agregar soporte de una nueva spec: añade unas líneas aquí.
// ─────────────────────────────────────────────────────────────────────────────

function universalExtract(lower) {
  // ── Valores GB / TB: desambiguar RAM vs Almacenamiento ──────────────────
  const gbMatches = [...lower.matchAll(/(\d+)\s*(gb|tb)\b/ig)];
  const gbValues  = gbMatches
    .map(m => ({
      raw: m[0].toUpperCase(),
      val: parseInt(m[1]) * (m[2].toLowerCase() === 'tb' ? 1024 : 1),
    }))
    .sort((a, b) => a.val - b.val);

  // RAM: el valor más pequeño ≤ 128 GB
  const ramEntry     = gbValues.find(g => g.val <= 128);
  const ram          = ramEntry ? ramEntry.raw : 'N/D';

  // Almacenamiento: el valor más grande (si hay más de uno), o el único si > 128 GB
  const storageEntry = gbValues.length > 1
    ? gbValues[gbValues.length - 1]
    : (gbValues[0]?.val > 128 ? gbValues[0] : null);
  const hasSSD       = lower.includes('ssd') || lower.includes('nvme') || lower.includes('m.2');
  const hasHDD       = lower.includes('hdd') || lower.includes('disco duro');
  const storageFull  = storageEntry
    ? storageEntry.raw + (hasSSD ? ' SSD' : hasHDD ? ' HDD' : '')
    : 'N/D';

  // ── Procesador ─────────────────────────────────────────────────────────
  let processor = 'N/D';
  for (const p of PROCESSOR_PATTERNS) {
    if (p.keywords.some(kw => lower.includes(kw))) { processor = p.label; break; }
  }
  // Modelo exacto: ej. "Ultra7-266V", "i5-12500H", "7530U"
  const procModelM     = lower.match(/(?:ultra\s*\d|i\d|ryzen\s*\d|ryzen\d)\s*[-–]?\s*(\d{3,5}[a-z0-9]*)/i);
  const processorModel = procModelM ? procModelM[0].replace(/\s+/g, ' ').toUpperCase() : 'N/D';

  // ── Pantalla (diagonal) ───────────────────────────────────────────────
  // Soporta: 14" · 14inch · 14Inc · 14in · 14.1pulgadas · 14.6"
  const screenM = lower.match(/(\d+(?:\.\d+)?)\s*(?:inch|inc\b|"|"|pulgadas?|pulg\b|\bin\b)/);
  const screen  = screenM ? screenM[1] + '"' : 'N/D';

  // ── Resolución ────────────────────────────────────────────────────────
  let resolution = 'N/D';
  if      (lower.includes('4k') || lower.includes('uhd') || lower.includes('3840x2160'))   resolution = '4K UHD (3840×2160)';
  else if (lower.includes('2k') || lower.includes('qhd') || lower.includes('wqhd'))        resolution = '2K QHD (2560×1440)';
  else if (lower.includes('fhd+') || lower.includes('1920x1200'))                          resolution = 'FHD+ (1920×1200)';
  else if (lower.includes('fhd') || lower.includes('full hd') || lower.includes('1080p'))  resolution = 'FHD (1920×1080)';
  else if (lower.includes('hd+'))                                                            resolution = 'HD+ (1600×900)';
  else if (lower.includes('hd'))                                                             resolution = 'HD (1366×768)';

  // ── Tipo de panel ─────────────────────────────────────────────────────
  let panel = 'N/D';
  if      (lower.includes('oled'))    panel = 'OLED';
  else if (lower.includes('ips'))     panel = 'IPS';
  else if (/\bva\b/.test(lower))      panel = 'VA';
  else if (/\btn\b/.test(lower))      panel = 'TN';

  // ── Tasa de refresco ──────────────────────────────────────────────────
  const hzM    = lower.match(/(\d+)\s*hz\b/i);
  const refresh = hzM ? hzM[1] + 'Hz' : 'N/D';

  // ── Sistema Operativo ─────────────────────────────────────────────────
  let os = 'N/D';
  if      (lower.includes('macos') || lower.includes('mac os'))          os = 'macOS';
  else if (/freedos|free.dos/.test(lower))                               os = 'FreeDOS';
  else if (/win11.{0,5}pro|w11.{0,5}pro|w11procopilot/.test(lower))     os = 'Windows 11 Pro';
  else if (lower.includes('win11') || lower.includes('w11'))             os = 'Windows 11';
  else if (/win10.{0,5}pro|w10.{0,5}pro/.test(lower))                   os = 'Windows 10 Pro';
  else if (lower.includes('win10') || lower.includes('w10'))             os = 'Windows 10';
  else if (lower.includes('windows'))                                     os = 'Windows';
  else if (lower.includes('linux') || lower.includes('ubuntu'))          os = 'Linux';

  // ── GPU / Tarjeta gráfica ─────────────────────────────────────────────
  let gpu = 'N/D';
  const rtxM = lower.match(/rtx\s*\d{4}[a-z0-9]*/i);
  const gtxM = lower.match(/gtx\s*\d{4}[a-z0-9]*/i);
  const rxM  = lower.match(/rx\s*\d{4}[a-z0-9]*/i);
  if      (rtxM)                           gpu = rtxM[0].toUpperCase();
  else if (gtxM)                           gpu = gtxM[0].toUpperCase();
  else if (rxM)                            gpu = rxM[0].toUpperCase();
  else if (lower.includes('iris xe'))      gpu = 'Intel Iris Xe';
  else if (lower.includes('iris plus'))    gpu = 'Intel Iris Plus';
  else if (lower.includes('uhd graphics')) gpu = 'Intel UHD Graphics';
  else if (lower.includes('arc a'))        gpu = 'Intel Arc';
  else if (lower.includes('radeon'))       gpu = 'AMD Radeon';

  // ── Tipo de memoria (RAM / VRAM) ──────────────────────────────────────
  let memType = 'N/D';
  if      (lower.includes('gddr6x')) memType = 'GDDR6X';
  else if (lower.includes('gddr6'))  memType = 'GDDR6';
  else if (lower.includes('gddr5'))  memType = 'GDDR5';
  else if (lower.includes('lpddr5')) memType = 'LPDDR5';
  else if (lower.includes('lpddr4')) memType = 'LPDDR4';
  else if (lower.includes('ddr5'))   memType = 'DDR5';
  else if (lower.includes('ddr4'))   memType = 'DDR4';
  else if (lower.includes('ddr3'))   memType = 'DDR3';

  // VRAM con contexto
  const vramCtxM = lower.match(/(\d+)\s*gb\s*(?:gddr|video|vram)/i)
                || lower.match(/(?:gddr|video|vram)\s*(\d+)\s*gb/i);
  const vram     = vramCtxM
    ? vramCtxM[1] + ' GB'
    : (gpu !== 'N/D' && gbValues.length > 0 ? gbValues[0].raw : 'N/D');

  // ── Socket CPU ────────────────────────────────────────────────────────
  let socket = 'N/D';
  if      (lower.includes('am5'))                                socket = 'AM5';
  else if (lower.includes('am4'))                                socket = 'AM4';
  else if (lower.includes('lga1851') || lower.includes('1851')) socket = 'LGA1851';
  else if (lower.includes('lga1700') || lower.includes('1700')) socket = 'LGA1700';
  else if (lower.includes('lga1200') || lower.includes('1200')) socket = 'LGA1200';
  else if (lower.includes('lga1151') || lower.includes('1151')) socket = 'LGA1151';

  // ── Chipset ───────────────────────────────────────────────────────────
  const chipsetM = lower.match(/\b([abxhz]\d{3,4})\b/i);
  const chipset  = chipsetM ? chipsetM[1].toUpperCase() : 'N/D';

  // ── Frecuencia GHz ────────────────────────────────────────────────────
  const ghzM      = lower.match(/(\d+(?:\.\d+)?)\s*ghz/i);
  const frequency = ghzM ? ghzM[0].toUpperCase() : 'N/D';

  // ── Núcleos / Hilos ───────────────────────────────────────────────────
  const coresM   = lower.match(/(\d+)\s*(?:core|nucleo)/i);
  const threadsM = lower.match(/(\d+)\s*(?:hilo|thread)/i);
  const cores    = coresM && threadsM
    ? `${coresM[1]} Núcleos / ${threadsM[1]} Hilos`
    : coresM ? `${coresM[1]} Núcleos` : 'N/D';

  // ── Caché ─────────────────────────────────────────────────────────────
  const cacheM = lower.match(/(\d+)\s*mb\s*(?:cache|cach[eé])?/i);
  const cache  = cacheM ? cacheM[1] + ' MB' : 'N/D';

  // ── TDP / Potencia ────────────────────────────────────────────────────
  const wattM = lower.match(/(\d{2,4})\s*w\b/i);
  const tdp   = wattM ? wattM[1] + 'W' : 'N/D';
  // PSU: wattaje alto (450W, 650W, 850W...)
  const powerM = lower.match(/(\d{3,4})\s*w\b/i);
  const power  = powerM ? powerM[1] + 'W' : 'N/D';

  // ── Certificación 80 Plus ─────────────────────────────────────────────
  let certification = '80 Plus';
  if      (lower.includes('titanium'))                              certification = '80 Plus Titanium';
  else if (lower.includes('platinum') || lower.includes('platino')) certification = '80 Plus Platinum';
  else if (lower.includes('gold') || lower.includes('oro'))         certification = '80 Plus Gold';
  else if (lower.includes('silver'))                                certification = '80 Plus Silver';
  else if (lower.includes('bronze') || lower.includes('bronce'))   certification = '80 Plus Bronze';
  else if (lower.includes('white'))                                 certification = '80 Plus White';

  // ── Modular ───────────────────────────────────────────────────────────
  let modular = 'No Modular';
  if      (/full.{0,5}modular|fully.{0,5}modular/.test(lower)) modular = 'Full Modular';
  else if (/semi.{0,5}modular/.test(lower))                    modular = 'Semi-Modular';

  // ── Velocidad RAM / Kit ───────────────────────────────────────────────
  const mhzM    = lower.match(/(\d{4})\s*mhz/i);
  const speed   = mhzM ? mhzM[1] + ' MHz' : 'N/D';
  const kitM    = lower.match(/(\d+)\s*x\s*(\d+)\s*gb/i);
  const kit     = kitM ? `${kitM[1]}× ${kitM[2]} GB` : '1 módulo';
  let ramFormat = 'DIMM (Desktop)';
  if (lower.includes('sodimm') || lower.includes('so-dimm')) ramFormat = 'SODIMM (Laptop)';

  // ── Factor de forma / Tipo de almacenamiento ──────────────────────────
  let formFactor = 'N/D';
  if      (/micro.{0,3}atx|matx/.test(lower))         formFactor = 'Micro-ATX';
  else if (/mini.{0,3}itx|\bitx\b/.test(lower))        formFactor = 'Mini-ITX';
  else if (/e.{0,3}atx|eatx/.test(lower))              formFactor = 'E-ATX';
  else if (lower.includes('atx'))                       formFactor = 'ATX';
  else if (lower.includes('m.2'))                       formFactor = 'M.2 2280';
  else if (lower.includes('2.5'))                       formFactor = '2.5"';
  else if (lower.includes('3.5'))                       formFactor = '3.5"';

  let storageType = 'N/D';
  if      (lower.includes('nvme') || lower.includes('m.2'))                                    storageType = 'SSD NVMe M.2';
  else if (lower.includes('sata') && lower.includes('ssd'))                                    storageType = 'SSD SATA III';
  else if (lower.includes('ssd'))                                                               storageType = 'SSD';
  else if (lower.includes('hdd') || lower.includes('disco duro') || lower.includes('terabyte'))storageType = 'Disco Duro (HDD)';

  // ── Bus de GPU ────────────────────────────────────────────────────────
  const busM = lower.match(/(\d+)\s*-?bit/i);
  const bus  = busM ? busM[1] + '-bit' : 'N/D';

  // ── Cooler / Ventilador ───────────────────────────────────────────────
  const fanSizeM = lower.match(/\b(\d+)\s*mm\b/i);
  const fanSize  = fanSizeM ? fanSizeM[1] + ' mm' : 'N/D';

  let coolerType = 'N/D';
  if      (/liquid|water|aio|liquida/.test(lower))     coolerType = 'Enfriamiento Líquido (AIO)';
  else if (/tower|air cooler/.test(lower))             coolerType = 'Air Cooler';
  else if (/\bfan\b|ventilador/.test(lower))           coolerType = 'Ventilador de Case';

  let coolerIncluded = 'N/D';
  if      (/no fan|no cooler|\btray\b/.test(lower))    coolerIncluded = 'Sin disipador (Tray)';
  else if (/\bbox\b|with cooler|with fan/.test(lower)) coolerIncluded = 'Con disipador (Box)';

  // ── Gabinete ──────────────────────────────────────────────────────────
  let caseFormat = 'ATX Mid Tower';
  if      (/full.{0,5}tower/.test(lower))              caseFormat = 'ATX Full Tower';
  else if (lower.includes('mini') && !lower.includes('mini pc') && !lower.includes('minipc'))
                                                        caseFormat = 'Mini ITX / Micro ATX';

  // ── Iluminación ───────────────────────────────────────────────────────
  let lighting = 'Sin RGB';
  if      (lower.includes('argb')) lighting = 'ARGB';
  else if (lower.includes('rgb'))  lighting = 'RGB';

  // ── Color ─────────────────────────────────────────────────────────────
  let color = 'N/D';
  for (const ck of COLOR_KEYWORDS) {
    if (lower.includes(ck.toLowerCase())) { color = ck.charAt(0).toUpperCase() + ck.slice(1); break; }
  }

  return {
    processor, processorModel,
    ram, storage: storageFull, storageType,
    screen, resolution, panel, refresh,
    os, gpu, vram, memType,
    socket, chipset, cores, frequency, cache, tdp,
    power, certification, modular,
    formFactor, ramFormat, caseFormat, lighting,
    fanSize, coolerType, coolerIncluded,
    speed, bus, kit, color,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRUCTOR DE OBJETO TIPADO (por categoría)
// Mapea el mapa plano de universalExtract al objeto que ya espera el frontend.
// ─────────────────────────────────────────────────────────────────────────────

function buildSpecsObject(e, categoria) {
  if (categoria === 'procesadores') {
    return {
      type: 'processor',
      model: e.processorModel !== 'N/D' ? e.processorModel : e.processor,
      socket: e.socket,
      cores: e.cores,
      frequency: e.frequency,
      cache: e.cache,
      tdp: e.tdp,
      cooler: e.coolerIncluded,
    };
  }
  if (categoria === 'tarjetas-video') {
    return {
      type: 'gpu',
      gpu: e.gpu,
      vram: e.vram,
      memType: e.memType !== 'N/D' ? e.memType : 'GDDR6',
      bus: e.bus,
    };
  }
  if (categoria === 'motherboards') {
    return {
      type: 'motherboard',
      socket: e.socket,
      chipset: e.chipset,
      memType: e.memType !== 'N/D' ? e.memType : 'DDR4',
      formFactor: e.formFactor !== 'N/D' ? e.formFactor : 'ATX',
    };
  }
  if (categoria === 'ram') {
    return {
      type: 'ram',
      capacity: e.ram,
      memType: e.memType !== 'N/D' ? e.memType : 'DDR4',
      speed: e.speed,
      format: e.ramFormat,
      kit: e.kit,
    };
  }
  if (categoria === 'almacenamiento') {
    return {
      type: 'storage',
      capacity: e.storage !== 'N/D' ? e.storage : e.ram,
      storageType: e.storageType,
      formFactor: e.formFactor,
    };
  }
  if (categoria === 'fuentes') {
    return {
      type: 'power_supply',
      power: e.power,
      certification: e.certification,
      modular: e.modular,
    };
  }
  if (categoria === 'cases') {
    return {
      type: 'case',
      formFactor: e.caseFormat,
      fans: e.lighting !== 'Sin RGB' ? `Incluye ventiladores ${e.lighting}` : 'N/D',
      color: e.color,
    };
  }
  if (categoria === 'coolers' || categoria === 'ventiladores') {
    return {
      type: 'cooling',
      coolingType: e.coolerType,
      size: e.fanSize,
    };
  }
  if (categoria === 'monitores' || categoria === 'gaming-monitores' || categoria === 'monitors') {
    return {
      type: 'monitor',
      size: e.screen,
      resolution: e.resolution !== 'N/D' ? e.resolution : 'FHD (1920×1080)',
      refresh: e.refresh !== 'N/D' ? e.refresh : '60Hz',
      panel: e.panel,
    };
  }
  // Laptops / Desktops / Mini PCs
  return {
    type: 'computer',
    processor: e.processor,
    processorModel: e.processorModel,
    ram: e.ram,
    storage: e.storage,
    screen: e.screen,
    resolution: e.resolution,
    os: e.os !== 'N/D' ? e.os : 'Windows 11',
    color: e.color,
    gpu: e.gpu,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRADA PÚBLICA — reemplaza la antigua función monolítica
// ─────────────────────────────────────────────────────────────────────────────

function parseSpecs(nombre, categoria) {
  const lower = (nombre || '').toLowerCase();
  const extracted = universalExtract(lower);
  return buildSpecsObject(extracted, categoria);
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECS REALES (Nivel 2 de scraping)
// Usa los datos reales scrapeados; si un campo falta, cae en universalExtract.
// ─────────────────────────────────────────────────────────────────────────────

function buildSpecsFromReal(real, categoria, nombreFallback) {
  const get  = (key) => (real[key] && real[key] !== '') ? real[key] : null;
  const nd   = 'N/D';
  // Fallback dinámico desde el nombre cuando no hay dato real
  const fb   = nombreFallback ? universalExtract(nombreFallback.toLowerCase()) : {};
  const safe = (realVal, fbKey) => realVal || fb[fbKey] || nd;

  if (categoria === 'procesadores') {
    return {
      type: 'processor',
      model: safe(get('procesador'), 'processor'),
      socket: safe(get('socket'), 'socket'),
      cores: (() => { const n = get('nucleos'); const h = get('hilos'); return n && h ? `${n} / ${h}` : n || h || safe(null, 'cores'); })(),
      frequency: safe(get('frecuencia'), 'frequency'),
      cache: safe(get('cache'), 'cache'),
      tdp: safe(get('tdp'), 'tdp'),
      cooler: nd,
    };
  }
  if (categoria === 'tarjetas-video') {
    return { type: 'gpu', gpu: safe(get('gpu') || get('procesador'), 'gpu'), vram: safe(get('vram'), 'vram'), memType: safe(get('memType'), 'memType') || 'GDDR6', bus: safe(get('bus'), 'bus') };
  }
  if (categoria === 'motherboards') {
    return { type: 'motherboard', socket: safe(get('socket'), 'socket'), chipset: nd, memType: safe(null, 'memType') || 'DDR4', formFactor: safe(get('formato'), 'formFactor') };
  }
  if (categoria === 'ram') {
    return { type: 'ram', capacity: safe(get('ram'), 'ram'), memType: safe(null, 'memType') || 'DDR4', speed: safe(get('velocidad'), 'speed'), format: safe(get('formato'), 'ramFormat'), kit: safe(null, 'kit') };
  }
  if (categoria === 'almacenamiento') {
    return { type: 'storage', capacity: safe(get('almacenamiento'), 'storage'), storageType: safe(null, 'storageType'), formFactor: safe(get('formato'), 'formFactor') };
  }
  if (categoria === 'fuentes') {
    return { type: 'power_supply', power: safe(null, 'power'), certification: safe(null, 'certification'), modular: safe(null, 'modular') };
  }
  if (categoria === 'cases') {
    return { type: 'case', formFactor: safe(get('formato'), 'caseFormat'), fans: nd, color: safe(get('color'), 'color') };
  }
  if (categoria === 'coolers' || categoria === 'ventiladores') {
    return { type: 'cooling', coolingType: safe(null, 'coolerType'), size: safe(null, 'fanSize') };
  }
  if (categoria === 'monitores' || categoria === 'gaming-monitores' || categoria === 'monitors') {
    return { type: 'monitor', size: safe(get('pantalla'), 'screen'), resolution: safe(get('resolucion'), 'resolution') || 'FHD (1920×1080)', refresh: safe(get('refresco'), 'refresh') || '60Hz', panel: safe(get('panel'), 'panel') };
  }
  // Laptops / Desktops / Mini PCs
  return {
    type: 'computer',
    processor: safe(get('procesador'), 'processor'),
    processorModel: safe(null, 'processorModel'),
    ram: safe(get('ram'), 'ram'),
    storage: safe(get('almacenamiento'), 'storage'),
    screen: safe(get('pantalla'), 'screen'),
    resolution: safe(get('resolucion'), 'resolution'),
    os: safe(get('sistema_operativo'), 'os') || 'Windows 11',
    color: safe(get('color'), 'color'),
    gpu: safe(get('gpu'), 'gpu'),
    bateria: get('bateria') || nd,
    puertos: get('puertos') || nd,
    camara: get('camara') || nd,
    peso: get('peso') || nd,
    teclado: get('teclado') || nd,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRIQUECIMIENTO DE PRODUCTO
// ─────────────────────────────────────────────────────────────────────────────

function enrichProduct(product) {
  const brand   = parseBrand(product.nombre);
  const pricing = calculatePricing(product.precio);
  const dateOnly = product.ultima_actualizacion
    ? product.ultima_actualizacion.split(' ')[0]
    : '';

  // URL de origen
  let url = product.url;
  if (!url) {
    const cat = product.categoria || 'laptops';
    const catUrlName =
      cat === 'procesadores'    ? 'procesador' :
      cat === 'tarjetas-video'  ? 'tarjeta-video' :
      cat === 'motherboards'    ? 'motherboard' :
      cat === 'fuentes'         ? 'fuente-de-poder-80-plus' :
      cat === 'coolers'         ? 'cooler-cpu-pc-enfriador-heat-sink' :
      cat === 'almacenamiento'  ? 'disco-duro-ssd-hdd' :
      cat === 'ram'             ? 'memoria-ram-dimm-sodimm-hp-dell' :
      cat === 'cases'           ? 'case-de-pc' :
      cat === 'ventiladores'    ? 'fan-ventilador-pc' :
      (cat === 'monitores' || cat === 'monitors' || cat === 'gaming-monitores') ? 'monitor-pc-pantalla-samsung-lg-dell' :
      cat === 'desktops'        ? 'pc-desktop-torre' :
      cat === 'minipcs'         ? 'mini-pc-nuc-intel-core' :
      'laptop';
    url = `https://tecnomegastore.ec/product/${catUrlName}?code=${product.sku}`;
  }

  // Specs: nivel 2 (reales) si existen, si no el extractor universal del nombre
  let specs;
  let imagenes = [];
  if (product.specs_json) {
    try {
      const real = JSON.parse(product.specs_json);
      specs = buildSpecsFromReal(real, product.categoria, product.nombre);
      if (real.imagenes && Array.isArray(real.imagenes)) {
        imagenes = real.imagenes;
      }
    } catch (_) {
      specs = parseSpecs(product.nombre, product.categoria);
    }
  } else {
    specs = parseSpecs(product.nombre, product.categoria);
  }

  const productImages = imagenes.length > 0 ? imagenes : [product.imagen_url];

  return {
    ...product,
    brand,
    specs,
    pricing,
    dateOnly,
    url,
    hasRealSpecs: !!product.specs_json,
    imagenes: productImages,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTRADO, PAGINACIÓN Y UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtra, ordena y pagina el catálogo delegando toda la lógica a SQLite.
 *
 * La BD devuelve solo la página de resultados solicitada; this function
 * aplica enrichProduct() únicamente sobre ese subconjunto pequeño.
 * La carga de memoria pasa de O(N_total) a O(page_size), donde page_size ≤ 100.
 *
 * @param {object}   options
 * @param {string}   [options.search='']            Texto libre
 * @param {string[]} [options.brands=[]]            Marcas seleccionadas
 * @param {number}   [options.minPrice=0]           Precio mínimo
 * @param {number}   [options.maxPrice=Infinity]    Precio máximo
 * @param {string}   [options.sort='relevancia']    Criterio de orden
 * @param {number}   [options.page=1]               Página actual
 * @param {number}   [options.limit]                Items por página
 * @param {string}   [options.category='laptops']   Categoría
 * @returns {Promise<{products:Array, total:number, page:number, totalPages:number, limit:number}>}
 */
async function filterProducts(options = {}) {
  const {
    search   = '',
    brands   = [],
    minPrice = 0,
    maxPrice = Infinity,
    sort     = 'relevancia',
    page     = 1,
    limit    = SERVER_CONFIG.DEFAULT_PAGE_SIZE,
    category = 'laptops',
  } = options;

  // Delegar filtrado, orden y paginación completamente a SQLite.
  // getPaginatedProducts necesita el mapa de keywords de marca para
  // construir las cláusulas LIKE correctas (ver database.js).
  const { rows, total, page: safePage, totalPages, limit: safeLimit } =
    await getPaginatedProducts({
      category,
      search,
      brands,
      brandKeywords: BRAND_KEYWORDS_MAP,    // map brand → [keywords]
      minPrice,
      maxPrice: maxPrice === Infinity ? 1e9 : maxPrice,  // Infinity no es válido en SQL
      sort,
      page,
      limit,
    });

  // Enriquecer únicamente la página recibida (máximo `safeLimit` registros).
  const products = rows.map(enrichProduct);

  return { products, total, page: safePage, totalPages, limit: safeLimit };
}

async function getBrandCounts(category = 'laptops') {
  const products    = await getAllProducts(category);
  const brandCounts = {};
  products.forEach(p => { const b = parseBrand(p.nombre); brandCounts[b] = (brandCounts[b] || 0) + 1; });
  return Object.entries(brandCounts).map(([brand, count]) => ({ brand, count })).filter(i => i.count > 0).sort((a, b) => b.count - a.count);
}

async function getRelatedProducts(sku, limitResults = SERVER_CONFIG.MAX_RELATED_PRODUCTS, category = 'laptops') {
  const allProducts    = await getAllProducts(category);
  const currentProduct = allProducts.find(p => p.sku === sku);
  if (!currentProduct) return [];

  const brand    = parseBrand(currentProduct.nombre);
  let related    = allProducts.filter(p => p.sku !== sku);
  const sameBrand = related.filter(p => parseBrand(p.nombre) === brand);

  if (sameBrand.length >= limitResults / 2) {
    related = sameBrand;
  } else {
    const priceMin    = currentProduct.precio * 0.8;
    const priceMax    = currentProduct.precio * 1.2;
    const similarPrice = related.filter(p => p.precio >= priceMin && p.precio <= priceMax);
    const combined    = [...sameBrand, ...similarPrice];
    related = combined.filter((item, idx) => combined.findIndex(x => x.sku === item.sku) === idx);
  }

  return related.sort(() => 0.5 - Math.random()).slice(0, limitResults).map(enrichProduct);
}

async function getPriceRange(category = 'laptops') {
  const products = await getAllProducts(category);
  const prices   = products.map(p => p.precio).filter(p => typeof p === 'number' && p > 0);
  if (prices.length === 0) return { min: 0, max: 3000 };
  return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
}

module.exports = {
  parseBrand,
  parseSpecs,
  enrichProduct,
  filterProducts,
  getBrandCounts,
  getRelatedProducts,
  getPriceRange,
  // Exportado para uso de computerService.js al construir condiciones LIKE de marca
  BRAND_KEYWORDS_MAP,
};
