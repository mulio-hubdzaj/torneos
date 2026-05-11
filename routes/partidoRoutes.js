const express = require('express');
const router = express.Router();
const partidoController = require('../controllers/partidoController');

// Listar todos los partidos
router.get('/', partidoController.listar);

// Sortear encuentros de un torneo (por grupos) - NUEVA RUTA CON PARÁMETROS
router.post('/torneos/:id_torneo/grupos/:id_grupo/sortear', partidoController.sortearEncuentros);

// Sortear encuentros de un torneo (por grupos) - RUTA ANTERIOR PARA COMPATIBILIDAD
router.post('/torneos/:id/sortear', partidoController.sortearEncuentros);

// Actualizar horario de un partido (ANTES de la ruta GET genérica)
router.post('/:partido_id/horario', partidoController.actualizarHorario);

// Intercambiar Equipo A y Equipo B de un encuentro
router.post('/:partido_id/intercambiar', partidoController.intercambiarEquipos);

// Actualizar horarios comunes para toda una fecha
router.post('/actualizar-horarios-fecha', partidoController.actualizarHorariosFecha);

// Actualizar marcador de un partido
router.post('/:partido_id/marcador', partidoController.actualizarMarcador);

// Carga fina de equipo por encuentro: jugadores, items, aporte y saldo
router.get('/:partido_id/equipo/:equipo_id/carga', partidoController.obtenerCargaEquipoPartido);
router.post('/:partido_id/equipo/:equipo_id/carga', partidoController.guardarCargaEquipoPartido);
router.get('/libre/torneos/:id_torneo/fecha/:numero_fecha/equipo/:equipo_id/carga', partidoController.obtenerCargaEquipoLibre);
router.post('/libre/torneos/:id_torneo/fecha/:numero_fecha/equipo/:equipo_id/carga', partidoController.guardarCargaEquipoLibre);

// Actualizar estado de un partido (programado → suspendido/finalizado)
router.post('/:partido_id/estado', partidoController.actualizarEstado);

// Eliminar partido (solo si no está finalizado)
router.post('/torneos/:id_torneo/fecha/:numero_fecha/eliminar', partidoController.eliminarFecha);
router.post('/:partido_id/eliminar', partidoController.eliminar);

// Crear partido manualmente
router.post('/', partidoController.crear);

// Detalle de un partido (AL FINAL - ruta genérica GET)
router.get('/:partido_id', partidoController.detalle);

module.exports = router;
