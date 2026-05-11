// routes/grupos.js
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models'); // Importamos sequelize
const grupoController = require('../controllers/grupoController');

// Crear grupo
router.post('/crear', async (req, res) => {
  await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
  return grupoController.crear(req, res);
});

// Gestionar grupo individual
router.get('/gestionar/:id_grupo', grupoController.gestionar);

// Listar grupos de un torneo (gestión)
router.get('/gestionar/:id_torneo', grupoController.listar);

// Editar grupo
router.post('/editar/:id_grupo', async (req, res) => {
  await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
  return grupoController.editar(req, res);
});

// Eliminar grupo
router.post('/eliminar/:id_grupo', async (req, res) => {
  await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
  return grupoController.eliminar(req, res);
});

module.exports = router;
