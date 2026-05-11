const express = require('express');
const router = express.Router();
const jugadorController = require('../controllers/jugadorController');

// Listar jugadores
router.get('/', jugadorController.listar);

// Mostrar formulario de nuevo jugador
router.get('/nuevo', jugadorController.nuevo);

// Crear jugador (guardar en BD)
// Crear jugador (guardar en BD)
router.post('/crear', jugadorController.crear);


// Editar jugador (vista del lápiz)
router.get('/editar/:id', jugadorController.editar);

// Actualizar jugador
router.post('/editar/:id', jugadorController.actualizar);

// Cambiar estado (AJAX desde el switch)
router.post('/:id/estado', jugadorController.cambiarEstado);

module.exports = router;
