const express = require('express');
const router = express.Router();
const jugadorEquipoController = require('../controllers/jugadorEquipoController');

// Listar vínculos jugador-equipo
router.get('/', jugadorEquipoController.listar);

// Crear vínculo jugador-equipo
router.post('/', jugadorEquipoController.crear);

// Detalle de un vínculo
router.get('/:id_jugador_equipo', jugadorEquipoController.detalle);

// Actualizar vínculo
router.post('/:id_jugador_equipo', jugadorEquipoController.actualizar);

module.exports = router;
