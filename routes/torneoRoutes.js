// routes/torneoRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

const { Torneo, sequelize } = require('../models');
const torneoController = require('../controllers/torneoController');
const upload = multer({ dest: 'public/uploads/' });

function requiereAdmin(req, res, next) {
  if (![3, 99].includes(Number(req.session.rol_id))) {
    req.flash('danger', 'No tiene permisos para administrar torneos');
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

// Listar torneos (vista general)
router.get('/', torneoController.listar);

// Formulario de creación
router.get('/crear', requiereAdmin, (req, res) => {
  const entityId = req.query.entity_id;
  res.render('torneos/crear', {
    entityId,
    messages: req.flash()
  });
});

// Guardar torneo nuevo
router.post('/crear', requiereAdmin, async (req, res) => {
  try {
    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    const { nombre_torneo, temporada, fecha_inicio, entity_id } = req.body;
    const entityIdSeguro = Number(req.session.rol_id) === 99 ? Number(entity_id) : Number(req.session.entity_id);

    if (!entityIdSeguro || (Number(req.session.rol_id) !== 99 && Number(entity_id) !== entityIdSeguro)) {
      req.flash("danger", "No puede crear torneos para otra entidad");
      return res.redirect(req.get('referer') || '/torneos');
    }

    await Torneo.create({
      nombre_torneo,
      temporada,
      fecha_inicio,
      estado: true,
      entity_id: entityIdSeguro
    });

    req.flash("success", "Torneo creado correctamente");
    res.redirect(`/entidad/gestionar/${entityIdSeguro}`);
  } catch (error) {
    console.error("Error al crear torneo:", error);
    req.flash("danger", "No se pudo crear el torneo");
    res.redirect(`/entidad/gestionar/${req.body.entity_id}`);
  }
});

// Cambiar estado
router.post('/cambiar-estado/:id', requiereAdmin, async (req, res) => {
  try {
    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    const torneo = await Torneo.findByPk(req.params.id);
    if (!torneo) {
      req.flash("danger", "Torneo no encontrado");
      return res.redirect('back');
    }

    if (Number(req.session.rol_id) !== 99 && Number(req.session.entity_id) !== Number(torneo.entity_id)) {
      req.flash("danger", "No puede modificar torneos de otra entidad");
      return res.redirect('/torneos');
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
router.get('/:id_torneo/en-curso/resumen', torneoController.resumenPartidosEnCurso);
router.get('/:id_torneo/finanzas/resumen', torneoController.resumenFinanzas);
router.post('/:id_torneo/finanzas/pdf-preparar', torneoController.prepararPdfFinanzas);
router.get('/:id_torneo/finanzas/pdf/:token', torneoController.verPdfFinanzasTemporal);
router.post('/:id_torneo/finanzas/pdf-descarga', torneoController.descargarPdfFinanzas);
router.get('/:id_torneo/auditoria/resumen', torneoController.auditoriaResumen);
router.post('/:id_torneo/portada', requiereAdmin, upload.single('portada'), torneoController.actualizarPortada);
router.post('/:id_torneo/portada/eliminar', requiereAdmin, torneoController.eliminarPortada);
router.post('/:id_torneo/permitir-agregar-jugadores', requiereAdmin, torneoController.actualizarPermitirAgregarJugadores);
router.post('/:id_torneo/permitir-modificar-iconos', requiereAdmin, torneoController.actualizarPermitirModificarIconos);
router.post('/:id_torneo/permitir-delegados-ver-estado-finanzas', requiereAdmin, torneoController.actualizarPermitirDelegadosVerEstadoFinanzas);
router.post('/:id_torneo/regla-tarjetas', requiereAdmin, torneoController.actualizarReglaTarjetas);
router.post('/:id_torneo/canchas', requiereAdmin, torneoController.crearCancha);
router.post('/:id_torneo/canchas/:id_cancha', requiereAdmin, torneoController.actualizarCancha);
router.post('/:id_torneo/canchas/:id_cancha/toggle', requiereAdmin, torneoController.toggleCancha);
router.post('/:id_torneo/usuarios/:id_usuario/toggle', torneoController.toggleUsuarioAdmin);
router.post('/:id_torneo/usuarios/:id_usuario/permisos', torneoController.cambiarPermisosUsuario);
router.post('/:id_torneo/usuarios/:id_usuario/reset-password', torneoController.resetearContrasenaUsuario);
router.post('/:id_torneo/usuarios/:id_usuario/editar', torneoController.editarDatosUsuarioSuperAdmin);


// Ver torneos activos y grupos (solo lectura)
router.get('/grupos', async (req, res) => {
  try {
    const rolSesion = Number(req.session.rol_id);
    const entityId = rolSesion === 99 ? (req.query.entity_id || req.session.entity_id) : req.session.entity_id;

    if (!entityId || (rolSesion !== 99 && req.query.entity_id && Number(req.query.entity_id) !== Number(req.session.entity_id))) {
      req.flash("danger", "No puede consultar grupos de otra entidad");
      return res.redirect('/torneos');
    }

    // Traer torneos activos de la entidad
    const torneos = await Torneo.findAll({
      where: { entity_id: entityId, estado: true } // estado=true = activo
    });

    // Si se selecciona un torneo, traer sus grupos activos
    let grupos = [];
    if (req.query.torneo_id) {
      const torneoSeleccionado = await Torneo.findOne({
        where: {
          id_torneo: req.query.torneo_id,
          entity_id: entityId
        },
        attributes: ['id_torneo']
      });

      if (!torneoSeleccionado) {
        req.flash("danger", "No puede consultar grupos de un torneo ajeno");
        return res.redirect('/torneos');
      }

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
