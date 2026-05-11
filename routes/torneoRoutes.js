// routes/torneoRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

const { Torneo, sequelize } = require('../models');
const torneoController = require('../controllers/torneoController');
const upload = multer({ dest: 'public/uploads/' });

// Listar torneos (vista general)
router.get('/', torneoController.listar);

// Formulario de creación
router.get('/crear', (req, res) => {
  const entityId = req.query.entity_id;
  res.render('torneos/crear', {
    entityId,
    messages: req.flash()
  });
});

// Guardar torneo nuevo
router.post('/crear', async (req, res) => {
  try {
    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    const { nombre_torneo, temporada, fecha_inicio, entity_id } = req.body;

    await Torneo.create({
      nombre_torneo,
      temporada,
      fecha_inicio,
      estado: true,
      entity_id
    });

    req.flash("success", "Torneo creado correctamente");
    res.redirect(`/entidad/gestionar/${entity_id}`);
  } catch (error) {
    console.error("Error al crear torneo:", error);
    req.flash("danger", "No se pudo crear el torneo");
    res.redirect(`/entidad/gestionar/${req.body.entity_id}`);
  }
});

// Cambiar estado
router.post('/cambiar-estado/:id', async (req, res) => {
  try {
    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    const torneo = await Torneo.findByPk(req.params.id);
    if (!torneo) {
      req.flash("danger", "Torneo no encontrado");
      return res.redirect('back');
    }

    torneo.estado = !torneo.estado;
    await torneo.save();

    req.flash("success", "Estado del torneo actualizado");
    res.redirect(`/entidad/gestionar/${torneo.entity_id}`);
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    req.flash("danger", "No se pudo cambiar el estado del torneo");
    res.redirect('back');
  }
});

// Gestionar torneo específico
router.get('/gestionar/:id_torneo', torneoController.gestionar);
router.get('/:id_torneo/finanzas/resumen', torneoController.resumenFinanzas);
router.post('/:id_torneo/portada', upload.single('portada'), torneoController.actualizarPortada);
router.post('/:id_torneo/portada/eliminar', torneoController.eliminarPortada);
router.post('/:id_torneo/regla-tarjetas', torneoController.actualizarReglaTarjetas);
router.post('/:id_torneo/usuarios/:id_usuario/toggle', torneoController.toggleUsuarioAdmin);
router.post('/:id_torneo/usuarios/:id_usuario/permisos', torneoController.cambiarPermisosUsuario);
router.post('/:id_torneo/usuarios/:id_usuario/reset-password', torneoController.resetearContrasenaUsuario);


// Ver torneos activos y grupos (solo lectura)
router.get('/grupos', async (req, res) => {
  try {
    const entityId = req.query.entity_id || req.session.entity_id;

    // Traer torneos activos de la entidad
    const torneos = await Torneo.findAll({
      where: { entity_id: entityId, estado: true } // estado=true = activo
    });

    // Si se selecciona un torneo, traer sus grupos activos
    let grupos = [];
    if (req.query.torneo_id) {
      grupos = await sequelize.query(
        "SELECT * FROM grupos WHERE id_torneo = :torneo_id AND estado = true",
        { replacements: { torneo_id: req.query.torneo_id }, type: sequelize.QueryTypes.SELECT }
      );
    }

    res.render('torneos/grupos', {
      torneos,
      grupos,
      selectedTorneo: req.query.torneo_id || null,
      messages: req.flash()
    });
  } catch (error) {
    console.error("Error en /torneos/grupos:", error);
    req.flash("danger", "Error al cargar grupos");
    res.redirect('/login');
  }
});


module.exports = router;
