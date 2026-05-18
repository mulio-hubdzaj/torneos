const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');

function requiereAdmin(req, res, next) {
  if (![3, 99].includes(Number(req.session.rol_id))) {
    req.flash('danger', 'No tiene permisos para administrar items');
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

router.use(requiereAdmin);

router.post('/', itemController.crear);
router.post('/:id_item', itemController.actualizar);
router.post('/:id_item/eliminar', itemController.eliminar);

module.exports = router;
