const express = require('express');
const router = express.Router();
const jugadorController = require('../controllers/jugadorController');

function requiereGestionJugadores(req, res, next) {
  if (![2, 3, 99].includes(Number(req.session.rol_id))) {
    req.flash("danger", "No tiene permisos para gestionar jugadores");
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

function requiereAdmin(req, res, next) {
  if (![3, 99].includes(Number(req.session.rol_id))) {
    req.flash("danger", "No tiene permisos para modificar jugadores");
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

// Listar jugadores
router.get('/', jugadorController.listar);

// Mostrar formulario de nuevo jugador
router.get('/nuevo', requiereGestionJugadores, jugadorController.nuevo);

// Crear jugador (guardar en BD)
// Crear jugador (guardar en BD)
router.post('/crear', requiereGestionJugadores, jugadorController.crear);


// Editar jugador (vista del lápiz)
router.get('/editar/:id', requiereAdmin, jugadorController.editar);

// Actualizar jugador
router.post('/editar/:id', requiereAdmin, jugadorController.actualizar);

// Cambiar estado (AJAX desde el switch)
router.post('/:id/estado', requiereAdmin, jugadorController.cambiarEstado);

module.exports = router;
