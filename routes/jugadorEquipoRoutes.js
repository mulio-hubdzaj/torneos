const express = require('express');
const router = express.Router();
const jugadorEquipoController = require('../controllers/jugadorEquipoController');

function requiereAdmin(req, res, next) {
  if (![3, 99].includes(Number(req.session.rol_id))) {
    req.flash("danger", "No tiene permisos para administrar vinculos jugador-equipo");
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

router.use(requiereAdmin);

// Listar vínculos jugador-equipo
router.get('/', jugadorEquipoController.listar);

// Crear vínculo jugador-equipo
router.post('/', jugadorEquipoController.crear);

// Detalle de un vínculo
router.get('/:id_jugador_equipo', jugadorEquipoController.detalle);

// Actualizar vínculo
router.post('/:id_jugador_equipo', jugadorEquipoController.actualizar);

module.exports = router;
