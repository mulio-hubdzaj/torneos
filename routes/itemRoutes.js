const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');

router.post('/', itemController.crear);
router.post('/:id_item', itemController.actualizar);
router.post('/:id_item/eliminar', itemController.eliminar);

module.exports = router;
