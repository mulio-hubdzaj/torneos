// routes/entidadRoutes.js
const express = require('express');
const router = express.Router();
const { Entity, Usuario, Torneo } = require('../models');
const entityController = require('../controllers/entityController');

function requiereSuperAdmin(req, res, next) {
  if (Number(req.session.rol_id) !== 99) {
    req.flash("danger", "Solo el super admin puede administrar entidades");
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

async function redirigirAEntidadDeTrabajo(req, res, entityId) {
  const torneo = await Torneo.findOne({
    where: { entity_id: entityId, estado: true },
    order: [['nombre_torneo', 'ASC']]
  });

  req.session.entity_id = entityId;

  if (torneo) {
    req.session.torneo_id = torneo.id_torneo;
    return res.redirect(`/torneos/gestionar/${torneo.id_torneo}?tab=torneos#torneos`);
  }

  return res.redirect(`/entidad/gestionar/${entityId}`);
}

router.get('/seleccionar/:id', async (req, res) => {
  try {
    if (!req.session.usuario_id) {
      req.flash("danger", "Debes iniciar sesion");
      return res.redirect('/login');
    }

    const entidad = await Entity.findOne({
      where: { entity_id: req.params.id, activo: true }
    });

    if (!entidad) {
      req.flash("danger", "Entidad no encontrada");
      return res.redirect('/admin');
    }

    const usuario = await Usuario.findByPk(req.session.usuario_id);
    if (!usuario || ![3, 99].includes(Number(usuario.rol_id))) {
      req.flash("danger", "Acceso restringido");
      return res.redirect('/login');
    }

    if (Number(usuario.rol_id) !== 99 && Number(usuario.entity_id) !== Number(entidad.entity_id)) {
      req.flash("danger", "No puede acceder a una entidad ajena");
      return res.redirect('/torneos');
    }

    return redirigirAEntidadDeTrabajo(req, res, entidad.entity_id);
  } catch (error) {
    console.error("Error al seleccionar entidad:", error);
    req.flash("danger", "Ocurrio un error al seleccionar la entidad");
    return res.redirect('/admin');
  }
});

// Gestion de entidad con validaciones
router.get('/gestionar/:id', async (req, res) => {
  try {
    if (!req.session.usuario_id) {
      req.flash("danger", "Debes iniciar sesion");
      return res.redirect('/login');
    }

    const entidad = await Entity.findByPk(req.params.id);
    const usuario = await Usuario.findByPk(req.session.usuario_id);

    if (!entidad) {
      req.flash("danger", "Entidad no encontrada");
      return res.redirect('/login');
    }

    if (!usuario || ![1, 2, 3, 99].includes(Number(usuario.rol_id))) {
      req.flash("danger", "Acceso restringido");
      return res.redirect('/login');
    }

    if (Number(usuario.rol_id) !== 99 && Number(usuario.entity_id) !== Number(entidad.entity_id)) {
      req.flash("danger", "No puede acceder a una entidad ajena");
      return res.redirect('/torneos');
    }

    const torneos = await Torneo.findAll({
      where: { entity_id: entidad.entity_id },
      order: [
        ['estado', 'DESC'],
        ['nombre_torneo', 'ASC']
      ]
    });

    req.session.entity_id = entidad.entity_id;

    res.render('entidad/index', {
      entidad,
      usuario,
      torneos,
      jugadores: []
    });
  } catch (error) {
    console.error("Error al cargar entidad:", error);
    req.flash("danger", "Ocurrio un error al cargar la entidad");
    res.redirect('/login');
  }
});

// Crear entidad (solo super admin)
router.get('/entities/create', requiereSuperAdmin, entityController.crear);
router.post('/entities/create', requiereSuperAdmin, entityController.crear);

// Editar entidad (solo super admin)
router.get('/entities/edit/:entity_id', requiereSuperAdmin, entityController.editar);
router.post('/entities/edit/:entity_id', requiereSuperAdmin, entityController.editar);

// Activar / desactivar entidad (solo super admin)
router.post('/entities/activar/:entity_id', requiereSuperAdmin, entityController.activar);
router.post('/entities/desactivar/:entity_id', requiereSuperAdmin, entityController.desactivar);

module.exports = router;
