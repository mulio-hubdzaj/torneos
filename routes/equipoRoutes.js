const express = require('express');
const router = express.Router();
const equipoController = require('../controllers/equipoController');
const multer = require('multer');
const upload = multer({ dest: 'public/uploads/' }); // carpeta donde se guardan los iconos
const { Equipo } = require('../models');

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
router.post('/validarMudanza', equipoController.validarMudanza);
router.post('/crear', equipoController.crear);

// Formulario de edición
router.get('/editar/:id_equipo', equipoController.editarForm);

// Guardar cambios de edición
router.post('/editar/:id_equipo', equipoController.editar);

// Activar/Desactivar equipo (switch)
router.post('/toggle/:id_equipo', equipoController.toggle);

// Eliminar equipo
router.post('/eliminar/:id_equipo', equipoController.eliminar);

// Administrar equipo (engrane)
router.get('/administrar/:id_equipo', equipoController.administrar);

// Ver alineaciones (ojo)
router.get('/ver/:id_equipo', equipoController.ver);

// -----------------------------
// NUEVAS RUTAS DE ADMINISTRACIÓN
// -----------------------------

// Buscar usuarios (para delegados)
router.post('/buscarUsuariosEntidad', equipoController.buscarUsuariosEntidad);

// Buscar jugadores
router.post('/buscarJugadores', equipoController.buscarJugadores);

// Asignar delegados
router.post('/asignarDelegados', equipoController.asignarDelegados);

// Desvincular delegado
router.post('/desvincularDelegado', equipoController.desvincularDelegado);

// Asignar jugadores
router.post('/asignarJugadores', equipoController.asignarJugadores);

// Desvincular jugador
router.post('/desvincularJugador', equipoController.desvincularJugador);

// Actualizar jugadores (camiseta y capitán)
router.post('/actualizarJugadores', equipoController.actualizarJugadores);

// Actualizar icono de un equipo
router.post('/:id_equipo/icono', upload.single('icono'), equipoController.actualizarIcono);

module.exports = router;
