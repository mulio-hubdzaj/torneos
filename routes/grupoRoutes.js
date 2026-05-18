// routes/grupos.js
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models'); // Importamos sequelize
const grupoController = require('../controllers/grupoController');

function requiereAdmin(req, res, next) {
  if (![3, 99].includes(Number(req.session.rol_id))) {
    req.flash("danger", "No tiene permisos para administrar grupos");
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

// Crear grupo
router.post('/crear', requiereAdmin, async (req, res) => {
  await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
  return grupoController.crear(req, res);
});

// Gestionar grupo individual
router.get('/gestionar/:id_grupo', grupoController.gestionar);

// Listar grupos de un torneo (gestión)
router.get('/gestionar/:id_torneo', grupoController.listar);

// Editar grupo
router.post('/editar/:id_grupo', requiereAdmin, async (req, res) => {
  await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
  return grupoController.editar(req, res);
});

// Mostrar/ocultar grupo en Fixture
router.post('/fixture-visibilidad/:id_grupo', requiereAdmin, async (req, res) => {
  await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
  return grupoController.actualizarVisibilidadFixture(req, res);
});

// Eliminar grupo
router.post('/eliminar/:id_grupo', requiereAdmin, async (req, res) => {
  await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
  return grupoController.eliminar(req, res);
});

module.exports = router;
