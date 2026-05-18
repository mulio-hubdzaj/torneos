// torneoContrller.js
const { Torneo, Grupo, Equipo, Partido, Finanzas, Usuario, Item, EquipoMovimientoGrupo, Entity, Cancha } = require('../models');
const { registrarAuditoria, registrarAccesoAuditoria, debeRegistrarAccesoSesion } = require('../utils/helpers');
const { sequelize } = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Op } = require('sequelize');

// 🔧 Función auxiliar para calcular edad y meses transcurridos desde último cumpleaños
function calcularEdadYMeses(fechaNacimiento) {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);

  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();

  if (hoy.getDate() < nacimiento.getDate()) meses--;
  if (meses < 0) { edad--; meses += 12; }

  return { edad, meses };
}

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

function generarCodigoTemporal(longitud = 8) {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(longitud);
  return Array.from(bytes, byte => caracteres[byte % caracteres.length]).join('');
}

function obtenerEtiquetaFase(tipo, numeroFecha, mitadFechas) {
  if (tipo !== 'ida_vuelta') return '';
  return numeroFecha <= mitadFechas ? 'Ida' : 'Vuelta';
}

function normalizarDetalleAuditoria(detalle) {
  if (detalle === null || detalle === undefined) return '';
  if (typeof detalle === 'string') {
    const limpio = detalle.trim();
    if (!limpio) return '';
    try {
      const parsed = JSON.parse(limpio);
      if (typeof parsed === 'string') return parsed;
      return JSON.stringify(parsed);
    } catch (error) {
      return limpio;
    }
  }
  if (typeof detalle === 'object') {
    if (typeof detalle.detalle === 'string') return detalle.detalle;
    return JSON.stringify(detalle);
  }
  return String(detalle);
}

function leerDetalleAuditoria(detalle) {
  if (detalle === null || detalle === undefined) return {};
  if (typeof detalle === 'object') return detalle;
  if (typeof detalle !== 'string') return {};
  try {
    const parsed = JSON.parse(detalle);
    return parsed && typeof parsed === 'object' ? parsed : { detalle: parsed };
  } catch (error) {
    return { detalle };
  }
}

function obtenerPantallaAuditoria(registro, detalle) {
  if (detalle.pantalla) return String(detalle.pantalla);
  const tabla = String(registro.tabla_afectada || '');
  const mapa = {
    pantalla: 'Pantalla',
    equipos: 'Equipo',
    jugadores: 'Jugador',
    jugadores_equipos: 'Jugador equipo',
    partidos: 'Fixture',
    torneos: 'Torneo',
    grupos: 'Grupo',
    items: 'Items',
    items_equipo: 'Items equipo',
    finanzas: 'Finanzas',
    usuarios: 'Usuarios',
    canchas: 'Sedes/canchas',
    sanciones: 'Sanciones',
    estadisticas: 'Estadisticas',
    eventos_partido: 'Eventos partido'
  };
  return mapa[tabla] || tabla || 'Sistema';
}

function obtenerAfectadoAuditoria(registro, detalle, detalleLegible) {
  const campos = ['equipo_afectado', 'equipo', 'usuario_afectado', 'jugador', 'torneo', 'grupo', 'nombre', 'pantalla'];
  for (const campo of campos) {
    if (detalle[campo]) return String(detalle[campo]);
  }

  const texto = String(detalleLegible || '');
  const matchTabla = texto.match(/(?:equipos|jugadores|usuarios|torneos|grupos|items|canchas):\s*([^;]+)/i);
  if (matchTabla) return matchTabla[1].trim();
  const matchCambioNombre = texto.match(/nombre de ([^;]+?) a ([^;]+)/i);
  if (matchCambioNombre) return matchCambioNombre[2].trim();

  return '-';
}

async function desvincularDelegadoUsuarioEnEntidad(idUsuario, entityId) {
  await sequelize.query(`
    DELETE FROM delegados_equipos de
    USING equipos e
    WHERE e.id_equipo = de.id_equipo
      AND de.id_usuario = :idUsuario
      AND e.entity_id = :entityId
  `, {
    replacements: { idUsuario, entityId }
  });
}

async function validarTorneoAdmin(req, torneoId) {
  if (![3, 99].includes(Number(req.session.rol_id))) {
    return { ok: false, message: 'No tiene permisos para administrar este torneo' };
  }
  const torneo = await Torneo.findByPk(torneoId);
  if (!torneo) return { ok: false, message: 'Torneo no encontrado' };
  if (Number(req.session.rol_id) !== 99 && Number(req.session.entity_id) !== Number(torneo.entity_id)) {
    return { ok: false, message: 'No puede administrar torneos de otra entidad' };
  }
  return { ok: true, torneo };
}

async function obtenerPermitirAgregarJugadores(torneoId) {
  try {
    const [config] = await sequelize.query(`
      SELECT permitir_agregar_jugadores
      FROM torneos
      WHERE id_torneo = :torneoId
      LIMIT 1
    `, {
      replacements: { torneoId },
      type: sequelize.QueryTypes.SELECT
    });
    return config?.permitir_agregar_jugadores !== false;
  } catch (error) {
    if (error?.parent?.code === '42703') return true;
    throw error;
  }
}

async function obtenerGruposOcultosFixture(torneoId) {
  try {
    const grupos = await sequelize.query(`
      SELECT id_grupo
      FROM grupos
      WHERE id_torneo = :torneoId
        AND COALESCE(visible_fixture, true) = false
    `, {
      replacements: { torneoId: parseInt(torneoId, 10) },
      type: sequelize.QueryTypes.SELECT
    });

    return new Set(grupos.map(grupo => String(grupo.id_grupo)));
  } catch (error) {
    if (error?.parent?.code === '42703') return new Set();
    throw error;
  }
}

function reemplazarIdsEquiposEnDetalle(detalle, equiposPorId) {
  let texto = String(detalle || '');
  if (!texto) return texto;

  texto = texto.replace(/equipo a de (\d+) a (\d+)/gi, (match, anterior, nuevo) => (
    `equipo A de ${equiposPorId.get(String(anterior)) || `equipo #${anterior}`} a ${equiposPorId.get(String(nuevo)) || `equipo #${nuevo}`}`
  ));

  texto = texto.replace(/equipo b de (\d+) a (\d+)/gi, (match, anterior, nuevo) => (
    `equipo B de ${equiposPorId.get(String(anterior)) || `equipo #${anterior}`} a ${equiposPorId.get(String(nuevo)) || `equipo #${nuevo}`}`
  ));

  texto = texto.replace(/equipo de (\d+) a (\d+)/gi, (match, anterior, nuevo) => (
    `equipo de ${equiposPorId.get(String(anterior)) || `equipo #${anterior}`} a ${equiposPorId.get(String(nuevo)) || `equipo #${nuevo}`}`
  ));

  texto = texto.replace(/equipos:\s*(\d+)/gi, (match, idEquipo) => (
    `equipos: ${equiposPorId.get(String(idEquipo)) || `equipo #${idEquipo}`}`
  ));

  return texto;
}

function obtenerEquipoPorIconoEnDetalle(detalle, equipos) {
  const texto = String(detalle || '');
  const matchIconoNuevo = texto.match(/icono de\s+\S+\s+a\s+(\S+)/i);
  const iconoNuevo = matchIconoNuevo?.[1];
  if (!iconoNuevo) return '';

  const equipo = equipos.find(item => String(item.icono || '') === iconoNuevo);
  return equipo?.nombre || '';
}

function normalizarEstadoPartido(estado) {
  return String(estado || 'programado')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function ordenarMovimientosFinanzasPorFixture(a, b) {
  const fechaA = Number(a.numero_fecha || 999999);
  const fechaB = Number(b.numero_fecha || 999999);
  if (fechaA !== fechaB) return fechaA - fechaB;

  const calendarioA = String(a.fecha_calendario || a.fecha_registro || '');
  const calendarioB = String(b.fecha_calendario || b.fecha_registro || '');
  if (calendarioA !== calendarioB) return calendarioA.localeCompare(calendarioB);

  return Number(a.id_finanza || 0) - Number(b.id_finanza || 0);
}

function recalcularMovimientosFinanzas(movimientos = []) {
  let saldoAnterior = 0;

  return [...movimientos]
    .sort(ordenarMovimientosFinanzasPorFixture)
    .map(movimiento => {
      const totalItems = Number(movimiento.total_items || 0);
      const entrega = Number(movimiento.entrega || 0);
      const saldo = saldoAnterior + totalItems - entrega;
      const movimientoRecalculado = {
        ...movimiento,
        deuda_inicial: saldoAnterior,
        saldo
      };

      saldoAnterior = saldo;
      return movimientoRecalculado;
    });
}

function obtenerRivalFinanzas(partido, equipoId) {
  if (!partido) return '';
  const equipo = String(equipoId || '');
  if (equipo && String(partido.equipo_a || '') === equipo) return partido.nombre_equipo_b || '';
  if (equipo && String(partido.equipo_b || '') === equipo) return partido.nombre_equipo_a || '';
  return '';
}

function armarDashboardInicio({ estadisticasGeneral, rankingGoles, partidosRaw }) {
  const partidosEnCurso = (partidosRaw || [])
    .filter(partido => normalizarEstadoPartido(partido.estado) === 'en_curso')
    .sort((a, b) => {
      const fechaA = `${a.fecha_input || '9999-12-31'} ${a.hora || '23:59'}`;
      const fechaB = `${b.fecha_input || '9999-12-31'} ${b.hora || '23:59'}`;
      return fechaA.localeCompare(fechaB);
    })
    .slice(0, 5);

  const partidosFinalizados = (partidosRaw || [])
    .filter(partido => normalizarEstadoPartido(partido.estado) === 'finalizado')
    .sort((a, b) => {
      const fechaA = `${a.fecha_input || ''} ${a.hora || ''}`;
      const fechaB = `${b.fecha_input || ''} ${b.hora || ''}`;
      return fechaB.localeCompare(fechaA);
    })
    .slice(0, 5);

  const proximosPartidos = (partidosRaw || [])
    .filter(partido => {
      const estado = normalizarEstadoPartido(partido.estado);
      return estado !== 'finalizado' && estado !== 'en_curso';
    })
    .sort((a, b) => {
      const fechaA = `${a.fecha_input || '9999-12-31'} ${a.hora || '23:59'}`;
      const fechaB = `${b.fecha_input || '9999-12-31'} ${b.hora || '23:59'}`;
      return fechaA.localeCompare(fechaB);
    })
    .slice(0, 5);

  return {
    tablaTop: (estadisticasGeneral || []).slice(0, 5),
    goleadoresTop: (rankingGoles || []).slice(0, 5),
    partidosEnCurso,
    ultimosResultados: partidosFinalizados,
    proximosPartidos
  };
}

async function obtenerReglaTarjetasTorneo(torneoId) {
  const reglaDefault = {
    acumula_amarillas: false,
    amarillas_para_suspension: 5,
    fechas_suspension_acumulacion: 1,
    reiniciar_al_sancionar: true,
    aplicar_item_amarilla: true,
    aplicar_item_roja: true,
    tabla_configurada: false
  };

  try {
    const [regla] = await sequelize.query(`
      SELECT acumula_amarillas,
             amarillas_para_suspension,
             fechas_suspension_acumulacion,
             reiniciar_al_sancionar,
             aplicar_item_amarilla,
             aplicar_item_roja
      FROM torneos_reglas_tarjetas
      WHERE id_torneo = :torneoId
      LIMIT 1
    `, {
      replacements: { torneoId: parseInt(torneoId, 10) },
      type: sequelize.QueryTypes.SELECT
    });

    return {
      ...reglaDefault,
      ...(regla || {}),
      tabla_configurada: true
    };
  } catch (error) {
    if (error?.parent?.code !== '42P01') {
      console.error('Error al consultar regla de tarjetas:', error);
    }
    return reglaDefault;
  }
}

function calcularTablaPosiciones(partidos, equipos, grupos, grupoId = null) {
  const equiposFiltrados = grupoId
    ? equipos.filter(e => String(e.id_grupo) === String(grupoId))
    : equipos;

  const partidosFiltrados = grupoId
    ? partidos.filter(p => String(p.id_grupo) === String(grupoId))
    : partidos;

  const mapa = new Map();

  equiposFiltrados.forEach(equipo => {
    mapa.set(equipo.id_equipo, {
      id_equipo: equipo.id_equipo,
      nombre: equipo.nombre,
      icono: equipo.icono || '/images/default_team.png',
      nombre_grupo: grupos.get(String(equipo.id_grupo)) || 'Sin grupo',
      pj: 0,
      pj_total: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      puntos: 0
    });
  });

  partidosFiltrados.forEach(partido => {
    const equipoA = mapa.get(partido.equipo_a);
    const equipoB = mapa.get(partido.equipo_b);

    if (equipoA) equipoA.pj_total += 1;
    if (equipoB) equipoB.pj_total += 1;

    if (partido.estado !== 'finalizado') return;

    const golesA = Number.parseInt(partido.goles_a ?? 0, 10) || 0;
    const golesB = Number.parseInt(partido.goles_b ?? 0, 10) || 0;

    if (equipoA) {
      equipoA.pj += 1;
      equipoA.gf += golesA;
      equipoA.gc += golesB;
    }
    if (equipoB) {
      equipoB.pj += 1;
      equipoB.gf += golesB;
      equipoB.gc += golesA;
    }

    if (golesA > golesB) {
      if (equipoA) {
        equipoA.pg += 1;
        equipoA.puntos += 3;
      }
      if (equipoB) equipoB.pp += 1;
    } else if (golesB > golesA) {
      if (equipoB) {
        equipoB.pg += 1;
        equipoB.puntos += 3;
      }
      if (equipoA) equipoA.pp += 1;
    } else {
      if (equipoA) {
        equipoA.pe += 1;
        equipoA.puntos += 1;
      }
      if (equipoB) {
        equipoB.pe += 1;
        equipoB.puntos += 1;
      }
    }
  });

  return [...mapa.values()].sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    const difA = a.gf - a.gc;
    const difB = b.gf - b.gc;
    if (difB !== difA) return difB - difA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.nombre.localeCompare(b.nombre);
  });
}

// Listar torneos
exports.listar = async (req, res) => {
  try {
    const entityId = req.session.entity_id;
    const torneos = await Torneo.findAll({
      where: { entity_id: entityId, estado: true },
      include: [
        { model: Grupo, include: [{ model: Equipo }] },
        { model: Equipo }
      ]
    });
    return res.render('torneos/listar', { torneos });
  } catch (error) {
    console.error("Error al obtener torneos:", error);
    return res.status(500).send('Error al obtener torneos');
  }
};
// Crear torneo
exports.crear = async (req, res) => {
  try {
    const { nombre_torneo, temporada, fecha_inicio } = req.body;
    const entityId = req.session.entity_id;

    await Torneo.create({
      nombre_torneo,
      temporada,
      fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : null,
      estado: true,
      entity_id: entityId
    });

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(
      usuarioId,
      req.session.documento,
      "torneos",
      "INSERT",
      { nombre_torneo },
      entityId
    );

    req.flash("success", "Torneo creado con éxito");
    return res.redirect(`/entidad/gestionar/${entityId}`);
  } catch (error) {
    console.error(error);
    req.flash("danger", "Error al crear torneo");
    return res.redirect(`/entidad/gestionar/${req.session.entity_id}`);
  }
};

// Detalle de un torneo con sus grupos y equipos
exports.detalle = async (req, res) => {
  try {
    const torneoId = req.params.id_torneo;
    const entityId = req.session.entity_id;

    const torneo = await Torneo.findByPk(torneoId, {
      include: [
        {
          model: Grupo,
          where: { entity_id: entityId },
          required: false,
          include: [{ model: Equipo }]
        }
      ]
    });

    if (!torneo) {
      req.flash("danger", "Torneo no encontrado");
      return res.redirect('/torneos');
    }

    return res.render('torneos/detalle', { torneo });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al obtener detalle del torneo');
  }
};
// Detalle de un grupo con sus equipos
exports.detalleGrupo = async (req, res) => {
  try {
    const grupoId = req.params.grupo_id;
    const grupo = await Grupo.findByPk(grupoId, { include: [{ model: Equipo }] });
    if (!grupo) {
      req.flash("danger", "Grupo no encontrado");
      return res.redirect('/torneos');
    }
    return res.render('torneos/detalle_grupo', { grupo });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al obtener detalle del grupo');
  }
};

// Editar torneo
exports.editar = async (req, res) => {
  try {
    const torneoId = req.params.id_torneo;
    const torneo = await Torneo.findByPk(torneoId);
    if (!torneo) {
      req.flash("danger", "Torneo no encontrado");
      return res.redirect('/torneos');
    }

    if (req.method === 'POST') {
      torneo.nombre_torneo = req.body.nombre_torneo;
      torneo.temporada = req.body.temporada;
      torneo.fecha_inicio = req.body.fecha_inicio ? new Date(req.body.fecha_inicio) : null;
      torneo.estado = req.body.estado ? true : false;
      await torneo.save();

      req.flash("success", "Torneo actualizado con éxito");
      return res.redirect('/torneos');
    }

    return res.render('torneos/editar', { torneo });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al editar torneo');
  }
};

// Activar torneo
exports.activar = async (req, res) => {
  try {
    const torneoId = req.params.id_torneo;
    const torneo = await Torneo.findByPk(torneoId);
    if (torneo) {
      torneo.estado = true;
      await torneo.save();
      req.flash("info", "Torneo activado");
    }
    return res.redirect('/torneos');
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al activar torneo');
  }
};

// Desactivar torneo
exports.desactivar = async (req, res) => {
  try {
    const torneoId = req.params.id_torneo;
    const torneo = await Torneo.findByPk(torneoId);
    if (torneo) {
      torneo.estado = false;
      await torneo.save();
      req.flash("info", "Torneo desactivado");
    }
    return res.redirect('/torneos');
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error al desactivar torneo');
  }
 }; 
// Gestionar torneo
exports.gestionar = async (req, res) => {
  try {
    const torneoId = req.params.id_torneo;
    let entityId = req.session.entity_id;

    console.log('Sesión actual:', { entity_id: req.session.entity_id, documento: req.session.documento, rol_id: req.session.rol_id });

    // Si el usuario no es super_admin y no tiene entity_id válido, forzar re-login
    if (req.session.rol_id !== 99) {
      if (!entityId || isNaN(parseInt(entityId, 10))) {
        console.log('entityId inválido para rol distinto de super_admin:', entityId);
        req.flash("danger", "Sesión inválida. Por favor, inicie sesión nuevamente.");
        return res.redirect('/login');
      }
      entityId = parseInt(entityId, 10);
      console.log('entityId convertido:', entityId);
    }

    req.session.torneo_id = torneoId;

    const torneo = await Torneo.findByPk(torneoId, {
      include: [
        { model: Grupo, required: false, include: [{ model: Equipo }] },
        { model: Equipo, required: false }
      ]
    });

    if (!torneo) {
      req.flash("danger", "Torneo no encontrado");
      return res.redirect('/torneos');
    }

    if (req.session.rol_id === 99) {
      req.session.entity_id = torneo.entity_id;
      entityId = torneo.entity_id;
    }

    if (debeRegistrarAccesoSesion(req, `torneo:${torneo.id_torneo}`)) {
      await registrarAccesoAuditoria(req.session.usuario_id, torneo.entity_id, 'Torneo', {
        id_entidad: torneo.entity_id,
        id_torneo: torneo.id_torneo,
        torneo: `${torneo.nombre_torneo} ${torneo.temporada || ''}`.trim(),
        detalle: `Ingreso a torneo ${torneo.nombre_torneo}`
      });
    }

    const grupoSeleccionadoId = req.query.grupo_id ? parseInt(req.query.grupo_id, 10) : null;
    const fechaCalendarioSeleccionada = req.query.fecha_calendario ? normalizarFechaInput(req.query.fecha_calendario) : '';
    const torneoData = torneo.get({ plain: true });
    torneoData.permitir_agregar_jugadores = await obtenerPermitirAgregarJugadores(torneoId);
    const entidadActual = await Entity.findByPk(entityId);
    const gruposMapa = new Map((torneoData.Grupos || []).map(grupo => [String(grupo.id_grupo), grupo.nombre_grupo]));
    const gruposOcultosFixture = await obtenerGruposOcultosFixture(torneoId);
    const movimientosGrupo = await EquipoMovimientoGrupo.findAll({
      where: { id_torneo: torneoId },
      include: [
        { model: Equipo, as: 'Equipo', attributes: ['id_equipo', 'nombre'] },
        { model: Grupo, as: 'GrupoDestino', attributes: ['id_grupo', 'nombre_grupo'] }
      ],
      order: [['fecha_movimiento', 'DESC']]
    });
    const movimientosPorGrupoOrigen = movimientosGrupo.reduce((acc, movimiento) => {
      const data = movimiento.get({ plain: true });
      const key = String(data.id_grupo_origen);
      if (!acc[key]) acc[key] = [];
      acc[key].push(data);
      return acc;
    }, {});
    const equiposConGrupo = (torneoData.Equipos || []).map(equipo => ({
      ...equipo,
      nombre_grupo: gruposMapa.get(String(equipo.id_grupo)) || 'Sin grupo'
    }));

    const equiposDelegadoIds = req.session.usuario_id
      ? await sequelize.query(`
          SELECT e.id_equipo
          FROM delegados_equipos de
          INNER JOIN equipos e ON e.id_equipo = de.id_equipo
          WHERE de.id_usuario = :usuarioId
            AND e.id_torneo = :torneoId
            AND COALESCE(de.estado, true) = true
            AND COALESCE(e.estado, true) = true
        `, {
          replacements: { usuarioId: req.session.usuario_id, torneoId: parseInt(torneoId, 10) },
          type: sequelize.QueryTypes.SELECT
        })
      : [];
    const equiposDelegadoSet = new Set(equiposDelegadoIds.map(registro => Number(registro.id_equipo)));
    equiposConGrupo.forEach(equipo => {
      equipo.es_equipo_delegado = equiposDelegadoSet.has(Number(equipo.id_equipo));
    });
    torneoData.Equipos = equiposConGrupo;

    // Consulta de jugadores
    const jugadores = await sequelize.query(`
      SELECT j.id_jugador,
             j.nombre,
             j.apellido,
             COALESCE(e.nombre, 'Libre') AS equipo,
             t.nombre_torneo AS torneo,
             COALESCE(je.tipo_vinculo, 'Libre') AS tipo_vinculo,
             CASE 
               WHEN je.id_jugador IS NULL THEN 'Libre'
               WHEN je.id_equipo IS NULL THEN 'Libre'
               WHEN je.estado THEN 'Activo'
               ELSE 'Inactivo'
             END AS estado_vinculo_texto,
             CASE 
               WHEN je.id_jugador IS NULL THEN true
               ELSE je.estado
             END AS estado_vinculo_bool,
             j.documento,
             j.fecha_nacimiento,
             j.estado AS estado_jugador,
             je.observaciones,
             je.numero_camiseta,
             COALESCE(je.capitan, false) AS capitan
      FROM jugadores j
      LEFT JOIN jugadores_equipos je 
             ON j.id_jugador = je.id_jugador 
             AND je.id_torneo = :torneoId
      LEFT JOIN equipos e 
             ON je.id_equipo = e.id_equipo
      LEFT JOIN torneos t 
             ON je.id_torneo = t.id_torneo
      WHERE j.entity_id = :entityId;
    `, {
      replacements: { torneoId: parseInt(torneoId, 10), entityId: entityId },
      type: sequelize.QueryTypes.SELECT
    });

    // Normalizar fechas
    jugadores.forEach(j => {
      if (j.fecha_nacimiento) {
        const fecha = new Date(`${j.fecha_nacimiento}T00:00:00`);
        const { edad, meses } = calcularEdadYMeses(fecha);
        j.fecha_nacimiento_fmt = j.fecha_nacimiento;
        j.edad = edad;
        j.meses = meses;
      } else {
        j.fecha_nacimiento_fmt = '';
        j.edad = '';
        j.meses = '';
      }
    });

    // Lista de torneos activos
    const torneos = await Torneo.findAll({
      where: { entity_id: entityId, estado: true }
    });

    const items = await Item.findAll({
      where: {
        entity_id: entityId,
        id_torneo: torneoData.id_torneo
      },
      order: [['nombre', 'ASC']]
    });

    // 🔑 Consulta de usuarios para el modal de delegados
    const usuarios = await Usuario.findAll({
      where: { entity_id: entityId, estado: true }
    });

    const puedeGestionarUsuarios = [3, 99].includes(Number(req.session.rol_id));
    let usuariosAdmin = [];
    let torneosUsuarios = [];

    if (puedeGestionarUsuarios) {
      usuariosAdmin = await sequelize.query(`
        SELECT u.id_usuario,
               u.nombre,
               u.correo,
               u.documento,
               u.rol_id,
               u.estado,
               COALESCE(r.nombre_rol,
                 CASE
                   WHEN u.rol_id = 1 THEN 'Espectador'
                   WHEN u.rol_id = 2 THEN 'Delegado'
                   WHEN u.rol_id = 3 THEN 'Admin'
                   WHEN u.rol_id = 99 THEN 'Super admin'
                   ELSE 'Rol ' || COALESCE(u.rol_id::text, '-')
                 END
               ) AS rol_nombre,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id_torneo', t.id_torneo,
                     'torneo', t.nombre_torneo,
                     'equipo', e.nombre,
                     'rol_equipo', de.rol,
                   'estado_vinculo', COALESCE(de.estado, true)
                 )
                 ORDER BY t.nombre_torneo, e.nombre
               ) FILTER (WHERE e.id_equipo IS NOT NULL AND t.id_torneo IS NOT NULL),
               '[]'::json
             ) AS vinculos
        FROM usuarios u
        LEFT JOIN roles r ON r.id_rol = u.rol_id
        LEFT JOIN delegados_equipos de ON de.id_usuario = u.id_usuario
        LEFT JOIN equipos e ON e.id_equipo = de.id_equipo
        LEFT JOIN torneos t ON t.id_torneo = e.id_torneo AND t.estado = true
        WHERE (
          u.entity_id = :entityId
          AND (:rolSesion = 99 OR COALESCE(u.rol_id, 0) <> 99)
        )
           OR (:rolSesion = 99 AND u.rol_id = 99)
        GROUP BY u.id_usuario, u.nombre, u.correo, u.documento, u.rol_id, u.estado, r.nombre_rol
        ORDER BY u.nombre ASC, u.documento ASC
      `, {
        replacements: { entityId, rolSesion: Number(req.session.rol_id) },
        type: sequelize.QueryTypes.SELECT
      });

      usuariosAdmin.forEach(usuario => {
        if (typeof usuario.vinculos === 'string') {
          try {
            usuario.vinculos = JSON.parse(usuario.vinculos);
          } catch (error) {
            usuario.vinculos = [];
          }
        }
        if (!Array.isArray(usuario.vinculos)) usuario.vinculos = [];
      });

      torneosUsuarios = await Torneo.findAll({
        where: { entity_id: entityId, estado: true },
        order: [['nombre_torneo', 'ASC']]
      });
    }

    // Consultar partidos del torneo
    let partidosRaw = [];
    let partidosPorFecha = [];
    
    try {
      const resultados = await sequelize.query(`
        SELECT p.id_partido,
               p.equipo_a,
               p.equipo_b,
               p.numero_fecha,
               p.fecha,
               p.hora,
               p.estado,
               p.goles_a,
               p.goles_b,
               p.observaciones,
               p.id_grupo,
               p.id_cancha,
               c.nombre AS nombre_cancha,
               ea.nombre AS nombre_equipo_a,
               ea.icono AS icono_equipo_a,
               ea.estado AS estado_equipo_a,
               (
                 EXISTS (
                   SELECT 1
                   FROM items_equipo ie
                   WHERE ie.id_equipo = p.equipo_a
                     AND ie.id_partido = p.id_partido
                 )
                 OR EXISTS (
                   SELECT 1
                   FROM finanzas f
                   WHERE f.id_equipo = p.equipo_a
                     AND f.id_torneo = p.id_torneo
                     AND f.concepto = CONCAT('Encuentro #', p.id_partido, ' - ', ea.nombre)
                 )
               ) AS carga_equipo_a_registrada,
               eb.nombre AS nombre_equipo_b,
               eb.icono AS icono_equipo_b,
               eb.estado AS estado_equipo_b,
               (
                 EXISTS (
                   SELECT 1
                   FROM items_equipo ie
                   WHERE ie.id_equipo = p.equipo_b
                     AND ie.id_partido = p.id_partido
                 )
                 OR EXISTS (
                   SELECT 1
                   FROM finanzas f
                   WHERE f.id_equipo = p.equipo_b
                     AND f.id_torneo = p.id_torneo
                     AND f.concepto = CONCAT('Encuentro #', p.id_partido, ' - ', eb.nombre)
                 )
               ) AS carga_equipo_b_registrada,
               g.nombre_grupo
        FROM partidos p
        LEFT JOIN equipos ea ON ea.id_equipo = p.equipo_a
        LEFT JOIN equipos eb ON eb.id_equipo = p.equipo_b
        LEFT JOIN grupos g ON g.id_grupo = p.id_grupo
        LEFT JOIN canchas c ON c.id_cancha = p.id_cancha
        WHERE p.id_torneo = :torneoId
        ORDER BY p.numero_fecha ASC, p.fecha ASC, p.hora ASC
      `, {
        replacements: { torneoId: parseInt(torneoId, 10) },
        type: sequelize.QueryTypes.SELECT
      });

      partidosRaw = (resultados || []).map(partido => {
        const fechaInput = normalizarFechaInput(partido.fecha);
        return {
          ...partido,
          tiene_equipo_inhabilitado: partido.estado_equipo_a === false || partido.estado_equipo_b === false,
          icono_equipo_a: partido.icono_equipo_a || '/images/default_team.png',
          icono_equipo_b: partido.icono_equipo_b || '/images/default_team.png',
          fecha_input: fechaInput,
          fecha_formateada: fechaInput ? fechaInput.split('-').reverse().join('/') : '-',
          nombre_grupo_display: partido.nombre_grupo || 'Sin grupo'
        };
      });

      const resumenPartidosPorEquipo = partidosRaw.reduce((acc, partido) => {
        [partido.equipo_a, partido.equipo_b].forEach(idEquipo => {
          if (!idEquipo) return;
          const key = String(idEquipo);
          if (!acc[key]) {
            acc[key] = { total: 0, pendientes: 0 };
          }
          acc[key].total += 1;
          if (partido.estado !== 'finalizado') {
            acc[key].pendientes += 1;
          }
        });
        return acc;
      }, {});

      equiposConGrupo.forEach(equipo => {
        const resumen = resumenPartidosPorEquipo[String(equipo.id_equipo)] || { total: 0, pendientes: 0 };
        equipo.partidos_total = resumen.total;
        equipo.partidos_pendientes = resumen.pendientes;
        equipo.grupo_sorteado = resumen.total > 0;
      });

      (torneoData.Grupos || []).forEach(grupo => {
        (grupo.Equipos || []).forEach(equipo => {
          const resumen = resumenPartidosPorEquipo[String(equipo.id_equipo)] || { total: 0, pendientes: 0 };
          equipo.partidos_total = resumen.total;
          equipo.partidos_pendientes = resumen.pendientes;
          equipo.grupo_sorteado = resumen.total > 0;
        });
      });

      const partidosFixtureBase = partidosRaw.filter(partido => !gruposOcultosFixture.has(String(partido.id_grupo)));
      const partidosVisibles = fechaCalendarioSeleccionada
        ? partidosFixtureBase.filter(partido => partido.fecha_input === fechaCalendarioSeleccionada)
        : (grupoSeleccionadoId
          ? partidosFixtureBase.filter(partido => String(partido.id_grupo) === String(grupoSeleccionadoId))
          : partidosFixtureBase);

      const partidosPorFechaMap = {};
      partidosVisibles.forEach(partido => {
        const numeroFecha = partido.numero_fecha || 0;
        if (!partidosPorFechaMap[numeroFecha]) {
          partidosPorFechaMap[numeroFecha] = {
            numero_fecha: numeroFecha,
            partidos: [],
            fecha_general: partido.fecha_input || null
          };
        }
        partidosPorFechaMap[numeroFecha].partidos.push(partido);
      });

      partidosPorFecha = Object.values(partidosPorFechaMap);
      const maxNumeroFecha = partidosPorFecha.reduce((max, fecha) => Math.max(max, Number(fecha.numero_fecha || 0)), 0);
      for (let numeroFecha = 1; numeroFecha <= maxNumeroFecha; numeroFecha += 1) {
        if (!partidosPorFechaMap[numeroFecha]) {
          partidosPorFechaMap[numeroFecha] = {
            numero_fecha: numeroFecha,
            partidos: [],
            fecha_general: null,
            fecha_vacia: true
          };
        }
      }
      partidosPorFecha = Object.values(partidosPorFechaMap)
        .sort((a, b) => Number(a.numero_fecha || 0) - Number(b.numero_fecha || 0));

      const cargasLibresFinanzas = await sequelize.query(`
        SELECT id_equipo, concepto
        FROM finanzas
        WHERE id_torneo = :torneoId
          AND tipo = 'fecha_libre'
      `, {
        replacements: { torneoId: parseInt(torneoId, 10) },
        type: sequelize.QueryTypes.SELECT
      });

      const cargasLibresItems = await sequelize.query(`
        SELECT id_equipo, observaciones
        FROM items_equipo
        WHERE id_partido IS NULL
          AND COALESCE(observaciones, '') LIKE :marcaLike
      `, {
        replacements: { marcaLike: `[fecha_libre:${parseInt(torneoId, 10)}:%` },
        type: sequelize.QueryTypes.SELECT
      });

      const cargasLibresRegistradas = new Set();
      cargasLibresFinanzas.forEach(registro => {
        const match = String(registro.concepto || '').match(/^Fecha libre #(\d+) - /);
        if (match) {
          cargasLibresRegistradas.add(`${registro.id_equipo}:${match[1]}`);
        }
      });
      cargasLibresItems.forEach(registro => {
        const match = String(registro.observaciones || '').match(/^\[fecha_libre:\d+:(\d+)\]/);
        if (match) {
          cargasLibresRegistradas.add(`${registro.id_equipo}:${match[1]}`);
        }
      });

      let esIdaVuelta = false;
      if (partidosPorFecha.length > 0) {
        const numEquipos = new Set();
        partidosVisibles.forEach(p => {
          if (p.equipo_a) numEquipos.add(p.equipo_a);
          if (p.equipo_b) numEquipos.add(p.equipo_b);
        });

        const totalEquipos = numEquipos.size;
        const maxFechasSimples = totalEquipos - 1;
        esIdaVuelta = partidosPorFecha.length > maxFechasSimples;
      }

      partidosPorFecha.forEach(fecha => {
        if (esIdaVuelta) {
          const mitadFechas = Math.ceil(partidosPorFecha.length / 2);
          fecha.etiqueta = fecha.numero_fecha <= mitadFechas
            ? `Fecha ${fecha.numero_fecha} - Ida`
            : `Fecha ${fecha.numero_fecha} - Vuelta`;

          fecha.partidos.forEach(partido => {
            partido.nombre_grupo_display = `${partido.nombre_grupo || 'Sin grupo'} - ${obtenerEtiquetaFase('ida_vuelta', partido.numero_fecha, mitadFechas)}`;
          });
        } else {
          fecha.etiqueta = `Fecha ${fecha.numero_fecha}`;
        }

        const gruposEnFecha = new Map();
        fecha.partidos.forEach(partido => {
          if (!partido.id_grupo) return;
          if (!gruposEnFecha.has(partido.id_grupo)) {
            gruposEnFecha.set(partido.id_grupo, new Set());
          }
          if (partido.equipo_a) gruposEnFecha.get(partido.id_grupo).add(partido.equipo_a);
          if (partido.equipo_b) gruposEnFecha.get(partido.id_grupo).add(partido.equipo_b);
        });

        fecha.equipos_libres = [];
        gruposEnFecha.forEach((equiposJugados, grupoId) => {
          const libres = equiposConGrupo
            .filter(equipo => String(equipo.id_grupo) === String(grupoId))
            .filter(equipo => !equiposJugados.has(equipo.id_equipo));

          libres.forEach(equipo => {
            fecha.equipos_libres.push({
              id_grupo: grupoId,
              id_equipo: equipo.id_equipo,
              nombre_grupo: gruposMapa.get(String(grupoId)) || 'Sin grupo',
              nombre_equipo: equipo.nombre,
              icono: equipo.icono || '/images/default_team.png',
              carga_registrada: cargasLibresRegistradas.has(`${equipo.id_equipo}:${fecha.numero_fecha}`)
            });
          });
        });
      });
    } catch (error) {
      console.error('Error al consultar partidos:', error);
      partidosRaw = [];
      partidosPorFecha = [];
    }

    const gruposConSorteo = await Promise.all((torneoData.Grupos || []).map(async grupo => {
      const totalPartidos = await Partido.count({
        where: {
          id_torneo: parseInt(torneoId, 10),
          id_grupo: grupo.id_grupo
        }
      });

      return {
        ...grupo,
        visible_fixture: !gruposOcultosFixture.has(String(grupo.id_grupo)),
        movimientos_salida: movimientosPorGrupoOrigen[String(grupo.id_grupo)] || [],
        encuentros_sorteados: totalPartidos > 0,
        total_partidos: totalPartidos
      };
    }));

    torneoData.Grupos = gruposConSorteo;
    const gruposFixture = gruposConSorteo.filter(grupo => grupo.visible_fixture !== false);
    torneoData.Equipos = equiposConGrupo;

    const estadisticasGeneral = calcularTablaPosiciones(partidosRaw, equiposConGrupo, gruposMapa, null);
    const estadisticasFiltradas = grupoSeleccionadoId
      ? calcularTablaPosiciones(partidosRaw, equiposConGrupo, gruposMapa, grupoSeleccionadoId)
      : estadisticasGeneral;
    const rankingGoles = await sequelize.query(`
      SELECT j.id_jugador,
             j.nombre,
             j.apellido,
             COALESCE(e.nombre, 'Libre') AS equipo,
             SUM(COALESCE(est.goles, 0)) AS goles
      FROM estadisticas est
      INNER JOIN partidos p ON p.id_partido = est.id_partido
      INNER JOIN jugadores j ON j.id_jugador = est.id_jugador
      LEFT JOIN jugadores_equipos je
        ON je.id_jugador = j.id_jugador
       AND je.id_torneo = p.id_torneo
      LEFT JOIN equipos e ON e.id_equipo = je.id_equipo
      WHERE p.id_torneo = :torneoId
      GROUP BY j.id_jugador, j.nombre, j.apellido, e.nombre
      HAVING SUM(COALESCE(est.goles, 0)) > 0
      ORDER BY SUM(COALESCE(est.goles, 0)) DESC, j.nombre ASC, j.apellido ASC
    `, {
      replacements: { torneoId: parseInt(torneoId, 10) },
      type: sequelize.QueryTypes.SELECT
    });
    const reglaTarjetas = await obtenerReglaTarjetasTorneo(torneoData.id_torneo);
    const canchas = await Cancha.findAll({
      where: {
        id_torneo: torneoData.id_torneo,
        entity_id: torneoData.entity_id
      },
      order: [['estado', 'DESC'], ['nombre', 'ASC']]
    });
    const movimientosFinanzas = await sequelize.query(`
      SELECT id_finanza,
             id_equipo,
             concepto,
             tipo,
             COALESCE(monto_aportado, 0) AS monto_aportado,
             COALESCE(deuda_total, 0) AS deuda_total,
             COALESCE(deuda_inicial, 0) AS deuda_inicial,
             COALESCE(saldo, 0) AS saldo,
             fecha_registro
      FROM finanzas
      WHERE id_torneo = :torneoId
      ORDER BY id_equipo ASC, fecha_registro ASC, id_finanza ASC
    `, {
      replacements: { torneoId: parseInt(torneoId, 10) },
      type: sequelize.QueryTypes.SELECT
    });

    const itemsFinanzas = await sequelize.query(`
      SELECT ie.id_item_equipo,
             ie.id_equipo,
             ie.id_partido,
             ie.nombre,
             COALESCE(ie.monto, 0) AS monto,
             COALESCE(ie.cantidad, 1) AS cantidad,
             COALESCE(ie.observaciones, '') AS observaciones,
             ie.fecha_registro,
             p.numero_fecha,
             p.fecha
      FROM items_equipo ie
      LEFT JOIN partidos p ON p.id_partido = ie.id_partido
      WHERE p.id_torneo = :torneoId
         OR COALESCE(ie.observaciones, '') LIKE :marcaLike
      ORDER BY ie.id_equipo ASC, COALESCE(p.numero_fecha, 0) ASC, ie.fecha_registro ASC, ie.id_item_equipo ASC
    `, {
      replacements: {
        torneoId: parseInt(torneoId, 10),
        marcaLike: `[fecha_libre:${parseInt(torneoId, 10)}:%`
      },
      type: sequelize.QueryTypes.SELECT
    });

    const itemsPorClaveFinanza = itemsFinanzas.reduce((acc, item) => {
      let clave = item.id_partido ? `partido:${item.id_partido}:equipo:${item.id_equipo}` : null;
      const matchLibre = String(item.observaciones || '').match(/^\[fecha_libre:\d+:(\d+)\]/);
      if (!clave && matchLibre) {
        clave = `libre:${item.id_equipo}:${matchLibre[1]}`;
      }
      if (!clave) return acc;
      if (!acc[clave]) acc[clave] = [];
      acc[clave].push({
        id_item_equipo: item.id_item_equipo,
        nombre: item.nombre || '',
        monto: Number(item.monto || 0),
        cantidad: Number(item.cantidad || 0),
        total: Number(item.monto || 0) * Number(item.cantidad || 0),
        observaciones: String(item.observaciones || '').replace(/^\[fecha_libre:\d+:\d+\]\s*/, ''),
        fecha_registro: item.fecha_registro,
        numero_fecha: item.numero_fecha || matchLibre?.[1] || null
      });
      return acc;
    }, {});
    const partidoFinanzasPorId = partidosRaw.reduce((acc, partido) => {
      acc[String(partido.id_partido)] = {
        numero_fecha: partido.numero_fecha || null,
        fecha: partido.fecha_input || partido.fecha || null,
        equipo_a: partido.equipo_a || null,
        equipo_b: partido.equipo_b || null,
        nombre_equipo_a: partido.nombre_equipo_a || '',
        nombre_equipo_b: partido.nombre_equipo_b || '',
        nombre_grupo: partido.nombre_grupo || 'Sin grupo',
        nombre_grupo_display: partido.nombre_grupo_display || partido.nombre_grupo || 'Sin grupo'
      };
      return acc;
    }, {});
    const fechaCalendarioPorNumero = partidosPorFecha.reduce((acc, fecha) => {
      if (fecha.numero_fecha && fecha.fecha_general) {
        acc[String(fecha.numero_fecha)] = fecha.fecha_general;
      }
      return acc;
    }, {});

    const movimientosPorEquipo = movimientosFinanzas.reduce((acc, movimiento) => {
      const key = String(movimiento.id_equipo);
      if (!acc[key]) acc[key] = [];

      const matchPartido = String(movimiento.concepto || '').match(/^Encuentro #(\d+)/);
      const matchLibre = String(movimiento.concepto || '').match(/^Fecha libre #(\d+)/);
      const claveItems = matchPartido
        ? `partido:${matchPartido[1]}:equipo:${movimiento.id_equipo}`
        : (matchLibre ? `libre:${movimiento.id_equipo}:${matchLibre[1]}` : null);
      const itemsMovimiento = claveItems ? (itemsPorClaveFinanza[claveItems] || []) : [];
      const partidoMovimiento = matchPartido ? partidoFinanzasPorId[String(matchPartido[1])] : null;
      const rivalMovimiento = obtenerRivalFinanzas(partidoMovimiento, movimiento.id_equipo);
      const numeroFechaMovimiento = partidoMovimiento?.numero_fecha || matchLibre?.[1] || null;
      const fechaCalendarioMovimiento = partidoMovimiento?.fecha || fechaCalendarioPorNumero[String(numeroFechaMovimiento || '')] || null;
      const conceptoBase = movimiento.concepto || 'Movimiento';

      acc[key].push({
        id_finanza: movimiento.id_finanza,
        concepto: conceptoBase,
        concepto_display: rivalMovimiento ? `${conceptoBase} vs ${rivalMovimiento}` : conceptoBase,
        tipo: movimiento.tipo || '',
        fecha_registro: movimiento.fecha_registro,
        numero_fecha: numeroFechaMovimiento,
        fecha_calendario: fechaCalendarioMovimiento,
        nombre_grupo: partidoMovimiento?.nombre_grupo || null,
        nombre_grupo_display: partidoMovimiento?.nombre_grupo_display || null,
        deuda_inicial: Number(movimiento.deuda_inicial || 0),
        total_items: Number(movimiento.deuda_total || 0),
        entrega: Number(movimiento.monto_aportado || 0),
        saldo: Number(movimiento.saldo || 0),
        items: itemsMovimiento
      });
      return acc;
    }, {});

    const equiposFinanzasVisibles = Number(req.session.rol_id) === 2
      ? equiposConGrupo.filter(equipo => equipo.es_equipo_delegado)
      : equiposConGrupo;
    const finanzasResumen = equiposFinanzasVisibles.map(equipo => {
      const movimientos = recalcularMovimientosFinanzas(movimientosPorEquipo[String(equipo.id_equipo)] || []);
      const ultimoMovimiento = movimientos[movimientos.length - 1] || null;
      const saldoActual = Number(ultimoMovimiento?.saldo || 0);
      return {
        id_equipo: equipo.id_equipo,
        nombre: equipo.nombre,
        icono: equipo.icono || '/images/default_team.png',
        nombre_grupo: equipo.nombre_grupo || 'Sin grupo',
        saldo_actual: saldoActual,
        adeuda: saldoActual > 0,
        total_items: movimientos.reduce((total, mov) => total + Number(mov.total_items || 0), 0),
        total_entregado: movimientos.reduce((total, mov) => total + Number(mov.entrega || 0), 0),
        movimientos
      };
    });

    const puedeVerAuditoria = [3, 99].includes(Number(req.session.rol_id));
    const contextoAuditoria = {
      entity_id: entityId,
      id_torneo: parseInt(torneoId, 10),
      entidad: entidadActual ? (entidadActual.codigo || `Entidad #${entityId}`) : `Entidad #${entityId}`,
      torneo: `${torneoData.nombre_torneo} ${torneoData.temporada || ''}`.trim()
    };
    let auditoria = [];

    if (puedeVerAuditoria) {
      auditoria = await sequelize.query(`
        SELECT a.id_auditoria,
               a.id_usuario,
               a.accion,
               a.tabla_afectada,
               a.detalle,
               a.fecha_hora,
               a.entity_id,
               u.nombre AS usuario_nombre,
               u.documento AS usuario_documento,
               e.codigo AS entidad_codigo,
               e.descripcion AS entidad_descripcion
        FROM auditoria a
        LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
        LEFT JOIN entity e ON e.entity_id = a.entity_id
        WHERE a.entity_id = :auditEntityId
          AND (
            a.detalle->>'id_torneo' IS NULL
            OR a.detalle->>'id_torneo' = :auditTorneoId
          )
        ORDER BY a.fecha_hora DESC, a.id_auditoria DESC
        LIMIT :auditLimit
      `, {
        replacements: {
          auditEntityId: entityId,
          auditTorneoId: String(torneoData.id_torneo),
          auditLimit: 250
        },
        type: sequelize.QueryTypes.SELECT
      });

      const equiposPorIdAuditoria = new Map(equiposConGrupo.map(equipo => [
        String(equipo.id_equipo),
        equipo.nombre
      ]));

      auditoria = auditoria.map(registro => {
        const detalleObjeto = leerDetalleAuditoria(registro.detalle);
        let detalleLegible = detalleObjeto.detalle
          ? String(detalleObjeto.detalle)
          : normalizarDetalleAuditoria(registro.detalle);
        detalleLegible = reemplazarIdsEquiposEnDetalle(detalleLegible, equiposPorIdAuditoria);
        let afectado = obtenerAfectadoAuditoria(registro, detalleObjeto, detalleLegible);
        if (afectado === '-' && String(registro.tabla_afectada || '') === 'equipos') {
          afectado = obtenerEquipoPorIconoEnDetalle(detalleLegible, equiposConGrupo) || afectado;
        }

        return {
          ...registro,
          pantalla: obtenerPantallaAuditoria(registro, detalleObjeto),
          afectado,
          detalle_legible: detalleLegible,
          usuario_display: registro.usuario_nombre || 'Sistema',
          usuario_documento_display: registro.usuario_documento || '',
          contexto_torneo: contextoAuditoria.torneo
        };
      });
    }

    const dashboardInicio = armarDashboardInicio({
      estadisticasGeneral,
      rankingGoles,
      partidosRaw
    });

    //const messages = req.flash();

    return res.render('torneos/index', {
      partidos: partidosRaw,
      partidosPorFecha,
      torneo: torneoData,
      grupos: torneoData.Grupos,
      gruposFixture,
      equipos: torneoData.Equipos,
      entityId,
      entidadActual: entidadActual ? entidadActual.get({ plain: true }) : null,
      rol_id: req.session.rol_id,
      jugadores,
      torneos,
      selectedTorneo: torneoData.id_torneo,
      usuarios,
      usuariosAdmin,
      torneosUsuarios,
      items,
      id_torneo: torneoData.id_torneo,
      grupoSeleccionadoId,
      fechaCalendarioSeleccionada,
      estadisticasGeneral,
      estadisticasFiltradas,
      rankingGoles,
      reglaTarjetas,
      finanzasResumen,
      dashboardInicio,
      canchas: canchas.map(cancha => cancha.get({ plain: true })),
      auditoria,
      contextoAuditoria,
      //messages esto sobra comanter siempres
    });

  } catch (error) {
    console.error("Error al gestionar torneo:", error);
    req.flash("danger", "Error al gestionar torneo");
    return res.redirect('/torneos');
  }
};

exports.auditoriaResumen = async (req, res) => {
  try {
    if (![3, 99].includes(Number(req.session.rol_id))) {
      return res.status(403).json({ success: false, message: 'No tiene permisos para ver auditoria' });
    }

    const torneo = await Torneo.findByPk(req.params.id_torneo);
    if (!torneo) {
      return res.status(404).json({ success: false, message: 'Torneo no encontrado' });
    }

    if (Number(req.session.rol_id) !== 99 && Number(req.session.entity_id) !== Number(torneo.entity_id)) {
      return res.status(403).json({ success: false, message: 'No puede ver auditoria de otra entidad' });
    }

    const equipos = await Equipo.findAll({
      where: { id_torneo: torneo.id_torneo },
      attributes: ['id_equipo', 'nombre', 'icono']
    });
    const equiposPlain = equipos.map(equipo => equipo.get({ plain: true }));
    const equiposPorIdAuditoria = new Map(equiposPlain.map(equipo => [String(equipo.id_equipo), equipo.nombre]));

    const registros = await sequelize.query(`
      SELECT a.id_auditoria,
             a.id_usuario,
             a.accion,
             a.tabla_afectada,
             a.detalle,
             a.fecha_hora,
             a.entity_id,
             u.nombre AS usuario_nombre,
             u.documento AS usuario_documento
      FROM auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
      WHERE a.entity_id = :entityId
        AND (
          a.detalle->>'id_torneo' IS NULL
          OR a.detalle->>'id_torneo' = :torneoId
        )
      ORDER BY a.fecha_hora DESC, a.id_auditoria DESC
      LIMIT 250
    `, {
      replacements: {
        entityId: torneo.entity_id,
        torneoId: String(torneo.id_torneo)
      },
      type: sequelize.QueryTypes.SELECT
    });

    const auditoria = registros.map(registro => {
      const detalleObjeto = leerDetalleAuditoria(registro.detalle);
      let detalleLegible = detalleObjeto.detalle
        ? String(detalleObjeto.detalle)
        : normalizarDetalleAuditoria(registro.detalle);
      detalleLegible = reemplazarIdsEquiposEnDetalle(detalleLegible, equiposPorIdAuditoria);
      let afectado = obtenerAfectadoAuditoria(registro, detalleObjeto, detalleLegible);
      if (afectado === '-' && String(registro.tabla_afectada || '') === 'equipos') {
        afectado = obtenerEquipoPorIconoEnDetalle(detalleLegible, equiposPlain) || afectado;
      }

      return {
        id_auditoria: registro.id_auditoria,
        fecha_hora: registro.fecha_hora,
        pantalla: obtenerPantallaAuditoria(registro, detalleObjeto),
        afectado,
        accion: registro.accion || '',
        usuario_display: registro.usuario_nombre || 'Sistema',
        usuario_documento_display: registro.usuario_documento || '',
        detalle_legible: detalleLegible
      };
    });

    return res.json({ success: true, auditoria });
  } catch (error) {
    console.error('Error al obtener auditoria:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener auditoria' });
  }
};

exports.crearCancha = async (req, res) => {
  const torneoId = req.params.id_torneo;

  try {
    if (![3, 99].includes(Number(req.session.rol_id))) {
      req.flash("danger", "No tiene permisos para administrar canchas");
      return res.redirect(`/torneos/gestionar/${torneoId}#items`);
    }

    const permiso = await validarTorneoAdmin(req, torneoId);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect('/torneos');
    }
    const torneo = permiso.torneo;

    const nombre = String(req.body.nombre || '').trim();
    const direccion = String(req.body.direccion || '').trim();

    if (!nombre) {
      req.flash("warning", "Ingrese el nombre de la cancha");
      return res.redirect(`/torneos/gestionar/${torneo.id_torneo}#items`);
    }

    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    await Cancha.create({
      id_torneo: torneo.id_torneo,
      entity_id: torneo.entity_id,
      nombre,
      direccion: direccion || null,
      estado: true
    });

    req.flash("success", "Cancha agregada correctamente");
    return res.redirect(`/torneos/gestionar/${torneo.id_torneo}#items`);
  } catch (error) {
    console.error("Error al crear cancha:", error);
    req.flash("danger", "No se pudo agregar la cancha");
    return res.redirect(`/torneos/gestionar/${torneoId}#items`);
  }
};

exports.toggleCancha = async (req, res) => {
  const torneoId = req.params.id_torneo;

  try {
    if (![3, 99].includes(Number(req.session.rol_id))) {
      req.flash("danger", "No tiene permisos para administrar canchas");
      return res.redirect(`/torneos/gestionar/${torneoId}#items`);
    }

    const cancha = await Cancha.findOne({
      where: {
        id_cancha: req.params.id_cancha,
        id_torneo: torneoId
      }
    });

    if (!cancha) {
      req.flash("danger", "Cancha no encontrada");
      return res.redirect(`/torneos/gestionar/${torneoId}#items`);
    }

    if (Number(req.session.rol_id) !== 99 && Number(req.session.entity_id) !== Number(cancha.entity_id)) {
      req.flash("danger", "No puede administrar canchas de otra entidad");
      return res.redirect('/torneos');
    }

    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    cancha.estado = !cancha.estado;
    await cancha.save();

    req.flash("success", "Estado de cancha actualizado");
    return res.redirect(`/torneos/gestionar/${torneoId}#items`);
  } catch (error) {
    console.error("Error al cambiar estado de cancha:", error);
    req.flash("danger", "No se pudo actualizar la cancha");
    return res.redirect(`/torneos/gestionar/${torneoId}#items`);
  }
};

exports.actualizarCancha = async (req, res) => {
  const torneoId = req.params.id_torneo;

  try {
    if (![3, 99].includes(Number(req.session.rol_id))) {
      req.flash("danger", "No tiene permisos para administrar canchas");
      return res.redirect(`/torneos/gestionar/${torneoId}#items`);
    }

    const cancha = await Cancha.findOne({
      where: {
        id_cancha: req.params.id_cancha,
        id_torneo: torneoId
      }
    });

    if (!cancha) {
      req.flash("danger", "Cancha no encontrada");
      return res.redirect(`/torneos/gestionar/${torneoId}#items`);
    }

    if (Number(req.session.rol_id) !== 99 && Number(req.session.entity_id) !== Number(cancha.entity_id)) {
      req.flash("danger", "No puede administrar canchas de otra entidad");
      return res.redirect('/torneos');
    }

    const nombre = String(req.body.nombre || '').trim();
    const direccion = String(req.body.direccion || '').trim();

    if (!nombre) {
      req.flash("warning", "Ingrese el nombre de la cancha");
      return res.redirect(`/torneos/gestionar/${torneoId}#items`);
    }

    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    cancha.nombre = nombre;
    cancha.direccion = direccion || null;
    await cancha.save();

    req.flash("success", "Cancha actualizada correctamente");
    return res.redirect(`/torneos/gestionar/${torneoId}#items`);
  } catch (error) {
    console.error("Error al actualizar cancha:", error);
    req.flash("danger", "No se pudo actualizar la cancha");
    return res.redirect(`/torneos/gestionar/${torneoId}#items`);
  }
};

exports.actualizarPortada = async (req, res) => {
  try {
    const permiso = await validarTorneoAdmin(req, req.params.id_torneo);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect('/torneos');
    }
    const torneo = permiso.torneo;

    if (!req.file) {
      req.flash("warning", "Seleccione una imagen para la portada");
      return res.redirect(`/torneos/gestionar/${torneo.id_torneo}#estadisticas`);
    }

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }

    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: req.session.entity_id || torneo.entity_id }
    });

    torneo.portada = `/uploads/${req.file.filename}`;
    await torneo.save();

    req.flash("success", "Portada del torneo actualizada");
    return res.redirect(`/torneos/gestionar/${torneo.id_torneo}#estadisticas`);
  } catch (error) {
    console.error("Error al actualizar portada:", error);
    req.flash("danger", "Error al actualizar portada del torneo");
    return res.redirect('/torneos');
  }
};

exports.eliminarPortada = async (req, res) => {
  try {
    const permiso = await validarTorneoAdmin(req, req.params.id_torneo);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect('/torneos');
    }
    const torneo = permiso.torneo;

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }

    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: req.session.entity_id || torneo.entity_id }
    });

    torneo.portada = null;
    await torneo.save();

    req.flash("success", "Portada del torneo eliminada");
    return res.redirect(`/torneos/gestionar/${torneo.id_torneo}#estadisticas`);
  } catch (error) {
    console.error("Error al eliminar portada:", error);
    req.flash("danger", "Error al eliminar portada del torneo");
    return res.redirect('/torneos');
  }
};

exports.actualizarPermitirAgregarJugadores = async (req, res) => {
  const torneoId = req.params.id_torneo;
  try {
    const permiso = await validarTorneoAdmin(req, torneoId);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect('/torneos');
    }

    const permitir = req.body.permitir_agregar_jugadores === '1';

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }
    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: permiso.torneo.entity_id }
    });

    await sequelize.query(`
      UPDATE torneos
      SET permitir_agregar_jugadores = :permitir
      WHERE id_torneo = :torneoId
    `, {
      replacements: { permitir, torneoId }
    });

    req.flash(
      "success",
      permitir
        ? "Los delegados pueden agregar jugadores a sus equipos"
        : "Los delegados ya no pueden agregar jugadores a sus equipos"
    );
    return res.redirect(`/torneos/gestionar/${torneoId}#equipos`);
  } catch (error) {
    console.error("Error al actualizar permiso de agregar jugadores:", error);
    req.flash("danger", "No se pudo actualizar el permiso para agregar jugadores");
    return res.redirect(`/torneos/gestionar/${torneoId}#equipos`);
  }
};

exports.resumenFinanzas = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.id_torneo, 10);
    if (!torneoId) {
      return res.status(400).json({ success: false, message: 'Torneo invalido' });
    }

    if (![2, 3, 99].includes(Number(req.session.rol_id))) {
      return res.status(403).json({ success: false, message: 'No tiene permisos para ver finanzas' });
    }

    const torneo = await Torneo.findByPk(torneoId, { attributes: ['id_torneo', 'entity_id'] });
    if (!torneo) {
      return res.status(404).json({ success: false, message: 'Torneo no encontrado' });
    }

    if (Number(req.session.rol_id) !== 99 && Number(req.session.entity_id) !== Number(torneo.entity_id)) {
      return res.status(403).json({ success: false, message: 'No puede ver finanzas de otra entidad' });
    }

    const equipos = await sequelize.query(`
      SELECT e.id_equipo,
             e.nombre,
             e.icono,
             COALESCE(g.nombre_grupo, 'Sin grupo') AS nombre_grupo
      FROM equipos e
      LEFT JOIN grupos g ON g.id_grupo = e.id_grupo
      WHERE e.id_torneo = :torneoId
      ORDER BY e.nombre ASC
    `, {
      replacements: { torneoId },
      type: sequelize.QueryTypes.SELECT
    });

    const partidos = await sequelize.query(`
      SELECT p.id_partido,
             p.numero_fecha,
             p.fecha,
             p.id_grupo,
             p.equipo_a,
             p.equipo_b,
             ea.nombre AS nombre_equipo_a,
             eb.nombre AS nombre_equipo_b,
             COALESCE(g.nombre_grupo, 'Sin grupo') AS nombre_grupo
      FROM partidos p
      LEFT JOIN equipos ea ON ea.id_equipo = p.equipo_a
      LEFT JOIN equipos eb ON eb.id_equipo = p.equipo_b
      LEFT JOIN grupos g ON g.id_grupo = p.id_grupo
      WHERE p.id_torneo = :torneoId
      ORDER BY p.numero_fecha ASC, p.id_partido ASC
    `, {
      replacements: { torneoId },
      type: sequelize.QueryTypes.SELECT
    });
    const fechasUnicas = [...new Set(partidos.map(partido => partido.numero_fecha).filter(Boolean))].sort((a, b) => a - b);
    const equiposFixture = new Set();
    const [{ total_equipos: totalEquiposFixture = 0 } = {}] = await sequelize.query(`
      SELECT COUNT(*) AS total_equipos
      FROM equipos
      WHERE id_torneo = :torneoId
    `, {
      replacements: { torneoId },
      type: sequelize.QueryTypes.SELECT
    });
    const mitadFechas = Math.ceil(fechasUnicas.length / 2);
    const esIdaVueltaFinanzas = fechasUnicas.length > Math.max(Number(totalEquiposFixture || 0) - 1, 0);
    const partidosPorId = partidos.reduce((acc, partido) => {
      if (partido.equipo_a) equiposFixture.add(partido.equipo_a);
      if (partido.equipo_b) equiposFixture.add(partido.equipo_b);
      const fase = esIdaVueltaFinanzas ? obtenerEtiquetaFase('ida_vuelta', partido.numero_fecha, mitadFechas) : '';
      acc[String(partido.id_partido)] = {
        numero_fecha: partido.numero_fecha || null,
        fecha: normalizarFechaInput(partido.fecha) || null,
        equipo_a: partido.equipo_a || null,
        equipo_b: partido.equipo_b || null,
        nombre_equipo_a: partido.nombre_equipo_a || '',
        nombre_equipo_b: partido.nombre_equipo_b || '',
        nombre_grupo: partido.nombre_grupo || 'Sin grupo',
        nombre_grupo_display: fase ? `${partido.nombre_grupo || 'Sin grupo'} - ${fase}` : (partido.nombre_grupo || 'Sin grupo')
      };
      return acc;
    }, {});
    const fechaPorNumero = partidos.reduce((acc, partido) => {
      if (partido.numero_fecha && partido.fecha && !acc[String(partido.numero_fecha)]) {
        acc[String(partido.numero_fecha)] = normalizarFechaInput(partido.fecha);
      }
      return acc;
    }, {});

    const movimientosFinanzas = await sequelize.query(`
      SELECT id_finanza,
             id_equipo,
             concepto,
             tipo,
             COALESCE(monto_aportado, 0) AS monto_aportado,
             COALESCE(deuda_total, 0) AS deuda_total,
             COALESCE(deuda_inicial, 0) AS deuda_inicial,
             COALESCE(saldo, 0) AS saldo,
             fecha_registro
      FROM finanzas
      WHERE id_torneo = :torneoId
      ORDER BY id_equipo ASC, fecha_registro ASC, id_finanza ASC
    `, {
      replacements: { torneoId },
      type: sequelize.QueryTypes.SELECT
    });

    const itemsFinanzas = await sequelize.query(`
      SELECT ie.id_item_equipo,
             ie.id_equipo,
             ie.id_partido,
             ie.nombre,
             COALESCE(ie.monto, 0) AS monto,
             COALESCE(ie.cantidad, 1) AS cantidad,
             COALESCE(ie.observaciones, '') AS observaciones,
             ie.fecha_registro,
             p.numero_fecha
      FROM items_equipo ie
      LEFT JOIN partidos p ON p.id_partido = ie.id_partido
      WHERE p.id_torneo = :torneoId
         OR COALESCE(ie.observaciones, '') LIKE :marcaLike
      ORDER BY ie.id_equipo ASC, COALESCE(p.numero_fecha, 0) ASC, ie.fecha_registro ASC, ie.id_item_equipo ASC
    `, {
      replacements: { torneoId, marcaLike: `[fecha_libre:${torneoId}:%` },
      type: sequelize.QueryTypes.SELECT
    });

    const itemsPorClave = itemsFinanzas.reduce((acc, item) => {
      let clave = item.id_partido ? `partido:${item.id_partido}:equipo:${item.id_equipo}` : null;
      const matchLibre = String(item.observaciones || '').match(/^\[fecha_libre:\d+:(\d+)\]/);
      if (!clave && matchLibre) clave = `libre:${item.id_equipo}:${matchLibre[1]}`;
      if (!clave) return acc;
      if (!acc[clave]) acc[clave] = [];
      acc[clave].push({
        id_item_equipo: item.id_item_equipo,
        nombre: item.nombre || '',
        monto: Number(item.monto || 0),
        cantidad: Number(item.cantidad || 0),
        total: Number(item.monto || 0) * Number(item.cantidad || 0),
        observaciones: String(item.observaciones || '').replace(/^\[fecha_libre:\d+:\d+\]\s*/, ''),
        fecha_registro: item.fecha_registro,
        numero_fecha: item.numero_fecha || matchLibre?.[1] || null
      });
      return acc;
    }, {});

    const movimientosPorEquipo = movimientosFinanzas.reduce((acc, movimiento) => {
      const key = String(movimiento.id_equipo);
      if (!acc[key]) acc[key] = [];
      const matchPartido = String(movimiento.concepto || '').match(/^Encuentro #(\d+)/);
      const matchLibre = String(movimiento.concepto || '').match(/^Fecha libre #(\d+)/);
      const claveItems = matchPartido ? `partido:${matchPartido[1]}:equipo:${movimiento.id_equipo}` : (matchLibre ? `libre:${movimiento.id_equipo}:${matchLibre[1]}` : null);
      const partido = matchPartido ? partidosPorId[String(matchPartido[1])] : null;
      const rival = obtenerRivalFinanzas(partido, movimiento.id_equipo);
      const numeroFecha = partido?.numero_fecha || matchLibre?.[1] || null;
      const conceptoBase = movimiento.concepto || 'Movimiento';
      acc[key].push({
        id_finanza: movimiento.id_finanza,
        concepto: conceptoBase,
        concepto_display: rival ? `${conceptoBase} vs ${rival}` : conceptoBase,
        tipo: movimiento.tipo || '',
        fecha_registro: movimiento.fecha_registro,
        numero_fecha: numeroFecha,
        fecha_calendario: partido?.fecha || fechaPorNumero[String(numeroFecha || '')] || null,
        nombre_grupo: partido?.nombre_grupo || null,
        nombre_grupo_display: partido?.nombre_grupo_display || null,
        deuda_inicial: Number(movimiento.deuda_inicial || 0),
        total_items: Number(movimiento.deuda_total || 0),
        entrega: Number(movimiento.monto_aportado || 0),
        saldo: Number(movimiento.saldo || 0),
        items: claveItems ? (itemsPorClave[claveItems] || []) : []
      });
      return acc;
    }, {});

    let equiposVisibles = equipos;
    if (Number(req.session.rol_id) === 2) {
      const equiposDelegado = await sequelize.query(`
        SELECT de.id_equipo
        FROM delegados_equipos de
        INNER JOIN equipos e ON e.id_equipo = de.id_equipo
        WHERE de.id_usuario = :usuarioId
          AND e.id_torneo = :torneoId
          AND COALESCE(de.estado, true) = true
          AND COALESCE(e.estado, true) = true
      `, {
        replacements: { usuarioId: req.session.usuario_id, torneoId },
        type: sequelize.QueryTypes.SELECT
      });
      const equiposDelegadoSet = new Set(equiposDelegado.map(registro => Number(registro.id_equipo)));
      equiposVisibles = equipos.filter(equipo => equiposDelegadoSet.has(Number(equipo.id_equipo)));
    }

    const resumen = equiposVisibles.map(equipo => {
      const movimientos = recalcularMovimientosFinanzas(movimientosPorEquipo[String(equipo.id_equipo)] || []);
      const saldoActual = Number(movimientos[movimientos.length - 1]?.saldo || 0);
      return {
        id_equipo: equipo.id_equipo,
        nombre: equipo.nombre,
        icono: equipo.icono || '/images/default_team.png',
        nombre_grupo: equipo.nombre_grupo || 'Sin grupo',
        saldo_actual: saldoActual,
        adeuda: saldoActual > 0,
        total_items: movimientos.reduce((total, mov) => total + Number(mov.total_items || 0), 0),
        total_entregado: movimientos.reduce((total, mov) => total + Number(mov.entrega || 0), 0),
        movimientos
      };
    });

    return res.json({ success: true, finanzasResumen: resumen });
  } catch (error) {
    console.error('Error al obtener resumen de finanzas:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener resumen de finanzas' });
  }
};

exports.actualizarReglaTarjetas = async (req, res) => {
  try {
    const permiso = await validarTorneoAdmin(req, req.params.id_torneo);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect('/torneos');
    }
    const torneo = permiso.torneo;

    const valorCheckbox = (valor) => Array.isArray(valor)
      ? valor.includes('1')
      : valor === '1';

    const acumulaAmarillas = valorCheckbox(req.body.acumula_amarillas);
    const reiniciarAlSancionar = valorCheckbox(req.body.reiniciar_al_sancionar);
    const aplicarItemAmarilla = true;
    const aplicarItemRoja = true;
    const amarillasParaSuspension = Number.parseInt(req.body.amarillas_para_suspension, 10);
    const fechasSuspension = Number.parseInt(req.body.fechas_suspension_acumulacion, 10);

    if (!Number.isInteger(amarillasParaSuspension) || amarillasParaSuspension <= 0 ||
        !Number.isInteger(fechasSuspension) || fechasSuspension <= 0) {
      req.flash("danger", "La regla de tarjetas debe tener numeros mayores a cero");
      return res.redirect(`/torneos/gestionar/${torneo.id_torneo}#items`);
    }

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }
    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: torneo.entity_id }
    });

    await sequelize.query(`
      INSERT INTO torneos_reglas_tarjetas (
        id_torneo,
        entity_id,
        acumula_amarillas,
        amarillas_para_suspension,
        fechas_suspension_acumulacion,
        reiniciar_al_sancionar,
        aplicar_item_amarilla,
        aplicar_item_roja,
        updated_at
      )
      VALUES (
        :torneoId,
        :entityId,
        :acumulaAmarillas,
        :amarillasParaSuspension,
        :fechasSuspension,
        :reiniciarAlSancionar,
        :aplicarItemAmarilla,
        :aplicarItemRoja,
        now()
      )
      ON CONFLICT (id_torneo) DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        acumula_amarillas = EXCLUDED.acumula_amarillas,
        amarillas_para_suspension = EXCLUDED.amarillas_para_suspension,
        fechas_suspension_acumulacion = EXCLUDED.fechas_suspension_acumulacion,
        reiniciar_al_sancionar = EXCLUDED.reiniciar_al_sancionar,
        aplicar_item_amarilla = EXCLUDED.aplicar_item_amarilla,
        aplicar_item_roja = EXCLUDED.aplicar_item_roja,
        updated_at = now()
    `, {
      replacements: {
        torneoId: torneo.id_torneo,
        entityId: torneo.entity_id,
        acumulaAmarillas,
        amarillasParaSuspension,
        fechasSuspension,
        reiniciarAlSancionar,
        aplicarItemAmarilla,
        aplicarItemRoja
      }
    });

    req.flash("success", "Regla de tarjetas actualizada");
    return res.redirect(`/torneos/gestionar/${torneo.id_torneo}#items`);
  } catch (error) {
    console.error("Error al actualizar regla de tarjetas:", error);
    req.flash("danger", "No se pudo guardar la regla. Verifique que la tabla torneos_reglas_tarjetas exista.");
    return res.redirect(`/torneos/gestionar/${req.params.id_torneo}#items`);
  }
};

async function validarGestionUsuarios(req, torneoId) {
  const rolSesion = Number(req.session.rol_id);
  if (![3, 99].includes(rolSesion)) {
    return { ok: false, status: 403, message: 'No tiene permisos para administrar usuarios' };
  }

  const torneo = await Torneo.findByPk(torneoId);
  if (!torneo) {
    return { ok: false, status: 404, message: 'Torneo no encontrado' };
  }

  if (rolSesion !== 99 && Number(req.session.entity_id) !== Number(torneo.entity_id)) {
    return { ok: false, status: 403, message: 'No puede administrar usuarios de otra entidad' };
  }

  return { ok: true, torneo, rolSesion };
}

exports.toggleUsuarioAdmin = async (req, res) => {
  const torneoId = req.params.id_torneo;
  try {
    const permiso = await validarGestionUsuarios(req, torneoId);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    const usuario = permiso.rolSesion === 99
      ? await Usuario.findByPk(req.params.id_usuario)
      : await Usuario.findOne({
          where: {
            id_usuario: req.params.id_usuario,
            entity_id: permiso.torneo.entity_id
          }
        });

    if (!usuario) {
      req.flash("danger", "Usuario no encontrado en esta entidad");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (String(usuario.id_usuario) === String(req.session.usuario_id)) {
      req.flash("warning", "No puede desactivar su propio usuario desde este panel");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (permiso.rolSesion !== 99 && Number(usuario.rol_id) === 99) {
      req.flash("danger", "Un admin no puede modificar un super admin");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }
    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: permiso.torneo.entity_id }
    });

    usuario.estado = !usuario.estado;
    await usuario.save();

    req.flash("success", usuario.estado ? "Usuario activado" : "Usuario desactivado");
    return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
  } catch (error) {
    console.error("Error al cambiar estado de usuario:", error);
    req.flash("danger", "No se pudo cambiar el estado del usuario");
    return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
  }
};

exports.cambiarPermisosUsuario = async (req, res) => {
  const torneoId = req.params.id_torneo;
  try {
    const permiso = await validarGestionUsuarios(req, torneoId);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    const usuario = permiso.rolSesion === 99
      ? await Usuario.findByPk(req.params.id_usuario)
      : await Usuario.findOne({
          where: {
            id_usuario: req.params.id_usuario,
            entity_id: permiso.torneo.entity_id
          }
        });

    if (!usuario) {
      req.flash("danger", "Usuario no encontrado en esta entidad");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (String(usuario.id_usuario) === String(req.session.usuario_id)) {
      req.flash("warning", "No puede cambiar sus propios permisos desde este panel");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (permiso.rolSesion !== 99 && Number(usuario.rol_id) === 99) {
      req.flash("danger", "Un admin no puede modificar un super admin");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    const nuevoRol = Number.parseInt(req.body.rol_id, 10);
    const rolesPermitidos = permiso.rolSesion === 99 ? [1, 3, 99] : [1, 3];
    if (!rolesPermitidos.includes(nuevoRol)) {
      req.flash("danger", "No tiene permisos para asignar ese rol");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }
    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: permiso.torneo.entity_id }
    });

    usuario.rol_id = nuevoRol;
    usuario.entity_id = nuevoRol === 99 ? null : permiso.torneo.entity_id;
    await usuario.save();

    if (nuevoRol !== 2) {
      await desvincularDelegadoUsuarioEnEntidad(usuario.id_usuario, permiso.torneo.entity_id);
    }

    const nombresRol = {
      1: 'espectador',
      2: 'delegado',
      3: 'admin',
      99: 'super admin'
    };
    req.flash("success", `Permisos actualizados: ${usuario.nombre} ahora es ${nombresRol[nuevoRol] || `rol ${nuevoRol}`}`);
    return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
  } catch (error) {
    console.error("Error al cambiar permisos de usuario:", error);
    req.flash("danger", "No se pudieron cambiar los permisos del usuario");
    return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
  }
};

exports.resetearContrasenaUsuario = async (req, res) => {
  const torneoId = req.params.id_torneo;
  try {
    const permiso = await validarGestionUsuarios(req, torneoId);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    const usuario = permiso.rolSesion === 99
      ? await Usuario.findByPk(req.params.id_usuario)
      : await Usuario.findOne({
          where: {
            id_usuario: req.params.id_usuario,
            entity_id: permiso.torneo.entity_id
          }
        });

    if (!usuario) {
      req.flash("danger", "Usuario no encontrado en esta entidad");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (String(usuario.id_usuario) === String(req.session.usuario_id)) {
      req.flash("warning", "No puede resetear su propia contraseña desde este panel");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (permiso.rolSesion !== 99 && Number(usuario.rol_id) === 99) {
      req.flash("danger", "Un admin no puede resetear la contraseña de un super admin");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }
    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: permiso.torneo.entity_id }
    });

    const codigoTemporal = generarCodigoTemporal();
    usuario.contrasena_hash = await bcrypt.hash(codigoTemporal, 10);
    usuario.debe_cambiar_contrasena = true;
    usuario.reset_contrasena_en = new Date();
    await usuario.save();

    req.flash("warning", `Contraseña temporal para ${usuario.nombre}: ${codigoTemporal}. Debe cambiarla en el próximo inicio de sesión.`);
    return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
  } catch (error) {
    console.error("Error al resetear contraseña:", error);
    req.flash("danger", "No se pudo resetear la contraseña");
    return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
  }
};

exports.editarDatosUsuarioSuperAdmin = async (req, res) => {
  const torneoId = req.params.id_torneo;
  try {
    const permiso = await validarGestionUsuarios(req, torneoId);
    if (!permiso.ok) {
      req.flash("danger", permiso.message);
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (permiso.rolSesion !== 99) {
      req.flash("danger", "Solo el super admin puede editar datos de usuarios");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    const usuario = await Usuario.findByPk(req.params.id_usuario);
    if (!usuario) {
      req.flash("danger", "Usuario no encontrado");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (Number(usuario.rol_id) !== 99 && Number(usuario.entity_id) !== Number(permiso.torneo.entity_id)) {
      req.flash("danger", "No puede editar usuarios de otra entidad desde este torneo");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    const nombre = String(req.body.nombre || '').trim().toUpperCase();
    const documento = String(req.body.documento || '').trim();
    const correo = String(req.body.correo || '').trim().toLowerCase();

    if (!nombre || !documento) {
      req.flash("warning", "Nombre y documento son obligatorios");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
      req.flash("warning", "Ingrese un correo valido, por ejemplo usuario@dominio.com");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    const correoExistente = correo
      ? await Usuario.findOne({
          where: {
            correo,
            entity_id: usuario.entity_id ?? null,
            id_usuario: { [Op.ne]: usuario.id_usuario }
          }
        })
      : null;

    if (correoExistente) {
      req.flash("danger", "Ya existe otro usuario con ese correo");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    const documentoExistente = await Usuario.findOne({
      where: {
        documento,
        entity_id: usuario.entity_id ?? null,
        id_usuario: { [Op.ne]: usuario.id_usuario }
      }
    });

    if (documentoExistente) {
      req.flash("danger", "Ya existe otro usuario con ese documento en la misma entidad");
      return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
    }

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }
    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: permiso.torneo.entity_id }
    });

    usuario.nombre = nombre;
    usuario.documento = documento;
    usuario.correo = correo || null;
    await usuario.save();

    req.flash("success", "Datos del usuario actualizados");
    return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
  } catch (error) {
    console.error("Error al editar datos de usuario:", error);
    req.flash("danger", "No se pudieron actualizar los datos del usuario");
    return res.redirect(`/torneos/gestionar/${torneoId}#usuarios`);
  }
};
