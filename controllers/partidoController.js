// partidoController.js

const { Partido, Equipo, Torneo, Cancha, sequelize } = require('../models');
const { registrarAuditoria } = require('../utils/helpers');
const { Op } = require('sequelize');

function normalizarFechaInput(fecha) {
  if (!fecha) return '';
  if (fecha instanceof Date) {
    const year = fecha.getUTCFullYear();
    const month = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const day = String(fecha.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(fecha).slice(0, 10);
}

function formatearFechaVisual(fecha) {
  const fechaInput = normalizarFechaInput(fecha);
  if (!fechaInput) return '-';
  const [anio, mes, dia] = fechaInput.split('-');
  return `${dia}/${mes}/${anio}`;
}

function obtenerEtiquetaFase(tipo, numeroFecha, mitadFechas) {
  if (tipo !== 'ida_vuelta') return '';
  return numeroFecha <= mitadFechas ? 'Ida' : 'Vuelta';
}

function numeroEnteroNoNegativo(valor) {
  const texto = String(valor ?? '0').trim();
  if (!/^(0|[1-9]\d*)$/.test(texto)) return null;
  return Number.parseInt(texto, 10);
}

function numeroDecimalNoNegativo(valor) {
  const texto = String(valor ?? '0').trim().replace(',', '.');
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(texto)) return null;
  return Number.parseFloat(texto);
}

async function calcularSaldoAnteriorFinanzas({ equipoId, torneoId, concepto, numeroFecha, transaction = null }) {
  const movimientosPrevios = await sequelize.query(`
    SELECT COALESCE(f.monto_aportado, 0) AS monto_aportado,
           COALESCE(f.deuda_total, 0) AS deuda_total,
           COALESCE(p.numero_fecha, CAST(NULLIF(SUBSTRING(f.concepto FROM '^Fecha libre #([0-9]+)'), '') AS INTEGER), 999999) AS numero_fecha,
           f.fecha_registro,
           f.id_finanza
    FROM finanzas f
    LEFT JOIN partidos p
      ON p.id_partido = CAST(NULLIF(SUBSTRING(f.concepto FROM '^Encuentro #([0-9]+)'), '') AS INTEGER)
    WHERE f.id_equipo = :equipoId
      AND f.id_torneo = :torneoId
      AND COALESCE(f.concepto, '') <> :concepto
    ORDER BY numero_fecha ASC, f.fecha_registro ASC, f.id_finanza ASC
  `, {
    replacements: { equipoId, torneoId, concepto },
    type: sequelize.QueryTypes.SELECT,
    transaction
  });

  const fechaActual = Number(numeroFecha || 999999);
  return movimientosPrevios.reduce((saldo, movimiento) => {
    const fechaMovimiento = Number(movimiento.numero_fecha || 999999);
    if (fechaMovimiento >= fechaActual) return saldo;
    return saldo + Number(movimiento.deuda_total || 0) - Number(movimiento.monto_aportado || 0);
  }, 0);
}

async function setAuditContext(req, entityId = null, transaction = null) {
  const options = transaction ? { transaction } : {};
  const scope = transaction ? 'SET LOCAL' : 'SET';
  if (req.session.usuario_id) {
    await sequelize.query(`${scope} app.usuario_id = :usuarioId`, {
      replacements: { usuarioId: req.session.usuario_id },
      ...options
    });
  }
  if (entityId || req.session.entity_id) {
    await sequelize.query(`${scope} app.entity_id = :entityId`, {
      replacements: { entityId: entityId || req.session.entity_id },
      ...options
    });
  }
}

function puedeAdministrarEntidad(req, entityId) {
  return Number(req.session.rol_id) === 99 || Number(req.session.entity_id) === Number(entityId);
}

async function validarAdminTorneo(req, torneoId, transaction = null) {
  const torneo = await Torneo.findByPk(torneoId, {
    attributes: ['id_torneo', 'entity_id'],
    transaction
  });
  if (!torneo) return { ok: false, message: 'Torneo no encontrado' };
  if (!puedeAdministrarEntidad(req, torneo.entity_id)) {
    return { ok: false, message: 'No puede modificar fixture de otra entidad' };
  }
  return { ok: true, torneo };
}

function validarAdminPartido(req, partido) {
  if (!partido) return { ok: false, message: 'Partido no encontrado' };
  if (!puedeAdministrarEntidad(req, partido.entity_id)) {
    return { ok: false, message: 'No puede modificar fixture de otra entidad' };
  }
  return { ok: true };
}

async function obtenerReglaTarjetasTorneo(torneoId, transaction = null) {
  const reglaDefault = {
    acumula_amarillas: false,
    amarillas_para_suspension: 5,
    fechas_suspension_acumulacion: 1,
    reiniciar_al_sancionar: true
  };

  try {
    const [regla] = await sequelize.query(`
      SELECT acumula_amarillas,
             amarillas_para_suspension,
             fechas_suspension_acumulacion,
             reiniciar_al_sancionar
      FROM torneos_reglas_tarjetas
      WHERE id_torneo = :torneoId
      LIMIT 1
    `, {
      replacements: { torneoId },
      type: sequelize.QueryTypes.SELECT,
      transaction
    });

    return { ...reglaDefault, ...(regla || {}) };
  } catch (error) {
    if (error?.parent?.code !== '42P01') {
      console.error('Error al consultar regla de tarjetas:', error);
    }
    return reglaDefault;
  }
}

async function obtenerAcumuladosAmarillas({ torneoId, partidoId, jugadorIds, reiniciarAlSancionar }, transaction = null) {
  const ids = jugadorIds.map(id => Number.parseInt(id, 10)).filter(Boolean);
  if (!ids.length) return new Map();

  const registros = await sequelize.query(`
    WITH partido_actual AS (
      SELECT COALESCE(numero_fecha, 0) AS numero_fecha, id_partido
      FROM partidos
      WHERE id_partido = :partidoId
      LIMIT 1
    ),
    ultima_sancion AS (
      SELECT s.id_jugador,
             MAX(COALESCE(ps.numero_fecha, 0) * 100000 + ps.id_partido) AS orden_sancion
      FROM sanciones s
      INNER JOIN partidos ps ON ps.id_partido = s.id_partido
      WHERE ps.id_torneo = :torneoId
        AND s.id_jugador IN (:jugadorIds)
        AND :reiniciarAlSancionar = true
      GROUP BY s.id_jugador
    )
    SELECT est.id_jugador,
           COALESCE(SUM(est.tarjetas_amarillas), 0) AS acumulado
    FROM estadisticas est
    INNER JOIN partidos p ON p.id_partido = est.id_partido
    CROSS JOIN partido_actual pa
    LEFT JOIN ultima_sancion us ON us.id_jugador = est.id_jugador
    WHERE p.id_torneo = :torneoId
      AND est.id_jugador IN (:jugadorIds)
      AND est.id_partido <> :partidoId
      AND (COALESCE(p.numero_fecha, 0) * 100000 + p.id_partido) < (pa.numero_fecha * 100000 + pa.id_partido)
      AND (
        :reiniciarAlSancionar = false
        OR us.orden_sancion IS NULL
        OR (COALESCE(p.numero_fecha, 0) * 100000 + p.id_partido) > us.orden_sancion
      )
    GROUP BY est.id_jugador
  `, {
    replacements: {
      torneoId,
      partidoId,
      jugadorIds: ids,
      reiniciarAlSancionar: Boolean(reiniciarAlSancionar)
    },
    type: sequelize.QueryTypes.SELECT,
    transaction
  });

  return new Map(registros.map(registro => [
    Number(registro.id_jugador),
    Number(registro.acumulado || 0)
  ]));
}

// Listar partidos
exports.listar = async (req, res) => {
  try {
    const partidos = await Partido.findAll({
      include: [Equipo, Torneo],
      order: [['numero_fecha', 'ASC'], ['fecha', 'ASC']]
    });
    res.render('partidos', { partidos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener partidos');
  }
};

// Crear partido manualmente
exports.crear = async (req, res) => {
  try {
    const { id_torneo, equipo_a, equipo_b, numero_fecha, id_grupo } = req.body;
    const crearIdaVuelta = req.body.ida_vuelta_manual === '1';
    const redirectUrl = req.body.redirect_url || `/torneos/gestionar/${id_torneo}#partidos`;
    
    if (!id_torneo || !equipo_a || !equipo_b || !id_grupo) {
      req.flash("danger", "Faltan parámetros requeridos");
      return res.redirect(redirectUrl);
    }

    if (String(equipo_a) === String(equipo_b)) {
      req.flash("danger", "El cruce manual requiere dos equipos distintos");
      return res.redirect(redirectUrl);
    }

    const equiposValidados = await Equipo.findAll({
      where: {
        id_torneo,
        id_grupo,
        id_equipo: { [Op.in]: [equipo_a, equipo_b] }
      },
      attributes: ['id_equipo']
    });

    if (equiposValidados.length !== 2) {
      req.flash("danger", "Solo se pueden crear cruces entre equipos del mismo grupo");
      return res.redirect(redirectUrl);
    }

    const permisoTorneo = await validarAdminTorneo(req, id_torneo);
    if (!permisoTorneo.ok) {
      req.flash("danger", permisoTorneo.message);
      return res.redirect(redirectUrl);
    }
    const partidoEntityId = permisoTorneo.torneo.entity_id;

    const numeroFechaIda = Number.parseInt(numero_fecha || 1, 10) || 1;

    await setAuditContext(req, partidoEntityId);

    await Partido.create({
      id_torneo,
      equipo_a,
      equipo_b,
      numero_fecha: numeroFechaIda,
      estado: 'programado',
      id_grupo,
      entity_id: partidoEntityId || null,
      observaciones: crearIdaVuelta ? 'Ida' : null
    });

    if (crearIdaVuelta) {
      await Partido.create({
        id_torneo,
        equipo_a: equipo_b,
        equipo_b: equipo_a,
        numero_fecha: numeroFechaIda + 1,
        estado: 'programado',
        id_grupo,
        entity_id: partidoEntityId || null,
        observaciones: 'Vuelta'
      });
    }

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "CREATE", { id_torneo, equipo_a, equipo_b });

    req.flash("success", crearIdaVuelta ? "Cruce de ida y vuelta creado correctamente" : "Partido creado correctamente");
    res.redirect(redirectUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear partido');
  }
};

// Detalle de un partido
exports.detalle = async (req, res) => {
  try {
    const partido = await Partido.findByPk(req.params.partido_id, {
      include: [
        {
          model: Equipo,
          as: 'EquipoA',
          attributes: ['id_equipo', 'nombre_equipo']
        },
        {
          model: Equipo,
          as: 'EquipoB',
          attributes: ['id_equipo', 'nombre_equipo']
        },
        {
          model: Torneo,
          attributes: ['id_torneo', 'nombre_torneo']
        }
      ]
    });

    if (!partido) {
      req.flash("danger", "Partido no encontrado");
      return res.redirect('/partidos');
    }

    res.render('partidos/detalle', { partido });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener detalle del partido');
  }
};

// Actualizar horario de un partido
exports.actualizarHorario = async (req, res) => {
  try {
    const partidoId = req.params.partido_id;
    const { fecha, hora, torneo_id, id_cancha } = req.body;
    const canchaId = id_cancha ? Number.parseInt(id_cancha, 10) : null;
    const partido = await Partido.findByPk(partidoId);
    const torneoRedirect = partido?.id_torneo || torneo_id;

    if (!partido) {
      req.flash('danger', 'Partido no encontrado');
      return res.redirect(`/torneos/gestionar/${torneoRedirect}#partidos`);
    }

    const permisoPartido = validarAdminPartido(req, partido);
    if (!permisoPartido.ok) {
      req.flash('danger', permisoPartido.message);
      return res.redirect('/torneos');
    }

    if (canchaId) {
      const canchaValida = await Cancha.findOne({
        where: {
          id_cancha: canchaId,
          id_torneo: partido.id_torneo,
          estado: true
        }
      });

      if (!canchaValida) {
        req.flash('danger', 'La cancha seleccionada no pertenece a este torneo o esta inactiva');
        return res.redirect(`/torneos/gestionar/${torneoRedirect}#partidos`);
      }
    }

    await setAuditContext(req, partido.entity_id);

    await Partido.update(
      {
        fecha: fecha || null,
        hora: hora || null,
        id_cancha: canchaId || null
      },
      { where: { id_partido: partidoId } }
    );

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "UPDATE", {
      id_partido: partidoId,
      fecha,
      hora,
      id_cancha: canchaId || null
    });

    req.flash('success', 'Horario actualizado correctamente');
    return res.redirect(`/torneos/gestionar/${torneoRedirect}#partidos`);
  } catch (error) {
    console.error('Error al actualizar horario:', error);
    req.flash('danger', 'Error al actualizar el horario del partido');
    return res.redirect(`/torneos/gestionar/${req.body.torneo_id || ''}#partidos`);
  }
};

exports.intercambiarEquipos = async (req, res) => {
  const partidoId = req.params.partido_id;
  const redirectUrlBody = req.body.redirect_url;

  try {
    const partido = await Partido.findByPk(partidoId);

    if (!partido) {
      req.flash("danger", "Partido no encontrado");
      return res.redirect(redirectUrlBody || (req.session.torneo_id ? `/torneos/gestionar/${req.session.torneo_id}#partidos` : '/partidos#partidos'));
    }

    const redirectUrl = redirectUrlBody || `/torneos/gestionar/${partido.id_torneo}#partidos`;

    const permisoPartido = validarAdminPartido(req, partido);
    if (!permisoPartido.ok) {
      req.flash("danger", permisoPartido.message);
      return res.redirect('/torneos');
    }

    if (partido.estado === 'finalizado') {
      req.flash("danger", "No se puede intercambiar equipos en un partido finalizado");
      return res.redirect(redirectUrl);
    }

    const equipoAOriginal = partido.equipo_a;
    const equipoBOriginal = partido.equipo_b;
    const golesAOriginal = partido.goles_a;
    const golesBOriginal = partido.goles_b;

    partido.equipo_a = equipoBOriginal;
    partido.equipo_b = equipoAOriginal;
    partido.goles_a = golesBOriginal;
    partido.goles_b = golesAOriginal;
    await setAuditContext(req, partido.entity_id);
    await partido.save();

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "SWAP_TEAMS", {
      id_partido: partidoId,
      equipo_a_anterior: equipoAOriginal,
      equipo_b_anterior: equipoBOriginal,
      equipo_a_nuevo: partido.equipo_a,
      equipo_b_nuevo: partido.equipo_b
    });

    req.flash("success", "Orden de equipos intercambiado correctamente");
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error al intercambiar equipos:', error);
    req.flash("danger", "Error al intercambiar los equipos del encuentro");
    return res.redirect(redirectUrlBody || '/partidos#partidos');
  }
};

// Actualizar horarios comunes para toda una fecha
exports.actualizarHorariosFecha = async (req, res) => {
  try {
    const { numero_fecha, torneo_id, grupo_id, fecha_comun, hora_inicial, intervalo_minutos } = req.body;

    // Validar parámetros
    if (!numero_fecha || !torneo_id || !fecha_comun || !hora_inicial || !intervalo_minutos) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos' });
    }

    const where = {
      id_torneo: torneo_id,
      numero_fecha: numero_fecha
    };
    const grupoId = Number.parseInt(grupo_id || '', 10);
    if (Number.isInteger(grupoId) && grupoId > 0) {
      where.id_grupo = grupoId;
    }

    // Obtener todos los partidos de esa fecha, respetando el filtro por grupo cuando exista.
    const partidos = await Partido.findAll({
      where,
      order: [['id_partido', 'ASC']] // Orden consistente
    });

    if (partidos.length === 0) {
      return res.status(404).json({ success: false, message: 'No se encontraron encuentros para esta fecha y grupo' });
    }

    if (!puedeAdministrarEntidad(req, partidos[0].entity_id)) {
      return res.status(403).json({ success: false, message: 'No puede modificar fixture de otra entidad' });
    }

    await setAuditContext(req, partidos[0].entity_id);

    // Calcular horarios espaciados
    const horaBase = new Date(`2000-01-01T${hora_inicial}:00`);
    const intervaloMs = intervalo_minutos * 60 * 1000; // Convertir minutos a milisegundos

    // Actualizar cada partido con fecha común y hora espaciada
    for (let i = 0; i < partidos.length; i++) {
      const horaPartido = new Date(horaBase.getTime() + (i * intervaloMs));
      const horaFormateada = horaPartido.toTimeString().substring(0, 5); // HH:MM

      await Partido.update(
        {
          fecha: fecha_comun,
          hora: horaFormateada
        },
        { where: { id_partido: partidos[i].id_partido } }
      );
    }

    // Registrar auditoría
    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "UPDATE_BULK", {
      numero_fecha,
      torneo_id,
      grupo_id: Number.isInteger(grupoId) && grupoId > 0 ? grupoId : null,
      fecha_comun,
      hora_inicial,
      intervalo_minutos,
      partidos_actualizados: partidos.length
    });

    return res.json({
      success: true,
      message: `Horarios actualizados correctamente para ${partidos.length} encuentros`
    });

  } catch (error) {
    console.error('Error al actualizar horarios de fecha:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};


// Actualizar marcador de un partido
exports.actualizarMarcador = async (req, res) => {
  try {
    const { partido_id, goles_a, goles_b, estado } = req.body;

    if (!partido_id || goles_a === undefined || goles_b === undefined) {
      return res.status(400).json({ success: false, message: 'Parámetros incompletos' });
    }

    const marcadorRegex = /^(0|[1-9]\d*)$/;
    const golesAString = String(goles_a).trim();
    const golesBString = String(goles_b).trim();

    if (!marcadorRegex.test(golesAString) || !marcadorRegex.test(golesBString)) {
      return res.status(400).json({
        success: false,
        message: 'El marcador debe ser un numero entero sin negativos ni ceros a la izquierda'
      });
    }

    const golesAInt = Number.parseInt(golesAString, 10);
    const golesBInt = Number.parseInt(golesBString, 10);

    if (golesAInt > 99 || golesBInt > 99) {
      return res.status(400).json({
        success: false,
        message: 'El marcador no puede ser mayor a 99'
      });
    }

    const updateData = {
      goles_a: golesAInt,
      goles_b: golesBInt
    };

    if (typeof estado !== 'undefined') {
      const estadoNormalizado = String(estado).trim().toLowerCase().replace(/[\s-]+/g, '_');
      const estadosPermitidos = ['programado', 'en_curso', 'suspendido', 'finalizado'];
      if (!estadosPermitidos.includes(estadoNormalizado)) {
        return res.status(400).json({ success: false, message: 'Estado de partido no valido' });
      }
      updateData.estado = estadoNormalizado;
    }

    const partido = await Partido.findByPk(partido_id, { attributes: ['id_partido', 'entity_id'] });
    if (!partido) {
      return res.status(404).json({ success: false, message: 'Partido no encontrado' });
    }

    const permisoPartido = validarAdminPartido(req, partido);
    if (!permisoPartido.ok) {
      return res.status(403).json({ success: false, message: permisoPartido.message });
    }

    await setAuditContext(req, partido.entity_id);

    await Partido.update(updateData, { where: { id_partido: partido_id } });

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "UPDATE", {
      id_partido: partido_id,
      goles_a,
      goles_b,
      estado: updateData.estado
    });

    return res.json({ success: true, message: 'Marcador actualizado' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar' });
  }
};

exports.obtenerCargaEquipoPartido = async (req, res) => {
  try {
    const partidoId = Number.parseInt(req.params.partido_id, 10);
    const equipoId = Number.parseInt(req.params.equipo_id, 10);

    if (!partidoId || !equipoId) {
      return res.status(400).json({ success: false, message: 'Parametros invalidos' });
    }

    const [partido] = await sequelize.query(`
      SELECT p.id_partido, p.id_torneo, p.entity_id, p.numero_fecha, p.fecha,
             ea.id_equipo AS id_equipo_a, ea.nombre AS equipo_a,
             eb.id_equipo AS id_equipo_b, eb.nombre AS equipo_b
      FROM partidos p
      LEFT JOIN equipos ea ON ea.id_equipo = p.equipo_a
      LEFT JOIN equipos eb ON eb.id_equipo = p.equipo_b
      WHERE p.id_partido = :partidoId
        AND (:equipoId IN (p.equipo_a, p.equipo_b))
      LIMIT 1
    `, {
      replacements: { partidoId, equipoId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!partido) {
      return res.status(404).json({ success: false, message: 'Partido o equipo no encontrado' });
    }

    const entityId = req.session.entity_id || partido.entity_id;
    const nombreEquipo = partido.id_equipo_a === equipoId ? partido.equipo_a : partido.equipo_b;
    const nombreRival = partido.id_equipo_a === equipoId ? partido.equipo_b : partido.equipo_a;
    const conceptoFinanza = `Encuentro #${partidoId} - ${nombreEquipo}`;

    const jugadores = await sequelize.query(`
      SELECT j.id_jugador, j.nombre, j.apellido, j.documento, je.numero_camiseta,
             COALESCE(je.estado, true) AS estado_vinculo,
             COALESCE(je.observaciones, '') AS observacion_vinculo,
             COALESCE(est.goles, 0) AS goles,
             COALESCE(est.tarjetas_amarillas, 0) AS tarjetas_amarillas,
             COALESCE(est.tarjetas_rojas, 0) AS tarjetas_rojas,
             COALESCE(s_partido.partidos_suspendidos, 0) AS partidos_suspendidos,
             COALESCE(s_partido.observaciones, '') AS suspension_observaciones,
             COALESCE(s_vigente.partidos_restantes, 0) AS suspension_partidos_restantes,
             COALESCE(s_vigente.observaciones, '') AS suspension_vigente_observaciones,
             CASE WHEN s_vigente.id_sancion IS NULL THEN false ELSE true END AS sancion_vigente
      FROM jugadores_equipos je
      INNER JOIN jugadores j ON j.id_jugador = je.id_jugador
      LEFT JOIN estadisticas est ON est.id_jugador = j.id_jugador AND est.id_partido = :partidoId
      LEFT JOIN sanciones s_partido ON s_partido.id_jugador = j.id_jugador AND s_partido.id_partido = :partidoId
      LEFT JOIN LATERAL (
        SELECT s.id_sancion, s.partidos_restantes, s.observaciones
        FROM sanciones s
        INNER JOIN partidos ps ON ps.id_partido = s.id_partido
        WHERE s.id_jugador = j.id_jugador
          AND ps.id_torneo = :torneoId
          AND COALESCE(s.partidos_restantes, 0) > 0
          AND s.fecha_inicio < COALESCE(:numeroFecha, 0)
          AND (s.fecha_inicio + COALESCE(s.partidos_restantes, 0)) >= COALESCE(:numeroFecha, 0)
        ORDER BY s.fecha_registro DESC, s.id_sancion DESC
        LIMIT 1
      ) s_vigente ON true
      WHERE je.id_equipo = :equipoId
        AND je.id_torneo = :torneoId
        AND (
          COALESCE(je.estado, true) = true
          OR est.id_estadistica IS NOT NULL
          OR s_partido.id_sancion IS NOT NULL
        )
      ORDER BY COALESCE(je.numero_camiseta, 999), j.nombre, j.apellido
    `, {
      replacements: {
        partidoId,
        equipoId,
        torneoId: partido.id_torneo,
        numeroFecha: partido.numero_fecha
      },
      type: sequelize.QueryTypes.SELECT
    });

    const reglaTarjetas = await obtenerReglaTarjetasTorneo(partido.id_torneo);
    const acumuladosAmarillas = await obtenerAcumuladosAmarillas({
      torneoId: partido.id_torneo,
      partidoId,
      jugadorIds: jugadores.map(jugador => jugador.id_jugador),
      reiniciarAlSancionar: reglaTarjetas.reiniciar_al_sancionar
    });

    jugadores.forEach(jugador => {
      const acumuladoPrevio = acumuladosAmarillas.get(Number(jugador.id_jugador)) || 0;
      jugador.amarillas_acumuladas_previas = acumuladoPrevio;
      jugador.amarillas_acumuladas_total = acumuladoPrevio + Number(jugador.tarjetas_amarillas || 0);
      jugador.amarillas_para_suspension = Number(reglaTarjetas.amarillas_para_suspension || 0);
    });

    const items = await sequelize.query(`
      SELECT id_item, nombre, monto
      FROM items
      WHERE entity_id = :entityId
        AND id_torneo = :torneoId
      ORDER BY nombre ASC
    `, {
      replacements: { entityId, torneoId: partido.id_torneo },
      type: sequelize.QueryTypes.SELECT
    });

    const itemsCargados = await sequelize.query(`
      SELECT id_item_equipo,
             nombre,
             monto,
             cantidad,
             observaciones,
             TO_CHAR(fecha_registro, 'DD/MM/YYYY HH24:MI') AS fecha_registro_fmt
      FROM items_equipo
      WHERE id_equipo = :equipoId
        AND id_partido = :partidoId
        AND COALESCE(TRIM(nombre), '') <> ''
      ORDER BY id_item_equipo ASC
    `, {
      replacements: { equipoId, partidoId },
      type: sequelize.QueryTypes.SELECT
    });

    const deudaAnterior = await calcularSaldoAnteriorFinanzas({
      equipoId,
      torneoId: partido.id_torneo,
      concepto: conceptoFinanza,
      numeroFecha: partido.numero_fecha
    });
    const [resumenFinanzas] = await sequelize.query(`
      SELECT COALESCE((
               SELECT f.monto_aportado
               FROM finanzas f
               WHERE f.id_equipo = :equipoId
                 AND f.id_torneo = :torneoId
                 AND f.concepto = :concepto
               ORDER BY f.fecha_registro DESC, f.id_finanza DESC
               LIMIT 1
             ), 0) AS monto_aportado
    `, {
      replacements: { equipoId, torneoId: partido.id_torneo, concepto: conceptoFinanza },
      type: sequelize.QueryTypes.SELECT
    });

    return res.json({
      success: true,
      partido: {
        id_partido: partido.id_partido,
        id_torneo: partido.id_torneo,
        numero_fecha: partido.numero_fecha,
        fecha: formatearFechaVisual(partido.fecha)
      },
      equipo: { id_equipo: equipoId, nombre: nombreEquipo, rival: nombreRival || '' },
      jugadores,
      items,
      itemsCargados,
      reglaTarjetas,
      deudaAnterior,
      montoAportado: Number(resumenFinanzas?.monto_aportado || 0)
    });
  } catch (error) {
    console.error('Error al obtener carga del partido:', error);
    return res.status(500).json({ success: false, message: 'Error al preparar la carga del equipo' });
  }
};

exports.guardarCargaEquipoPartido = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const partidoId = Number.parseInt(req.params.partido_id, 10);
    const equipoId = Number.parseInt(req.params.equipo_id, 10);
    const jugadores = Array.isArray(req.body.jugadores) ? req.body.jugadores : [];
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const montoAportado = numeroDecimalNoNegativo(req.body.monto_aportado);
    const jugadoresSancionados = [];

    if (!partidoId || !equipoId || montoAportado === null) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Datos invalidos para guardar' });
    }

    const [partido] = await sequelize.query(`
      SELECT p.id_partido, p.id_torneo, p.entity_id, p.numero_fecha,
             CASE WHEN p.equipo_a = :equipoId THEN ea.nombre ELSE eb.nombre END AS nombre_equipo
      FROM partidos p
      LEFT JOIN equipos ea ON ea.id_equipo = p.equipo_a
      LEFT JOIN equipos eb ON eb.id_equipo = p.equipo_b
      WHERE p.id_partido = :partidoId
        AND (:equipoId IN (p.equipo_a, p.equipo_b))
      LIMIT 1
    `, {
      replacements: { partidoId, equipoId },
      type: sequelize.QueryTypes.SELECT,
      transaction
    });

    if (!partido) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Partido o equipo no encontrado' });
    }

    if (!puedeAdministrarEntidad(req, partido.entity_id)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'No puede cargar encuentros de otra entidad' });
    }

    const entityId = req.session.entity_id || partido.entity_id;
    const conceptoFinanza = `Encuentro #${partidoId} - ${partido.nombre_equipo}`;
    await setAuditContext(req, entityId, transaction);

    const jugadoresEquipo = await sequelize.query(`
      SELECT id_jugador
      FROM jugadores_equipos
      WHERE id_equipo = :equipoId
        AND id_torneo = :torneoId
    `, {
      replacements: { equipoId, torneoId: partido.id_torneo },
      type: sequelize.QueryTypes.SELECT,
      transaction
    });
    const jugadoresPermitidos = new Set(jugadoresEquipo.map(j => Number(j.id_jugador)));
    const reglaTarjetas = await obtenerReglaTarjetasTorneo(partido.id_torneo, transaction);
    const acumuladosAmarillas = await obtenerAcumuladosAmarillas({
      torneoId: partido.id_torneo,
      partidoId,
      jugadorIds: jugadoresEquipo.map(jugador => jugador.id_jugador),
      reiniciarAlSancionar: reglaTarjetas.reiniciar_al_sancionar
    }, transaction);

    await sequelize.query(`
      DELETE FROM estadisticas
      WHERE id_partido = :partidoId
        AND id_jugador IN (
          SELECT id_jugador FROM jugadores_equipos
          WHERE id_equipo = :equipoId AND id_torneo = :torneoId
        )
    `, {
      replacements: { partidoId, equipoId, torneoId: partido.id_torneo },
      transaction
    });

    await sequelize.query(`
      DELETE FROM sanciones
      WHERE id_partido = :partidoId
        AND id_jugador IN (
          SELECT id_jugador FROM jugadores_equipos
          WHERE id_equipo = :equipoId AND id_torneo = :torneoId
        )
    `, {
      replacements: { partidoId, equipoId, torneoId: partido.id_torneo },
      transaction
    });

    for (const jugador of jugadores) {
      const jugadorId = Number.parseInt(jugador.id_jugador, 10);
      if (!jugadoresPermitidos.has(jugadorId)) continue;

      const goles = numeroEnteroNoNegativo(jugador.goles);
      const amarillas = numeroEnteroNoNegativo(jugador.tarjetas_amarillas);
      const rojas = numeroEnteroNoNegativo(jugador.tarjetas_rojas);
      let suspendidos = numeroEnteroNoNegativo(jugador.partidos_suspendidos);

      if ([goles, amarillas, rojas, suspendidos].some(valor => valor === null)) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Las estadisticas de jugadores deben ser numeros enteros positivos' });
      }

      if (goles > 0 || amarillas > 0 || rojas > 0) {
        await sequelize.query(`
          INSERT INTO estadisticas (id_jugador, id_partido, goles, tarjetas_amarillas, tarjetas_rojas, entity_id)
          VALUES (:jugadorId, :partidoId, :goles, :amarillas, :rojas, :entityId)
        `, {
          replacements: { jugadorId, partidoId, goles, amarillas, rojas, entityId },
          transaction
        });
      }

      const acumuladoPrevio = acumuladosAmarillas.get(jugadorId) || 0;
      const totalAmarillas = acumuladoPrevio + amarillas;
      const limiteAmarillas = Number(reglaTarjetas.amarillas_para_suspension || 0);
      const aplicaSancionPorAcumulacion = Boolean(reglaTarjetas.acumula_amarillas)
        && limiteAmarillas > 0
        && amarillas > 0
        && acumuladoPrevio < limiteAmarillas
        && totalAmarillas >= limiteAmarillas;
      const accionAcumulacion = String(jugador.accion_acumulacion || '').trim().toLowerCase();
      const confirmarSuspensionAcumulacion = aplicaSancionPorAcumulacion && accionAcumulacion === 'suspension';
      const registrarAdvertenciaAcumulacion = aplicaSancionPorAcumulacion && accionAcumulacion === 'advertencia';

      if (confirmarSuspensionAcumulacion && suspendidos <= 0) {
        suspendidos = Number(reglaTarjetas.fechas_suspension_acumulacion || 1);
      }

      if (suspendidos > 0 || registrarAdvertenciaAcumulacion) {
        const observacionManual = String(jugador.suspension_observaciones || '').trim();
        const observacionAcumulacion = aplicaSancionPorAcumulacion
          ? (registrarAdvertenciaAcumulacion
              ? `Advertencia por acumulacion de amarillas (${totalAmarillas}/${limiteAmarillas}). Reinicia conteo.`
              : `Suspension por acumulacion de amarillas (${totalAmarillas}/${limiteAmarillas})`)
          : '';
        const observaciones = [
          observacionManual && !/suspension por acumulacion/i.test(observacionManual) ? observacionManual : '',
          observacionAcumulacion
        ].filter(Boolean).join(' - ');
        const fechaInicioSancion = Number.parseInt(partido.numero_fecha || 0, 10) || null;
        const partidosSancion = registrarAdvertenciaAcumulacion ? 0 : suspendidos;

        await sequelize.query(`
          INSERT INTO sanciones (id_jugador, id_partido, partidos_suspendidos, partidos_restantes, fecha_inicio, observaciones)
          VALUES (:jugadorId, :partidoId, :suspendidos, :suspendidos, :fechaInicioSancion, :observaciones)
        `, {
          replacements: {
            jugadorId,
            partidoId,
            suspendidos: partidosSancion,
            fechaInicioSancion,
            observaciones
          },
          transaction
        });

        if (registrarAdvertenciaAcumulacion) {
          continue;
        }

        const observacionVinculo = observaciones || `Suspendido por ${suspendidos} fecha(s) desde la fecha ${fechaInicioSancion || '-'}`;
        await sequelize.query(`
          UPDATE jugadores_equipos
          SET estado = false,
              observaciones = :observaciones
          WHERE id_jugador = :jugadorId
            AND id_equipo = :equipoId
            AND id_torneo = :torneoId
        `, {
          replacements: {
            jugadorId,
            equipoId,
            torneoId: partido.id_torneo,
            observaciones: observacionVinculo
          },
          transaction
        });

        jugadoresSancionados.push({
          id_jugador: jugadorId,
          id_equipo: equipoId,
          id_torneo: partido.id_torneo,
          estado_vinculo: false,
          observaciones: observacionVinculo
        });
      }
    }

    await sequelize.query(`
      DELETE FROM items_equipo
      WHERE id_equipo = :equipoId
        AND id_partido = :partidoId
    `, {
      replacements: { equipoId, partidoId },
      transaction
    });

    let totalItems = 0;
    for (const item of items) {
      const cantidad = numeroEnteroNoNegativo(item.cantidad);
      const monto = numeroDecimalNoNegativo(item.monto);
      const nombre = String(item.nombre || '').trim();
      const observaciones = String(item.observaciones || '').trim();

      if (!nombre && (!cantidad || cantidad === 0)) continue;
      if (!nombre || cantidad === null || monto === null || cantidad <= 0) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Los items deben tener nombre, monto y cantidad validos' });
      }

      totalItems += monto * cantidad;

      await sequelize.query(`
        INSERT INTO items_equipo (id_equipo, id_partido, nombre, monto, cantidad, observaciones)
        VALUES (:equipoId, :partidoId, :nombre, :monto, :cantidad, :observaciones)
      `, {
        replacements: { equipoId, partidoId, nombre, monto, cantidad, observaciones },
        transaction
      });
    }

    const deudaAnterior = await calcularSaldoAnteriorFinanzas({
      equipoId,
      torneoId: partido.id_torneo,
      concepto: conceptoFinanza,
      numeroFecha: partido.numero_fecha,
      transaction
    });

    const saldo = deudaAnterior + totalItems - montoAportado;

    await sequelize.query(`
      DELETE FROM finanzas
      WHERE id_equipo = :equipoId
        AND id_torneo = :torneoId
        AND concepto = :concepto
    `, {
      replacements: { equipoId, torneoId: partido.id_torneo, concepto: conceptoFinanza },
      transaction
    });

    await sequelize.query(`
      INSERT INTO finanzas (
        id_equipo, monto_inscripcion, monto_aportado, deuda_total, entity_id,
        id_torneo, fecha_registro, concepto, tipo, saldo, deuda_inicial
      )
      VALUES (
        :equipoId, 0, :montoAportado, :totalItems, :entityId,
        :torneoId, CURRENT_DATE, :concepto, 'partido', :saldo, :deudaAnterior
      )
    `, {
      replacements: {
        equipoId,
        montoAportado,
        totalItems,
        entityId,
        torneoId: partido.id_torneo,
        concepto: conceptoFinanza,
        saldo,
        deudaAnterior
      },
      transaction
    });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Carga del encuentro guardada',
      resumen: { deudaAnterior, totalItems, montoAportado, saldo },
      jugadoresSancionados
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al guardar carga del partido:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar la carga del encuentro' });
  }
};

exports.obtenerCargaEquipoLibre = async (req, res) => {
  try {
    const torneoId = Number.parseInt(req.params.id_torneo, 10);
    const numeroFecha = Number.parseInt(req.params.numero_fecha, 10);
    const equipoId = Number.parseInt(req.params.equipo_id, 10);

    if (!torneoId || !numeroFecha || !equipoId) {
      return res.status(400).json({ success: false, message: 'Parametros invalidos' });
    }

    const [equipo] = await sequelize.query(`
      SELECT e.id_equipo, e.nombre, e.entity_id, t.id_torneo
      FROM equipos e
      INNER JOIN torneos t ON t.id_torneo = e.id_torneo
      WHERE e.id_equipo = :equipoId
        AND e.id_torneo = :torneoId
      LIMIT 1
    `, {
      replacements: { equipoId, torneoId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!equipo) {
      return res.status(404).json({ success: false, message: 'Equipo no encontrado para esta fecha libre' });
    }

    const entityId = req.session.entity_id || equipo.entity_id;
    const conceptoFinanza = `Fecha libre #${numeroFecha} - ${equipo.nombre}`;
    const marcaLibre = `[fecha_libre:${torneoId}:${numeroFecha}]`;

    const items = await sequelize.query(`
      SELECT id_item, nombre, monto
      FROM items
      WHERE entity_id = :entityId
        AND id_torneo = :torneoId
      ORDER BY nombre ASC
    `, {
      replacements: { entityId, torneoId },
      type: sequelize.QueryTypes.SELECT
    });

    const itemsCargados = await sequelize.query(`
      SELECT id_item_equipo,
             nombre,
             monto,
             cantidad,
             trim(replace(COALESCE(observaciones, ''), :marcaLibre, '')) AS observaciones,
             TO_CHAR(fecha_registro, 'DD/MM/YYYY HH24:MI') AS fecha_registro_fmt
      FROM items_equipo
      WHERE id_equipo = :equipoId
        AND id_partido IS NULL
        AND COALESCE(observaciones, '') LIKE :marcaLike
        AND COALESCE(TRIM(nombre), '') <> ''
      ORDER BY id_item_equipo ASC
    `, {
      replacements: { equipoId, marcaLibre, marcaLike: `${marcaLibre}%` },
      type: sequelize.QueryTypes.SELECT
    });

    const deudaAnterior = await calcularSaldoAnteriorFinanzas({
      equipoId,
      torneoId,
      concepto: conceptoFinanza,
      numeroFecha
    });
    const [resumenFinanzas] = await sequelize.query(`
      SELECT COALESCE((
               SELECT f.monto_aportado
               FROM finanzas f
               WHERE f.id_equipo = :equipoId
                 AND f.id_torneo = :torneoId
                 AND f.concepto = :concepto
               ORDER BY f.fecha_registro DESC, f.id_finanza DESC
               LIMIT 1
             ), 0) AS monto_aportado
    `, {
      replacements: { equipoId, torneoId, concepto: conceptoFinanza },
      type: sequelize.QueryTypes.SELECT
    });

    return res.json({
      success: true,
      libre: true,
      partido: {
        id_partido: null,
        id_torneo: torneoId,
        numero_fecha: numeroFecha,
        fecha: 'Libre'
      },
      equipo: { id_equipo: equipoId, nombre: equipo.nombre },
      jugadores: [],
      items,
      itemsCargados,
      deudaAnterior,
      montoAportado: Number(resumenFinanzas?.monto_aportado || 0)
    });
  } catch (error) {
    console.error('Error al obtener carga de fecha libre:', error);
    return res.status(500).json({ success: false, message: 'Error al preparar la carga de fecha libre' });
  }
};

exports.guardarCargaEquipoLibre = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const torneoId = Number.parseInt(req.params.id_torneo, 10);
    const numeroFecha = Number.parseInt(req.params.numero_fecha, 10);
    const equipoId = Number.parseInt(req.params.equipo_id, 10);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const montoAportado = numeroDecimalNoNegativo(req.body.monto_aportado);

    if (!torneoId || !numeroFecha || !equipoId || montoAportado === null) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Datos invalidos para guardar fecha libre' });
    }

    const [equipo] = await sequelize.query(`
      SELECT id_equipo, nombre, entity_id
      FROM equipos
      WHERE id_equipo = :equipoId
        AND id_torneo = :torneoId
      LIMIT 1
    `, {
      replacements: { equipoId, torneoId },
      type: sequelize.QueryTypes.SELECT,
      transaction
    });

    if (!equipo) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Equipo no encontrado para esta fecha libre' });
    }

    if (!puedeAdministrarEntidad(req, equipo.entity_id)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'No puede cargar fechas libres de otra entidad' });
    }

    const entityId = req.session.entity_id || equipo.entity_id;
    const conceptoFinanza = `Fecha libre #${numeroFecha} - ${equipo.nombre}`;
    const marcaLibre = `[fecha_libre:${torneoId}:${numeroFecha}]`;
    await setAuditContext(req, entityId, transaction);

    await sequelize.query(`
      DELETE FROM items_equipo
      WHERE id_equipo = :equipoId
        AND id_partido IS NULL
        AND COALESCE(observaciones, '') LIKE :marcaLike
    `, {
      replacements: { equipoId, marcaLike: `${marcaLibre}%` },
      transaction
    });

    let totalItems = 0;
    for (const item of items) {
      const cantidad = numeroEnteroNoNegativo(item.cantidad);
      const monto = numeroDecimalNoNegativo(item.monto);
      const nombre = String(item.nombre || '').trim();
      const observaciones = String(item.observaciones || '').trim();

      if (!nombre && (!cantidad || cantidad === 0)) continue;
      if (!nombre || cantidad === null || monto === null || cantidad <= 0) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Los items deben tener nombre, monto y cantidad validos' });
      }

      totalItems += monto * cantidad;

      await sequelize.query(`
        INSERT INTO items_equipo (id_equipo, id_partido, nombre, monto, cantidad, observaciones)
        VALUES (:equipoId, NULL, :nombre, :monto, :cantidad, :observaciones)
      `, {
        replacements: {
          equipoId,
          nombre,
          monto,
          cantidad,
          observaciones: `${marcaLibre} ${observaciones}`.trim()
        },
        transaction
      });
    }

    const deudaAnterior = await calcularSaldoAnteriorFinanzas({
      equipoId,
      torneoId,
      concepto: conceptoFinanza,
      numeroFecha,
      transaction
    });

    const saldo = deudaAnterior + totalItems - montoAportado;

    await sequelize.query(`
      DELETE FROM finanzas
      WHERE id_equipo = :equipoId
        AND id_torneo = :torneoId
        AND concepto = :concepto
    `, {
      replacements: { equipoId, torneoId, concepto: conceptoFinanza },
      transaction
    });

    await sequelize.query(`
      INSERT INTO finanzas (
        id_equipo, monto_inscripcion, monto_aportado, deuda_total, entity_id,
        id_torneo, fecha_registro, concepto, tipo, saldo, deuda_inicial
      )
      VALUES (
        :equipoId, 0, :montoAportado, :totalItems, :entityId,
        :torneoId, CURRENT_DATE, :concepto, 'fecha_libre', :saldo, :deudaAnterior
      )
    `, {
      replacements: {
        equipoId,
        montoAportado,
        totalItems,
        entityId,
        torneoId,
        concepto: conceptoFinanza,
        saldo,
        deudaAnterior
      },
      transaction
    });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Carga de fecha libre guardada',
      resumen: { deudaAnterior, totalItems, montoAportado, saldo }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al guardar carga de fecha libre:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar la carga de fecha libre' });
  }
};

// Validar número de fechas
function validarFechas(numEquipos, fechasIngresadas) {
  const maxSimple = numEquipos % 2 === 1 ? numEquipos : numEquipos - 1;       // round-robin simple
  const maxIdaVuelta = maxSimple * 2; // ida y vuelta

  let valido = false;
  let mensaje = "";

  // Caso válido: menor o igual al máximo simple
  if (fechasIngresadas > 0 && fechasIngresadas <= maxSimple) {
    valido = true;
    mensaje = `¡Excelente! Con ${fechasIngresadas} fechas, todos los equipos juegan ${fechasIngresadas} encuentros de forma balanceada.`;
  }
  // Caso válido: exactamente ida/vuelta
  else if (fechasIngresadas === maxIdaVuelta) {
    valido = true;
    mensaje = `¡Excelente! Con ${fechasIngresadas} fechas, todos los equipos juegan ida y vuelta (${maxIdaVuelta} encuentros) de forma balanceada.`;
  }
  // Caso inválido pero permitido con advertencia
  else if (fechasIngresadas > 0) {
    valido = true; // permitir pero con advertencia
    mensaje = `⚠️ Atención: con ${numEquipos} equipos y ${fechasIngresadas} fechas, el torneo quedará disparejo. 
    Se sugiere seleccionar ${maxSimple} (simple) o ${maxIdaVuelta} (ida/vuelta). Sin embargo, el sistema generará encuentros aleatorios.`;
  }
  // Caso inválido: 0 o negativo
  else {
    valido = false;
    mensaje = `Error: el número de fechas debe ser mayor a 0.`;
  }

  return { valido, mensaje };
}

// Generar round-robin correcto sin equipos jugando 2x por fecha
function generarRoundRobin(equipos, numFechas, tipo = 'simple') {
  const partidos = [];
  const numEquipos = equipos.length;

  if (numEquipos < 2) {
    return partidos;
  }

  const lista = equipos.map(e => e.id_equipo);
  if (lista.length % 2 === 1) {
    lista.push(null);
  }

  const n = lista.length;
  const rondasBase = n - 1;
  const totalRondas = tipo === 'ida_vuelta' ? rondasBase * 2 : rondasBase;

  for (let ronda = 0; ronda < totalRondas; ronda++) {
    const esVuelta = tipo === 'ida_vuelta' && ronda >= rondasBase;
    const rondaBase = ronda % rondasBase;

    const equiposRonda = [...lista];
    for (let i = 0; i < rondaBase; i++) {
      const ultimo = equiposRonda.pop();
      equiposRonda.splice(1, 0, ultimo);
    }

    for (let i = 0; i < n / 2; i++) {
      const equipo_a = equiposRonda[i];
      const equipo_b = equiposRonda[n - 1 - i];

      if (equipo_a === null || equipo_b === null) {
        continue;
      }

      partidos.push({
        equipo_a: esVuelta ? equipo_b : equipo_a,
        equipo_b: esVuelta ? equipo_a : equipo_b,
        numero_fecha: (ronda % numFechas) + 1,
        estado: 'programado'
      });
    }
  }

  return partidos;
}

// Sortear encuentros mejorado (recibe parámetros del modal)
exports.sortearEncuentros = async (req, res) => {
  try {
    const { id_torneo, id_grupo } = req.params;
    const { tipo, numFechas } = req.body;

    console.log('Parámetros recibidos:', { id_torneo, id_grupo, tipo, numFechas });

    // Validar que el grupo exista
    const grupo = await Equipo.findOne({
      where: { id_grupo },
      attributes: ['id_grupo']
    });

    if (!grupo) {
      console.log('Grupo no encontrado:', id_grupo);
      req.flash("danger", "Grupo no encontrado");
      return res.redirect(`/torneos/gestionar/${id_torneo}`);
    }

    const partidosExistentes = await Partido.count({
      where: {
        id_torneo: parseInt(id_torneo, 10),
        id_grupo: parseInt(id_grupo, 10)
      }
    });

    if (partidosExistentes > 0) {
      return res.status(409).json({
        success: false,
        message: 'Encuentros ya sorteados para este grupo'
      });
    }

    // Obtener equipos del grupo
    const equipos = await Equipo.findAll({
      where: { id_grupo },
      attributes: ['id_equipo']
    });

    console.log('Equipos encontrados:', equipos.length);

    if (equipos.length < 2) {
      console.log('No hay suficientes equipos');
      req.flash("danger", "Se necesitan al menos 2 equipos para sortear encuentros");
      return res.redirect(`/torneos/gestionar/${id_torneo}`);
    }

    // Validar número de fechas
    const numFechasInt = parseInt(numFechas);
    const validacion = validarFechas(equipos.length, numFechasInt);

    console.log('Generando partidos:', { tipo, numFechasInt });

    // Generar partidos según tipo
    const partidos = generarRoundRobin(equipos, numFechasInt, tipo);

    console.log('Partidos generados:', partidos.length);

    // Obtener entity_id del torneo para que los partidos queden asociados correctamente
    const permisoTorneo = await validarAdminTorneo(req, id_torneo);
    if (!permisoTorneo.ok) {
      req.flash("danger", permisoTorneo.message);
      return res.redirect(`/torneos/gestionar/${id_torneo}`);
    }
    const partidoEntityId = permisoTorneo.torneo.entity_id;

    await setAuditContext(req, partidoEntityId);

    // Insertar partidos en la BD
    for (const partido of partidos) {
      console.log('Insertando partido:', partido, { entity_id: partidoEntityId });
      await Partido.create({
        id_torneo: parseInt(id_torneo, 10),
        id_grupo: parseInt(id_grupo, 10),
        equipo_a: partido.equipo_a,
        equipo_b: partido.equipo_b,
        numero_fecha: partido.numero_fecha,
        estado: partido.estado,
        entity_id: partidoEntityId || null
      });
    }

    // Registrar auditoría
    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "SORTEO", {
      id_torneo,
      id_grupo,
      tipo,
      numFechas: numFechasInt,
      totalPartidos: partidos.length,
      validacion: validacion.valido
    });

    // Mensaje de éxito con validación
    let mensaje = `Encuentros sorteados correctamente. ${partidos.length} partidos generados.`;
    if (!validacion.valido) {
      mensaje += ` ⚠️ ${validacion.mensaje}`;
    }
    req.flash("success", mensaje);
    
    res.json({
      success: true,
      message: mensaje,
      partidos: partidos.length,
      validacion: validacion
    });
  } catch (error) {
    console.error('Error completo en sortearEncuentros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al sortear encuentros: ' + error.message
    });
  }
};


// Actualizar estado con reglas de transición
exports.actualizarEstado = async (req, res) => {
  try {
    const partidoId = req.params.partido_id;
    const nuevoEstado = String(req.body.nuevoEstado || req.body.nuevo_estado || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const acceptJson = req.headers.accept && req.headers.accept.includes('application/json');
    const partido = await Partido.findByPk(partidoId);

    if (!partido) {
      if (acceptJson) {
        return res.status(404).json({ success: false, message: 'Partido no encontrado' });
      }
      req.flash("danger", "Partido no encontrado");
      return res.redirect('/partidos');
    }

    const permisoPartido = validarAdminPartido(req, partido);
    if (!permisoPartido.ok) {
      if (acceptJson) {
        return res.status(403).json({ success: false, message: permisoPartido.message });
      }
      req.flash("danger", permisoPartido.message);
      return res.redirect('/torneos');
    }

    const estadoActual = String(partido.estado || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

    if (estadoActual === nuevoEstado) {
      if (acceptJson) {
        return res.json({ success: true, message: 'Estado sin cambios' });
      }
      req.flash("info", "El estado no ha cambiado");
      return res.redirect(`/torneos/gestionar/${partido.id_torneo}#partidos`);
    }

    if (estadoActual === 'finalizado') {
      if (acceptJson) {
        return res.status(400).json({ success: false, message: 'No se puede cambiar el estado de un partido finalizado' });
      }
      req.flash("danger", "No se puede cambiar el estado de un partido finalizado");
      return res.redirect(`/torneos/gestionar/${partido.id_torneo}#partidos`);
    }

    const transicionesValidas = {
      programado: ['en_curso', 'finalizado', 'suspendido'],
      en_curso: ['programado', 'finalizado', 'suspendido'],
      suspendido: ['programado', 'en_curso', 'finalizado']
    };

    if (!transicionesValidas[estadoActual] || !transicionesValidas[estadoActual].includes(nuevoEstado)) {
      if (acceptJson) {
        return res.status(400).json({ success: false, message: 'Transición de estado no permitida' });
      }
      req.flash("danger", "Transición de estado no permitida");
      return res.redirect(`/torneos/gestionar/${partido.id_torneo}#partidos`);
    }

    partido.estado = nuevoEstado;
    await setAuditContext(req, partido.entity_id);
    await partido.save();

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "UPDATE", { partido_id: partidoId, nuevoEstado });

    if (acceptJson) {
      return res.json({ success: true, message: 'Estado actualizado correctamente' });
    }

    req.flash("success", "Estado actualizado correctamente");
    res.redirect(`/torneos/gestionar/${partido.id_torneo}#partidos`);
  } catch (error) {
    console.error(error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Error al actualizar estado del partido' });
    }
    res.status(500).send('Error al actualizar estado del partido');
  }
};

// Eliminar partido (solo si no está finalizado)
async function obtenerResumenCargaPartido(partidoId, partido = null) {
  const [resumen] = await sequelize.query(`
    SELECT
      (SELECT COUNT(*) FROM items_equipo WHERE id_partido = :partidoId) AS items,
      (SELECT COUNT(*) FROM estadisticas WHERE id_partido = :partidoId) AS estadisticas,
      (SELECT COUNT(*) FROM sanciones WHERE id_partido = :partidoId) AS sanciones,
      (SELECT COUNT(*) FROM eventos_partido WHERE id_partido = :partidoId) AS eventos,
      ${partido ? `(SELECT COUNT(*) FROM finanzas WHERE id_torneo = :torneoId AND concepto LIKE :concepto)` : `0`} AS finanzas
  `, {
    replacements: {
      partidoId,
      torneoId: partido?.id_torneo || null,
      concepto: partido ? `Encuentro #${partidoId} - %` : null
    },
    type: sequelize.QueryTypes.SELECT
  });

  return {
    items: Number(resumen?.items || 0),
    estadisticas: Number(resumen?.estadisticas || 0),
    sanciones: Number(resumen?.sanciones || 0),
    eventos: Number(resumen?.eventos || 0),
    finanzas: Number(resumen?.finanzas || 0)
  };
}

function resumenTieneCarga(resumen) {
  return Object.values(resumen || {}).some(valor => Number(valor || 0) > 0);
}

exports.eliminar = async (req, res) => {
  try {
    const partidoId = req.params.partido_id;
    const partido = await Partido.findByPk(partidoId);
    const redirectUrlBody = req.body.redirect_url;

    if (!partido) {
      req.flash("danger", "Partido no encontrado");
      return res.redirect(redirectUrlBody || (req.session.torneo_id ? `/torneos/gestionar/${req.session.torneo_id}#partidos` : '/partidos#partidos'));
    }
    const redirectUrl = redirectUrlBody || `/torneos/gestionar/${partido.id_torneo}#partidos`;

    const permisoPartido = validarAdminPartido(req, partido);
    if (!permisoPartido.ok) {
      req.flash("danger", permisoPartido.message);
      return res.redirect('/torneos');
    }

    if (partido.estado === 'finalizado') {
      req.flash("danger", "No se puede eliminar un partido finalizado");
      return res.redirect(redirectUrl);
    }

    const resumenCarga = await obtenerResumenCargaPartido(partidoId, partido);
    if (resumenTieneCarga(resumenCarga)) {
      req.flash("danger", "No se puede eliminar este encuentro porque ya tiene carga registrada. Revise items, finanzas, estadisticas o sanciones antes de eliminarlo.");
      return res.redirect(redirectUrl);
    }

    await setAuditContext(req, partido.entity_id);
    await partido.destroy();

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "DELETE", { partido_id: partidoId });

    req.flash("success", "Partido eliminado correctamente");
    res.redirect(redirectUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al eliminar partido');
  }
};

exports.eliminarFecha = async (req, res) => {
  try {
    const torneoId = Number.parseInt(req.params.id_torneo, 10);
    const numeroFecha = Number.parseInt(req.params.numero_fecha, 10);
    const idGrupo = req.body.id_grupo || null;
    const redirectUrl = req.body.redirect_url || `/torneos/gestionar/${torneoId}#partidos`;

    if (!torneoId || !numeroFecha) {
      req.flash("danger", "Fecha invalida");
      return res.redirect(redirectUrl);
    }

    const where = {
      id_torneo: torneoId,
      numero_fecha: numeroFecha
    };
    if (idGrupo) where.id_grupo = idGrupo;

    const [{ total_finalizados: totalFinalizados = 0 } = {}] = await sequelize.query(`
      SELECT COUNT(*) AS total_finalizados
      FROM partidos
      WHERE id_torneo = :torneoId
        AND numero_fecha = :numeroFecha
        AND LOWER(TRIM(COALESCE(estado, ''))) = 'finalizado'
    `, {
      replacements: { torneoId, numeroFecha },
      type: sequelize.QueryTypes.SELECT
    });

    if (Number(totalFinalizados || 0) > 0) {
      req.flash("danger", "No se puede eliminar una fecha con encuentros finalizados");
      return res.redirect(redirectUrl);
    }

    const permisoTorneo = await validarAdminTorneo(req, torneoId);
    if (!permisoTorneo.ok) {
      req.flash("danger", permisoTorneo.message);
      return res.redirect('/torneos');
    }
    const torneo = permisoTorneo.torneo;
    await setAuditContext(req, torneo?.entity_id || req.session.entity_id);

    const eliminados = await Partido.destroy({ where });

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "partidos", "DELETE_FECHA", {
      id_torneo: torneoId,
      numero_fecha: numeroFecha,
      id_grupo: idGrupo,
      eliminados
    });

    req.flash("success", `Fecha ${numeroFecha} eliminada correctamente`);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al eliminar fecha');
  }
};
