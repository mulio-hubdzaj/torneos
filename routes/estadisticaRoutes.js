const express = require('express');
const router = express.Router();
const estadisticaController = require('../controllers/estadisticaController');

// Rutas básicas
router.get('/', estadisticaController.getAll);
router.get('/:id', estadisticaController.getById);

module.exports = router;
