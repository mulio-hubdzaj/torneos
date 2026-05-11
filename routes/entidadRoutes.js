// routes/entidadRoutes.js
const express = require('express');
const router = express.Router();
const { Entity, Usuario, Torneo } = require('../models');
const entityController = require('../controllers/entityController');

// Gestión de entidad con validaciones
router.get('/gestionar/:id', async (req, res) => {
  try {
    if (!req.session.usuario_id) {
      req.flash("danger", "Debes iniciar sesión");
      return res.redirect('/login');
    }

    const entidad = await Entity.findByPk(req.params.id);
    const usuario = await Usuario.findByPk(req.session.usuario_id);

    if (!entidad) {
      req.flash("danger", "Entidad no encontrada");
      return res.redirect('/login');
    }

    // Validar permisos según rol
    if (![1, 2, 3, 99].includes(usuario.rol_id)) {
      req.flash("danger", "Acceso restringido");
      return res.redirect('/login');
    }

    const torneos = await Torneo.findAll({
      where: { entity_id: req.params.id }
    });

    res.render('entidad/index', {
      entidad,
      usuario,
      torneos,
      jugadores: [],
      //messages: req.flash()
    });
  } catch (error) {
    console.error("Error al cargar entidad:", error);
    req.flash("danger", "Ocurrió un error al cargar la entidad");
    res.redirect('/login');
  }
});

// Crear entidad (usa controlador)
router.get('/entities/create', entityController.crear);   // muestra formulario
router.post('/entities/create', entityController.crear);  // procesa envío del form

// Editar entidad
router.get('/entities/edit/:entity_id', entityController.editar);   // muestra formulario
router.post('/entities/edit/:entity_id', entityController.editar);  // procesa envío del form

// Activar / desactivar entidad
router.post('/entities/activar/:entity_id', entityController.activar);
router.post('/entities/desactivar/:entity_id', entityController.desactivar);

module.exports = router;
