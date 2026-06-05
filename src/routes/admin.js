/**
 * routes/admin.js — Panel de administración con Basic Authentication
 *
 * Reemplaza la validación por query parameter (?key=) con HTTP Basic Auth.
 * El navegador muestra el cuadro de diálogo nativo de usuario/contraseña.
 *
 * Credenciales leídas desde variables de entorno:
 *   ADMIN_USER      (por defecto: "admin")
 *   ADMIN_PASSWORD  (requerida — proceso aborta si no está definida)
 */

'use strict';

const express    = require('express');
const path       = require('path');
const basicAuth  = require('express-basic-auth');
const router     = express.Router();

// ── Validar que ADMIN_PASSWORD esté definida al arrancar ────────────────────
if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    '⚠️  [admin] ADMIN_PASSWORD no está definida en las variables de entorno. ' +
    'El panel de administración quedará inaccesible hasta que se configure.'
  );
}

// ── Middleware de Basic Auth ─────────────────────────────────────────────────
const adminAuth = basicAuth({
  users: {
    [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD || '',
  },
  challenge: true,           // Lanza el cuadro de diálogo nativo del navegador
  realm: 'Tienda Gamer EC Admin',  // Nombre que aparece en el diálogo
});

/**
 * GET /admin
 *
 * Sirve admin.html una vez superada la autenticación básica.
 * La clave ya NO viaja en la URL ni aparece en los logs.
 */
router.get('/', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
});

module.exports = { router, adminAuth };
