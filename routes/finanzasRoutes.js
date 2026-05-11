const express = require('express');
const router = express.Router();
const finanzasController = require('../controllers/finanzasController');

// Listar registros financieros
router.get('/', finanzasController.listar);

// Crear registro financiero
router.post('/', finanzasController.crear);

// Detalle de un registro financiero
router.get('/:finanza_id', finanzasController.detalle);

// Actualizar registro financiero
router.post('/:finanza_id', finanzasController.actualizar);

module.exports = router;
