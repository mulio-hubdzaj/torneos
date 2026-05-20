const express = require('express');
const router = express.Router();
const equipoController = require('../controllers/equipoController');
const multer = require('multer');
const upload = multer({ dest: 'public/uploads/' }); // carpeta donde se guardan los iconos
const { Equipo } = require('../models');

function requiereAdmin(req, res, next) {
  if (![3, 99].includes(Number(req.session.rol_id))) {
    req.flash('danger', 'No tiene permisos para administrar equipos');
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

function requiereGestionJugadores(req, res, next) {
  if (![2, 3, 99].includes(Number(req.session.rol_id))) {
    req.flash('danger', 'No tiene permisos para gestionar jugadores');
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

function requiereGestionIconos(req, res, next) {
  if (![2, 3, 99].includes(Number(req.session.rol_id))) {
    req.flash('danger', 'No tiene permisos para gestionar iconos');
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

// Ruta raíz: listado de equipos
router.get('/', async (req, res) => {
  try {
    const equipos = await Equipo.findAll({
      order: [['nombre', 'ASC']]
    });
    // Renderiza la vista index.ejs dentro de carpeta equipos
    res.render('equipos/administrar', { equipos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al listar equipos');
  }
});

// Gestionar equipos de un torneo
router.get('/gestionar/:id_torneo', equipoController.listar);

// Crear equipo
router.post('/validarMudanza', requiereAdmin, equipoController.validarMudanza);
router.post('/crear', requiereAdmin, equipoController.crear);

// Formulario de edición
router.get('/editar/:id_equipo', requiereAdmin, equipoController.editarForm);

// Guardar cambios de edición
router.post('/editar/:id_equipo', requiereAdmin, equipoController.editar);

// Activar/Desactivar equipo (switch)
router.post('/toggle/:id_equipo', requiereAdmin, equipoController.toggle);

// Eliminar equipo
router.post('/eliminar/:id_equipo', requiereAdmin, equipoController.eliminar);

// Administrar equipo (engrane)
router.get('/administrar/:id_equipo', equipoController.administrar);

// Ver alineaciones (ojo)
router.get('/ver/:id_equipo', equipoController.ver);

// -----------------------------
// NUEVAS RUTAS DE ADMINISTRACIÓN
// -----------------------------

// Buscar usuarios (para delegados)
router.post('/buscarUsuariosEntidad', requiereAdmin, equipoController.buscarUsuariosEntidad);

// Buscar jugadores
router.post('/buscarJugadores', requiereGestionJugadores, equipoController.buscarJugadores);

// Asignar delegados
router.post('/asignarDelegados', requiereAdmin, equipoController.asignarDelegados);

// Desvincular delegado
router.post('/desvincularDelegado', requiereAdmin, equipoController.desvincularDelegado);

// Asignar jugadores
router.post('/asignarJugadores', requiereGestionJugadores, equipoController.asignarJugadores);

// Desvincular jugador
router.post('/desvincularJugador', requiereAdmin, equipoController.desvincularJugador);

// Actualizar jugadores (camiseta y capitán)
router.post('/actualizarJugadores', requiereGestionJugadores, equipoController.actualizarJugadores);

// Actualizar icono de un equipo
router.post('/:id_equipo/icono', requiereGestionIconos, upload.single('icono'), equipoController.actualizarIcono);
router.post('/:id_equipo/icono/eliminar', requiereGestionIconos, equipoController.eliminarIcono);

module.exports = router;
