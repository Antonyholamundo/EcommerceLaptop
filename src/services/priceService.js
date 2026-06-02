/**
 * priceService.js — Servicio centralizado de precios
 * Maneja formateo de moneda y cálculos de precio de referencia.
 */

const { SERVER_CONFIG } = require('../config');

/**
 * Formatea un valor numérico como moneda USD.
 * @param {number} value - El número a formatear
 * @returns {string} Texto formateado ej. "$1,249.99"
 */
function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Calcula el precio de referencia (precio "original" antes del descuento).
 * @param {number} basePrice - El precio base del producto
 * @returns {{ price: number, referencePrice: number, savings: number, savingsPercent: number }}
 */
function calculatePricing(basePrice) {
  if (typeof basePrice !== 'number' || isNaN(basePrice) || basePrice <= 0) {
    return {
      price: 0,
      referencePrice: 0,
      savings: 0,
      savingsPercent: 0,
      priceFormatted: '$0.00',
      referencePriceFormatted: '$0.00',
      savingsFormatted: '$0.00',
    };
  }

  const markup = SERVER_CONFIG.REFERENCE_PRICE_MARKUP;
  const referencePrice = +(basePrice * (1 + markup)).toFixed(2);
  const savings = +(referencePrice - basePrice).toFixed(2);
  const savingsPercent = Math.round(markup * 100);

  return {
    price: basePrice,
    referencePrice,
    savings,
    savingsPercent,
    priceFormatted: formatCurrency(basePrice),
    referencePriceFormatted: formatCurrency(referencePrice),
    savingsFormatted: formatCurrency(savings),
  };
}

module.exports = {
  formatCurrency,
  calculatePricing,
};
