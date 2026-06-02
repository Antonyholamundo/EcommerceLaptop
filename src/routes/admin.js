/**
 * routes/admin.js — Rutas protegidas del panel de administración
 * 
 * Protección server-side: el archivo admin.html NO se sirve como estático.
 * Solo se entrega cuando la key es correcta.
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const { SERVER_CONFIG } = require('../config');

/**
 * GET /admin
 * 
 * Valida la key por query param y sirve admin.html.
 * Si la key es incorrecta, redirige a /.
 */
router.get('/', (req, res) => {
  const { key } = req.query;
  if (key === SERVER_CONFIG.ADMIN_KEY) {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
  } else {
    res.redirect('/');
  }
});

module.exports = router;
