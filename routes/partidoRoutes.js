const express = require('express');
const router = express.Router();
const partidoController = require('../controllers/partidoController');

function requiereAdmin(req, res, next) {
  if (![3, 99].includes(Number(req.session.rol_id))) {
    if ((req.headers.accept || '').includes('application/json')) {
      return res.status(403).json({ success: false, message: 'No tiene permisos para modificar fixture' });
    }
    req.flash('danger', 'No tiene permisos para modificar fixture');
    return res.redirect(req.get('referer') || '/torneos');
  }
  next();
}

// Listar todos los partidos
router.get('/', partidoController.listar);

// Sortear encuentros de un torneo (por grupos) - NUEVA RUTA CON PARÁMETROS
router.post('/torneos/:id_torneo/grupos/:id_grupo/sortear', requiereAdmin, partidoController.sortearEncuentros);

router.post('/torneos/:id_torneo/sortear-combinado', requiereAdmin, partidoController.sortearEncuentrosCombinados);

// Sortear encuentros de un torneo (por grupos) - RUTA ANTERIOR PARA COMPATIBILIDAD
router.post('/torneos/:id/sortear', requiereAdmin, partidoController.sortearEncuentros);

// Actualizar horario de un partido (ANTES de la ruta GET genérica)
router.post('/:partido_id/horario', requiereAdmin, partidoController.actualizarHorario);

// Intercambiar Equipo A y Equipo B de un encuentro
router.post('/:partido_id/intercambiar', requiereAdmin, partidoController.intercambiarEquipos);

// Actualizar horarios comunes para toda una fecha
router.post('/actualizar-horarios-fecha', requiereAdmin, partidoController.actualizarHorariosFecha);

// Actualizar marcador de un partido
router.post('/:partido_id/marcador', requiereAdmin, partidoController.actualizarMarcador);

// Carga fina de equipo por encuentro: jugadores, items, aporte y saldo
router.get('/:partido_id/equipo/:equipo_id/carga', partidoController.obtenerCargaEquipoPartido);
router.post('/:partido_id/equipo/:equipo_id/carga', requiereAdmin, partidoController.guardarCargaEquipoPartido);
router.get('/libre/torneos/:id_torneo/fecha/:numero_fecha/equipo/:equipo_id/carga', partidoController.obtenerCargaEquipoLibre);
router.post('/libre/torneos/:id_torneo/fecha/:numero_fecha/equipo/:equipo_id/carga', requiereAdmin, partidoController.guardarCargaEquipoLibre);

// Actualizar estado de un partido (programado → suspendido/finalizado)
router.post('/:partido_id/estado', requiereAdmin, partidoController.actualizarEstado);

// Eliminar partido (solo si no está finalizado)
router.post('/torneos/:id_torneo/fecha/:numero_fecha/eliminar', requiereAdmin, partidoController.eliminarFecha);
router.post('/:partido_id/eliminar', requiereAdmin, partidoController.eliminar);

// Crear partido manualmente
router.post('/', requiereAdmin, partidoController.crear);

// Detalle de un partido (AL FINAL - ruta genérica GET)
router.get('/:partido_id', partidoController.detalle);

module.exports = router;
