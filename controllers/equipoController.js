//antes de tocar equiposcontrolller

 



//const { Equipo, Torneo, Grupo, Jugador, JugadorEquipo, DelegadoEquipo, Usuario } = require('../models');
//const { registrarAuditoria } = require('../utils/helpers');
//const { Op } = require('sequelize');
const { Equipo, Torneo, Grupo, Jugador, JugadorEquipo, DelegadoEquipo, Usuario, Partido, EquipoMovimientoGrupo, sequelize } = require('../models');
const { registrarAuditoria } = require('../utils/helpers');
const { Op } = require('sequelize');

function normalizarNombreEquipo(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ').toUpperCase();
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

async function esDelegadoDelEquipo(req, equipoId, transaction = null) {
  if (Number(req.session.rol_id) !== 2) return false;
  const [vinculo] = await sequelize.query(`
    SELECT de.id_delegado_equipo
    FROM delegados_equipos de
    WHERE de.id_usuario = :usuarioId
      AND de.id_equipo = :equipoId
      AND COALESCE(de.estado, true) = true
    LIMIT 1
  `, {
    replacements: { usuarioId: req.session.usuario_id, equipoId },
    type: sequelize.QueryTypes.SELECT,
    transaction
  });
  return Boolean(vinculo);
}

async function puedeAdministrarEquipo(req, equipo, { permitirDelegado = false, transaction = null } = {}) {
  if (!equipo) return false;
  if ([3, 99].includes(Number(req.session.rol_id))) {
    return puedeAdministrarEntidad(req, equipo.entity_id);
  }
  if (permitirDelegado) {
    return esDelegadoDelEquipo(req, equipo.id_equipo, transaction);
  }
  return false;
}

async function torneoPermiteAgregarJugadores(idTorneo) {
  try {
    const [torneo] = await sequelize.query(`
      SELECT permitir_agregar_jugadores
      FROM torneos
      WHERE id_torneo = :idTorneo
      LIMIT 1
    `, {
      replacements: { idTorneo },
      type: sequelize.QueryTypes.SELECT
    });
    return torneo?.permitir_agregar_jugadores !== false;
  } catch (error) {
    if (error?.parent?.code === '42703') return true;
    throw error;
  }
}

async function torneoPermiteModificarIconos(idTorneo) {
  try {
    const [torneo] = await sequelize.query(`
      SELECT permitir_modificar_iconos_equipo
      FROM torneos
      WHERE id_torneo = :idTorneo
      LIMIT 1
    `, {
      replacements: { idTorneo },
      type: sequelize.QueryTypes.SELECT
    });
    return torneo?.permitir_modificar_iconos_equipo === true;
  } catch (error) {
    if (error?.parent?.code === '42703') return false;
    throw error;
  }
}

async function obtenerResumenMovimientoEquipo({ nombre, id_torneo, id_grupo, entityId }) {
  const existente = await Equipo.findOne({
    where: { nombre, id_torneo, entity_id: entityId },
    include: [{ model: Grupo, as: 'Grupo', attributes: ['id_grupo', 'nombre_grupo'] }]
  });

  if (!existente) {
    return { existe: false };
  }

  if (String(existente.id_grupo) === String(id_grupo)) {
    return { existe: true, mismoGrupo: true, equipo: existente };
  }

  const grupoDestino = await Grupo.findByPk(id_grupo, { attributes: ['id_grupo', 'nombre_grupo'] });
  const partidos = await Partido.findAll({
    where: {
      id_torneo,
      id_grupo: existente.id_grupo,
      [Op.or]: [
        { equipo_a: existente.id_equipo },
        { equipo_b: existente.id_equipo }
      ]
    },
    attributes: ['id_partido', 'estado', 'goles_a', 'goles_b']
  });

  const tienePartidos = partidos.length > 0;
  const tienePuntos = partidos.some(p => {
    const golesA = Number(p.goles_a || 0);
    const golesB = Number(p.goles_b || 0);
    return p.estado !== 'programado' || golesA > 0 || golesB > 0;
  });

  return {
    existe: true,
    mismoGrupo: false,
    equipo: existente,
    grupoOrigen: existente.Grupo,
    grupoDestino,
    tienePartidos,
    tienePuntos
  };
}

function mensajeConfirmacionMovimiento(resumen) {
  const origen = resumen.grupoOrigen?.nombre_grupo || 'otro grupo';
  const destino = resumen.grupoDestino?.nombre_grupo || 'este grupo';

  if (resumen.tienePartidos || resumen.tienePuntos) {
    return `Este equipo tiene puntajes o partidos activos en ${origen}. ¿Desea mudarlo a ${destino}? Se conservará el rastro en el grupo anterior.`;
  }

  return `Este equipo está actualmente en ${origen}. ¿Desea mudarlo a ${destino}?`;
}

async function validarMudanza(req, res) {
  try {
    const { nombre_equipo, id_grupo, id_torneo, confirmar_mudanza } = req.body;
    const entityId = req.session.entity_id;
    const nombre = normalizarNombreEquipo(nombre_equipo);

    if (!nombre || !id_grupo || !id_torneo || !entityId) {
      return res.json({ ok: false, message: 'Datos incompletos para validar el equipo' });
    }

    const resumen = await obtenerResumenMovimientoEquipo({ nombre, id_torneo, id_grupo, entityId });

    if (!resumen.existe) {
      return res.json({ ok: true, requiereConfirmacion: false });
    }

    if (resumen.mismoGrupo) {
      return res.json({
        ok: false,
        bloqueado: true,
        message: `El equipo "${nombre}" ya existe en este grupo`
      });
    }

    return res.json({
      ok: true,
      requiereConfirmacion: true,
      tienePartidos: resumen.tienePartidos,
      tienePuntos: resumen.tienePuntos,
      message: mensajeConfirmacionMovimiento(resumen)
    });
  } catch (error) {
    console.error('Error al validar mudanza de equipo:', error);
    return res.status(500).json({ ok: false, message: 'No se pudo validar el equipo' });
  }
}



// Crear equipo
async function crear(req, res) {
  const t = await sequelize.transaction();
  try {
    const { nombre_equipo, id_grupo, id_torneo, confirmar_mudanza } = req.body;
    const entityId = req.session.entity_id;

    if (!nombre_equipo || !id_grupo || !id_torneo) {
      req.flash("danger", "Datos incompletos para crear equipo");
      return res.redirect(`/torneos/gestionar/${id_torneo}#grupos`);
    }

    const torneo = await Torneo.findByPk(id_torneo, { attributes: ['id_torneo', 'entity_id'], transaction: t });
    if (!torneo || !puedeAdministrarEntidad(req, torneo.entity_id)) {
      await t.rollback();
      req.flash("danger", "No puede crear equipos en otra entidad");
      return res.redirect('/torneos');
    }

    const nombre = normalizarNombreEquipo(nombre_equipo);
    const partidosGrupo = await Partido.count({
      where: {
        id_torneo,
        id_grupo
      },
      transaction: t
    });

    // 🔑 Setear variables de sesión para auditoría
    if (req.session.usuario_id) {
      await sequelize.query(
        "SET LOCAL app.usuario_id = :usuarioId",
        { replacements: { usuarioId: req.session.usuario_id }, transaction: t }
      );
    }
    if (req.session.entity_id) {
      await sequelize.query(
        "SET LOCAL app.entity_id = :entityId",
        { replacements: { entityId: req.session.entity_id }, transaction: t }
      );
    }

    // 🔎 Validar duplicado a nivel torneo + entidad
    const resumenMovimiento = await obtenerResumenMovimientoEquipo({ nombre, id_torneo, id_grupo, entityId });

    if (resumenMovimiento.existe && resumenMovimiento.mismoGrupo) {
      await t.rollback();
      req.flash("warning", `El equipo "${nombre}" ya existe en este grupo`);
      return res.redirect(`/torneos/gestionar/${id_torneo}#grupos`);
    }

    if (resumenMovimiento.existe && !resumenMovimiento.mismoGrupo) {
      // 👉 Si ya existe en otro grupo, actualizar su grupo
      if (String(confirmar_mudanza) !== '1') {
        await t.rollback();
        req.flash("warning", "La mudanza del equipo requiere confirmaciÃ³n");
        return res.redirect(`/torneos/gestionar/${id_torneo}#grupos`);
      }

      const equipo = await Equipo.findByPk(resumenMovimiento.equipo.id_equipo, { transaction: t });
      const origen = resumenMovimiento.grupoOrigen?.nombre_grupo || 'grupo anterior';
      const destino = resumenMovimiento.grupoDestino?.nombre_grupo || 'grupo destino';
      const observacion = `Se cambio de ${origen} a ${destino}`;

      if (resumenMovimiento.tienePartidos || resumenMovimiento.tienePuntos) {
        await EquipoMovimientoGrupo.create({
          id_equipo: equipo.id_equipo,
          id_torneo: equipo.id_torneo,
          id_grupo_origen: equipo.id_grupo,
          id_grupo_destino: id_grupo,
          observacion,
          id_usuario: req.session.usuario_id || null,
          entity_id: equipo.entity_id
        }, { transaction: t });
      }

      await equipo.update({ id_grupo }, { transaction: t });
      req.flash(
        partidosGrupo > 0 ? "info" : "success",
        partidosGrupo > 0
          ? `Debe hacer los cruces manualmente para este equipo - Agregado correctamente`
          : `Equipo "${nombre}" ya existía, se movió al nuevo grupo`
      );
    } else {
      // 👉 Crear equipo nuevo
      await Equipo.create(
        { nombre, id_torneo, id_grupo, entity_id: entityId, estado: true },
        { transaction: t }
      );
      req.flash(
        partidosGrupo > 0 ? "info" : "success",
        partidosGrupo > 0
          ? "Debe hacer los cruces manualmente para este equipo - Agregado correctamente"
          : "Equipo creado con éxito"
      );
    }

    await t.commit();
    res.redirect(`/torneos/gestionar/${id_torneo}#grupos`);
  } catch (error) {
    await t.rollback();
    console.error("Error al crear equipo:", error);
    req.flash("danger", "Error al crear equipo");
    res.redirect(`/torneos/gestionar/${req.body.id_torneo}#grupos`);
  }
}


// Eliminar o desactivar equipo
async function eliminar(req, res) {
  let redirectUrl = '/torneos';
  try {
    const redirectHash = req.body.redirect_hash || '#equipos';
    const equipo = await Equipo.findByPk(req.params.id_equipo);
    if (!equipo) {
      req.flash("danger", "Equipo no encontrado");
      return res.redirect('/torneos');
    }
    redirectUrl = `/torneos/gestionar/${equipo.id_torneo}${redirectHash}`;

    if (!(await puedeAdministrarEquipo(req, equipo))) {
      req.flash("danger", "No puede eliminar equipos de otra entidad");
      return res.redirect('/torneos');
    }

    const partidosAlineados = await Partido.count({
      where: {
        id_torneo: equipo.id_torneo,
        [Op.or]: [
          { equipo_a: equipo.id_equipo },
          { equipo_b: equipo.id_equipo }
        ]
      }
    });

    if (partidosAlineados > 0) {
      req.flash(
        "warning",
        "No se puede eliminar equipo ya que cuenta con encuentros alineados, puede ir a equipos y desactivarlo sin borrar el Historial"
      );
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}${redirectHash}`);
    }

    const bloqueosEliminacion = [];

    const delegadosVinculados = await DelegadoEquipo.count({
      where: { id_equipo: equipo.id_equipo }
    });
    if (delegadosVinculados > 0) {
      bloqueosEliminacion.push('delegados asignados');
    }

    const jugadoresVinculados = await JugadorEquipo.count({
      where: { id_equipo: equipo.id_equipo }
    });
    if (jugadoresVinculados > 0) {
      bloqueosEliminacion.push('jugadores asignados');
    }

    const [cargasEquipo] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM items_equipo WHERE id_equipo = :equipoId) AS items,
        (SELECT COUNT(*) FROM finanzas WHERE id_equipo = :equipoId) AS finanzas
    `, {
      replacements: { equipoId: equipo.id_equipo },
      type: sequelize.QueryTypes.SELECT
    });

    if (Number(cargasEquipo?.items || 0) > 0 || Number(cargasEquipo?.finanzas || 0) > 0) {
      bloqueosEliminacion.push('items o finanzas generados');
    }

    const movimientosGrupo = await EquipoMovimientoGrupo.count({
      where: { id_equipo: equipo.id_equipo }
    });
    if (movimientosGrupo > 0) {
      bloqueosEliminacion.push('historial de cambios de grupo');
    }

    if (bloqueosEliminacion.length > 0) {
      req.flash(
        "warning",
        `No se puede eliminar el equipo "${equipo.nombre}" porque tiene ${bloqueosEliminacion.join(', ')}. Quite esos datos o desactive el equipo para conservar el historial.`
      );
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}${redirectHash}`);
    }

    if (req.session.usuario_id) {
      await sequelize.query('SET app.usuario_id = :usuarioId', {
        replacements: { usuarioId: req.session.usuario_id }
      });
    }

    if (req.session.entity_id || equipo.entity_id) {
      await sequelize.query('SET app.entity_id = :entityId', {
        replacements: { entityId: req.session.entity_id || equipo.entity_id }
      });
    }

    await equipo.destroy();
    req.flash("success", "Equipo eliminado correctamente");
    return res.redirect(`/torneos/gestionar/${equipo.id_torneo}${redirectHash}`);
  } catch (error) {
    console.error(error);
    req.flash("danger", "No se pudo eliminar el equipo. Revise si tiene encuentros, jugadores, delegados, finanzas, items o historial asociado.");
    res.redirect(redirectUrl);
  }
}
// Formulario de edición
async function editarForm(req, res) {
  try {
    const equipo = await Equipo.findByPk(req.params.id_equipo);
    if (!equipo) {
      req.flash("danger", "Equipo no encontrado");
      return res.redirect('/torneos');
    }
    if (!(await puedeAdministrarEquipo(req, equipo))) {
      req.flash("danger", "No puede editar equipos de otra entidad");
      return res.redirect('/torneos');
    }
    res.render('equipos/editar', { equipo });
  } catch (error) {
    console.error(error);
    req.flash("danger", "Error al cargar formulario de edición");
    res.redirect('/torneos');
  }
}

// Editar equipo
async function editar(req, res) {
  try {
    const equipo = await Equipo.findByPk(req.params.id_equipo);
    if (!equipo) {
      req.flash("danger", "Equipo no encontrado");
      return res.redirect('/torneos');
    }

    let nombre = req.body.nombre_equipo.toUpperCase();

    const duplicado = await Equipo.findOne({
      where: {
        nombre,
        id_torneo: equipo.id_torneo,
        entity_id: equipo.entity_id,
        id_equipo: { [Op.ne]: equipo.id_equipo }
      }
    });
    if (duplicado) {
      req.flash("warning", "Ya existe otro equipo con ese nombre en este torneo");
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}`);
    }

    equipo.nombre = nombre;
    equipo.estado = req.body.estado ? true : false;
    await setAuditContext(req, equipo.entity_id);
    await equipo.save();

    await registrarAuditoria(
      req.session.usuario_id,
      req.session.documento,
      "equipos",
      "UPDATE",
      { nombre },
      req.session.entity_id
    );

    req.flash("success", "Equipo actualizado con éxito");
    res.redirect(`/torneos/gestionar/${equipo.id_torneo}`);
  } catch (error) {
    console.error(error);
    req.flash("danger", "Error al editar equipo");
    res.redirect(`/torneos/gestionar/${req.body.id_torneo}`);
  }
}

// Toggle estado
async function toggle(req, res) {
  try {
    const equipo = await Equipo.findByPk(req.params.id_equipo);
    if (!equipo) {
      req.flash("danger", "Equipo no encontrado");
      return res.redirect('/torneos');
    }

    if (!(await puedeAdministrarEquipo(req, equipo))) {
      req.flash("danger", "No puede editar equipos de otra entidad");
      return res.redirect('/torneos');
    }

    const vaADesactivar = equipo.estado === true;
    const partidosPendientes = vaADesactivar
      ? await Partido.count({
          where: {
            id_torneo: equipo.id_torneo,
            id_grupo: equipo.id_grupo,
            estado: { [Op.ne]: 'finalizado' },
            [Op.or]: [
              { equipo_a: equipo.id_equipo },
              { equipo_b: equipo.id_equipo }
            ]
          }
        })
      : 0;

    if (vaADesactivar && partidosPendientes > 0 && req.body.confirmar_desactivacion !== '1') {
      req.flash(
        "warning",
        "Este equipo tiene cargados partidos en curso, pendientes o en proceso. Confirme la desactivacion para continuar."
      );
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
    }

    equipo.estado = !equipo.estado;
    await setAuditContext(req, equipo.entity_id);
    await equipo.save();

    await registrarAuditoria(
      req.session.usuario_id,
      req.session.documento,
      "equipos",
      "UPDATE",
      { estado: equipo.estado },
      req.session.entity_id
    );

    req.flash("info", `Equipo ${equipo.estado ? "activado" : "desactivado"}`);
    res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
  } catch (error) {
    console.error(error);
    req.flash("danger", "Error al cambiar estado del equipo");
    res.redirect('/torneos');
  }
}

async function administrar(req, res) {
  try {
    const equipo = await Equipo.findByPk(req.params.id_equipo, {
      include: [
        { 
          model: Jugador, 
          as: 'Jugadores',
          through: { 
            attributes: [
              'numero_camiseta', 
              'capitan', 
              'fecha_inicio', 
              'tipo_vinculo', 
              'estado' // 👈 estado del vínculo
            ] 
          }
        },
        { 
          model: DelegadoEquipo, 
          as: 'Delegados', 
          include: [{ 
            model: Usuario, 
            as: 'Usuario',
            attributes: ['id_usuario', 'nombre', 'documento']
          }] 
        }
      ]
    });

    if (!equipo) {
      req.flash("danger", "Equipo no encontrado");
      return res.redirect('/torneos');
    }

    if (!(await puedeAdministrarEquipo(req, equipo, { permitirDelegado: true }))) {
      req.flash("danger", "No puede modificar equipos de otra entidad");
      return res.redirect('/torneos');
    }

    if (!equipo.estado) {
      req.flash("warning", "Este equipo está desactivado y no puede administrarse");
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
    }

    if (Number(req.session.rol_id) === 2) {
      const vinculoDelegado = await sequelize.query(`
        SELECT de.id_delegado_equipo
        FROM delegados_equipos de
        WHERE de.id_usuario = :usuarioId
          AND de.id_equipo = :equipoId
          AND COALESCE(de.estado, true) = true
        LIMIT 1
      `, {
        replacements: {
          usuarioId: req.session.usuario_id,
          equipoId: equipo.id_equipo
        },
        type: sequelize.QueryTypes.SELECT
      });

      if (vinculoDelegado.length === 0) {
        req.flash("danger", "Solo puede administrar el equipo al que esta vinculado como delegado");
        return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
      }
    }

    if (![2, 3, 99].includes(Number(req.session.rol_id))) {
      req.flash("danger", "No tiene permisos para administrar equipos");
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
    }

    req.session.torneo_id = equipo.id_torneo;
    if (!req.session.entity_id && equipo.entity_id) {
      req.session.entity_id = equipo.entity_id;
    }
    const permitirAgregarJugadores = await torneoPermiteAgregarJugadores(equipo.id_torneo);
    const permitirModificarIconos = await torneoPermiteModificarIconos(equipo.id_torneo);

    const idsJugadoresEquipo = (equipo.Jugadores || []).map(jugador => jugador.id_jugador).filter(Boolean);
    const sancionesPendientes = idsJugadoresEquipo.length > 0
      ? await sequelize.query(`
          SELECT DISTINCT ON (s.id_jugador)
                 s.id_jugador,
                 s.partidos_restantes,
                 s.observaciones
          FROM sanciones s
          INNER JOIN partidos p ON p.id_partido = s.id_partido
          WHERE p.id_torneo = :torneoId
            AND s.id_jugador IN (:jugadorIds)
            AND COALESCE(s.partidos_restantes, 0) > 0
          ORDER BY s.id_jugador, s.fecha_registro DESC, s.id_sancion DESC
        `, {
          replacements: { torneoId: equipo.id_torneo, jugadorIds: idsJugadoresEquipo },
          type: sequelize.QueryTypes.SELECT
        })
      : [];

    const sancionesPorJugador = new Map(sancionesPendientes.map(sancion => [
      Number(sancion.id_jugador),
      sancion
    ]));

    (equipo.Jugadores || []).forEach(jugador => {
      const sancion = sancionesPorJugador.get(Number(jugador.id_jugador));
      jugador.setDataValue('sancion_partidos_restantes', sancion ? Number(sancion.partidos_restantes || 0) : 0);
      jugador.setDataValue('sancion_observaciones', sancion?.observaciones || '');
    });

    const usuarios = await sequelize.query(`
      SELECT u.id_usuario,
             u.nombre,
             u.correo,
             u.documento,
             u.rol_id,
             u.estado,
             CASE
               WHEN de.id_usuario IS NOT NULL THEN 'Delegado - ' || e.nombre
               WHEN u.estado = false THEN 'Pendiente'
               ELSE 'Libre'
             END AS vinculo,
             CASE
               WHEN u.rol_id IN (1, 2) AND de.id_usuario IS NULL THEN true
               ELSE false
             END AS puede_asignar_delegado
      FROM usuarios u
      LEFT JOIN delegados_equipos de 
             ON de.id_usuario = u.id_usuario
            AND de.id_equipo IN (
                SELECT id_equipo 
                FROM equipos 
                WHERE id_torneo = $2
            )
            AND COALESCE(de.estado, true) = true
      LEFT JOIN equipos e ON e.id_equipo = de.id_equipo
      WHERE u.entity_id = $1;
    `, {
      bind: [req.session.entity_id, equipo.id_torneo],
      type: sequelize.QueryTypes.SELECT
    });

    res.render('equipos/administrar', {
      equipo,
      usuarios,
      rol_id: req.session.rol_id,
      id_torneo: equipo.id_torneo,
      jugadores: equipo.Jugadores || [],
      delegados: equipo.Delegados || [],
      permitirAgregarJugadores,
      permitirModificarIconos,
    });
  } catch (error) {
    console.error("Error al administrar equipo:", error);
    req.flash("danger", "Error al cargar administración de equipo");
    res.redirect('/torneos');
  }
}


async function actualizarIcono(req, res) {
  try {
    const { id_equipo } = req.params;
    const archivo = req.file;

    const equipo = await Equipo.findByPk(id_equipo);
    if (!equipo) {
      req.flash("danger", "Equipo no encontrado");
      return res.redirect('/equipos');
    }

    if (!(await puedeAdministrarEquipo(req, equipo, { permitirDelegado: true }))) {
      req.flash("danger", "No puede actualizar equipos de otra entidad");
      return res.redirect('/torneos');
    }

    if (Number(req.session.rol_id) === 2 && !(await torneoPermiteModificarIconos(equipo.id_torneo))) {
      req.flash("danger", "El torneo no permite que los delegados modifiquen iconos de sus equipos");
      return res.redirect(`/equipos/administrar/${id_equipo}`);
    }

    if (!archivo) {
      req.flash("warning", "Seleccione una imagen para actualizar el icono");
      return res.redirect(`/equipos/administrar/${id_equipo}`);
    }

    await setAuditContext(req, equipo.entity_id || req.session.entity_id);

    equipo.icono = `/uploads/${archivo.filename}`;
    await equipo.save();

    req.flash("success", "Icono actualizado correctamente");
    res.redirect(`/equipos/administrar/${id_equipo}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al actualizar icono');
  }
}




async function buscarUsuariosEntidad(req, res) {
  const { query, id_torneo } = req.body;
  const entityId = req.session.entity_id;

  console.log("🟢 FORM BODY:", req.body);
  console.log("🟢 Valor recibido en búsqueda:", query);
  console.log("🟢 Entity ID:", entityId);
  console.log("🟢 Torneo ID:", id_torneo);

  try {
    let usuarios;

    if (id_torneo) {
      // ✅ Con torneo: filtra vínculos por torneo
      usuarios = await sequelize.query(`
        SELECT u.id_usuario,
               u.nombre,
               u.correo,
               u.documento,
               u.rol_id,
               u.estado,
               CASE
                 WHEN de.id_usuario IS NOT NULL THEN 'Delegado - ' || e.nombre
                 WHEN u.estado = false THEN 'Pendiente'
                 ELSE 'Libre'
               END AS vinculo,
               CASE
                 WHEN u.rol_id IN (1, 2) AND de.id_usuario IS NULL THEN true
                 ELSE false
               END AS puede_asignar_delegado
        FROM usuarios u
        LEFT JOIN delegados_equipos de 
               ON de.id_usuario = u.id_usuario
              AND de.id_equipo IN (
                  SELECT id_equipo 
                  FROM equipos 
                  WHERE id_torneo = $2
              )
              AND COALESCE(de.estado, true) = true
        LEFT JOIN equipos e ON e.id_equipo = de.id_equipo
        WHERE u.entity_id = $1
          AND (u.documento ILIKE $3 OR u.nombre ILIKE $3);
      `, {
        bind: [entityId, id_torneo, `%${query}%`],
        type: sequelize.QueryTypes.SELECT
      });
    } else {
      // ⚠️ Sin torneo: devuelve usuarios sin filtrar vínculos
      usuarios = await sequelize.query(`
        SELECT u.id_usuario,
               u.nombre,
               u.correo,
               u.documento,
               u.rol_id,
               u.estado,
               CASE WHEN u.estado = false THEN 'Pendiente' ELSE 'Libre' END AS vinculo,
               CASE WHEN u.rol_id IN (1, 2) THEN true ELSE false END AS puede_asignar_delegado
        FROM usuarios u
        WHERE u.entity_id = $1
          AND (u.documento ILIKE $2 OR u.nombre ILIKE $2);
      `, {
        bind: [entityId, `%${query}%`],
        type: sequelize.QueryTypes.SELECT
      });
    }

    res.render('partials/listaUsuarios', { usuarios, id_torneo });
  } catch (error) {
    console.error("Error en buscarUsuariosEntidad:", error);
    res.status(500).send("Error en búsqueda de usuarios");
  }
}

async function ver(req, res) {
  try {
    const equipo = await Equipo.findByPk(req.params.id_equipo, {
      include: [
        {
          model: Jugador,
          as: 'Jugadores',
          through: {
            attributes: ['numero_camiseta', 'capitan', 'tipo_vinculo', 'estado']
          }
        },
        { model: DelegadoEquipo, as: 'Delegados', include: [{ model: Usuario, as: 'Usuario' }] }
      ]
    });

    if (!equipo) {
      req.flash("danger", "Equipo no encontrado");
      return res.redirect('/torneos');
    }

    res.render('equipos/ver', {
      equipo,
      jugadores: equipo.Jugadores || [],
      delegados: equipo.Delegados || [],
      returnUrl: req.query.returnUrl || `/torneos/gestionar/${equipo.id_torneo}#equipos`
    });
  } catch (error) {
    console.error("Error al ver alineaciones:", error);
    req.flash("danger", "Error al cargar alineaciones del equipo");
    res.redirect('/torneos');
  }
}







// -----------------------------
// BÚSQUEDAS
// -----------------------------

// Buscar usuarios (para delegados)



// -----------------------------
// ASIGNAR / DESVINCULAR DELEGADOS
// -----------------------------

async function actualizarRolDelegadoSegunVinculos(id_usuario, entity_id = null) {
  const vinculosActivos = await sequelize.query(`
    SELECT 1
    FROM delegados_equipos de
    INNER JOIN equipos e ON e.id_equipo = de.id_equipo
    INNER JOIN torneos t ON t.id_torneo = e.id_torneo
    WHERE de.id_usuario = $1
      AND t.estado = true
      AND COALESCE(e.estado, true) = true
      AND COALESCE(de.estado, true) = true
      ${entity_id ? 'AND e.entity_id = $2' : ''}
    LIMIT 1
  `, {
    bind: entity_id ? [id_usuario, entity_id] : [id_usuario],
    type: sequelize.QueryTypes.SELECT
  });

  if (vinculosActivos.length > 0) {
    await sequelize.query(`
      UPDATE usuarios
      SET rol_id = 2,
          estado = true
      WHERE id_usuario = $1
        AND rol_id IN (1, 2)
    `, {
      bind: [id_usuario],
      type: sequelize.QueryTypes.UPDATE
    });
  } else {
    await sequelize.query(`
      UPDATE usuarios
      SET rol_id = 1,
          estado = false
      WHERE id_usuario = $1
        AND rol_id IN (1, 2)
    `, {
      bind: [id_usuario],
      type: sequelize.QueryTypes.UPDATE
    });
  }
}

async function eliminarIcono(req, res) {
  const { id_equipo } = req.params;

  try {
    const equipo = await Equipo.findByPk(id_equipo);
    if (!equipo) {
      req.flash("danger", "Equipo no encontrado");
      return res.redirect('/equipos');
    }

    if (!(await puedeAdministrarEquipo(req, equipo, { permitirDelegado: true }))) {
      req.flash("danger", "No puede actualizar equipos de otra entidad");
      return res.redirect('/torneos');
    }

    if (Number(req.session.rol_id) === 2 && !(await torneoPermiteModificarIconos(equipo.id_torneo))) {
      req.flash("danger", "El torneo no permite que los delegados modifiquen iconos de sus equipos");
      return res.redirect(`/equipos/administrar/${id_equipo}`);
    }

    await setAuditContext(req, equipo.entity_id || req.session.entity_id);

    equipo.icono = '/images/default_team.png';
    await equipo.save();

    req.flash("success", "Icono personalizado eliminado");
    return res.redirect(`/equipos/administrar/${id_equipo}`);
  } catch (error) {
    console.error("Error al eliminar icono:", error);
    req.flash("danger", "Error al eliminar icono");
    return res.redirect(`/equipos/administrar/${id_equipo}`);
  }
}

async function asignarDelegados(req, res) {
  const id_equipo = req.body.id_equipo;
  const delegados = Array.isArray(req.body.delegados)
    ? req.body.delegados
    : (req.body.delegados ? [req.body.delegados] : []);

  try {
    if (Number(req.session.rol_id) === 2) {
      req.flash('error', 'Un delegado no puede asignar otros delegados');
      return res.redirect(`/equipos/administrar/${id_equipo}`);
    }

    // Setear usuario en la sesión de auditoría
    if (req.session.usuario_id) {
      await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    }

    const equipo = await Equipo.findByPk(id_equipo, {
      attributes: ['id_equipo', 'id_torneo', 'entity_id']
    });

    if (!equipo) {
      req.flash('error', 'Equipo no encontrado');
      return res.redirect('/torneos');
    }

    if (!(await puedeAdministrarEquipo(req, equipo))) {
      req.flash('danger', 'No puede asignar delegados a este equipo');
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
    }

    const entity_id = equipo.entity_id;
    const id_torneo = equipo.id_torneo;

    // Setear entity_id en la sesión de auditoría
    if (entity_id) {
      await sequelize.query("SET app.entity_id = '" + entity_id + "'");
    }

    let asignados = 0;

    for (const id_usuario of delegados) {
      // Validar que no esté ya delegado en otro equipo del mismo torneo
      const usuarioLibre = await sequelize.query(`
        SELECT u.id_usuario
        FROM usuarios u
        WHERE u.id_usuario = $1
          AND u.entity_id = $2
          AND u.rol_id IN (1, 2)
          AND NOT EXISTS (
            SELECT 1
            FROM delegados_equipos de
            JOIN equipos e ON e.id_equipo = de.id_equipo
            WHERE de.id_usuario = u.id_usuario
              AND e.id_torneo = $3
              AND COALESCE(de.estado, true) = true
          )
        LIMIT 1
      `, { bind: [id_usuario, entity_id, id_torneo], type: sequelize.QueryTypes.SELECT });

      if (usuarioLibre.length === 0) {
        continue;
      }

      await sequelize.query(`
        INSERT INTO delegados_equipos (id_equipo, id_usuario)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, { bind: [id_equipo, id_usuario], type: sequelize.QueryTypes.INSERT });

      await actualizarRolDelegadoSegunVinculos(id_usuario, entity_id);
      asignados += 1;
    }

    req.flash(asignados > 0 ? 'success' : 'warning', asignados > 0 ? 'Delegados asignados correctamente' : 'Solo se pueden asignar usuarios sin vinculo de delegado en este torneo');
    res.redirect(`/equipos/administrar/${id_equipo}`);
  } catch (error) {
    console.error("Error en asignarDelegados:", error);
    req.flash('error', 'No se pudo asignar delegados');
    res.redirect(`/equipos/administrar/${id_equipo}`);
  }
}


async function desvincularDelegado(req, res) {
  const { id_usuario, id_equipo } = req.body;

  try {
    if (Number(req.session.rol_id) === 2) {
      req.flash('error', 'Un delegado no puede desvincular delegados');
      return res.redirect(`/equipos/administrar/${id_equipo}`);
    }

    const equipo = await Equipo.findByPk(id_equipo, {
      attributes: ['id_equipo', 'id_torneo', 'entity_id']
    });

    if (!equipo) {
      req.flash('error', 'Equipo no encontrado');
      return res.redirect('/torneos');
    }

    if (!(await puedeAdministrarEquipo(req, equipo))) {
      req.flash('danger', 'No puede desvincular delegados de este equipo');
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
    }

    const entityIdContexto = equipo.entity_id || req.session.entity_id;

    // Setear variables de sesión para el trigger de auditoría
    if (req.session.usuario_id) {
      await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    }
    if (entityIdContexto) {
      await sequelize.query("SET app.entity_id = '" + entityIdContexto + "'");
    }

    // Validar que efectivamente exista la relación antes de eliminar
    const existe = await sequelize.query(`
      SELECT 1
      FROM delegados_equipos
      WHERE id_equipo = $1 AND id_usuario = $2
    `, { bind: [id_equipo, id_usuario], type: sequelize.QueryTypes.SELECT });

    if (existe.length > 0) {
      await sequelize.query(`
        DELETE FROM delegados_equipos
        WHERE id_equipo = $1 AND id_usuario = $2
      `, { bind: [id_equipo, id_usuario], type: sequelize.QueryTypes.DELETE });

      await actualizarRolDelegadoSegunVinculos(id_usuario, entityIdContexto);

      req.flash('info', 'Delegado desvinculado correctamente');
    } else {
      req.flash('error', 'El usuario no estaba asignado como delegado en este equipo');
    }

    res.redirect(`/equipos/administrar/${id_equipo}`);
  } catch (error) {
    console.error("Error en desvincularDelegado:", error);
    req.flash('error', 'No se pudo desvincular al delegado');
    res.redirect(`/equipos/administrar/${id_equipo}`);
  }
}


// Listar equipos y grupos del torneo
async function listar(req, res) {
  try {
    const torneoId = parseInt(req.params.id_torneo, 10);
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

    res.render('equipos/administrar', {
      torneo,
      grupos: torneo.Grupos
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener grupos y equipos');
  }
}

// -----------------------------
// ASIGNAR / DESVINCULAR JUGADORES
// -----------------------------

  // Buscar jugadores para la seccion de agregar jugadores
  async function buscarJugadores(req, res) {
    const { query, id_torneo } = req.body;
    const entityId = req.session.entity_id;

  //console.log('📌 BuscarJugadores → entityId:', entityId, 'id_torneo:', id_torneo, 'query:', query);

    const jugadores = await sequelize.query(`
SELECT j.id_jugador,
       j.nombre,
       j.apellido,
       j.documento,
       je.numero_camiseta AS numero_camiseta,
       je.tipo_vinculo,
       je.capitan AS capitan,
       TO_CHAR(je.fecha_inicio, 'DD/MM/YYYY') AS fecha_inicio,
       je.estado AS estado_vinculo,
       CASE
         WHEN je.id_jugador IS NOT NULL THEN 'Asignado - ' || e.nombre
         ELSE 'Libre'
       END AS vinculo,
       CASE
         WHEN je.id_jugador IS NOT NULL OR je.estado = false THEN true
         ELSE false
       END AS deshabilitar_checkbox
FROM jugadores j
LEFT JOIN jugadores_equipos je
       ON je.id_jugador = j.id_jugador
      AND je.id_equipo IN (
          SELECT id_equipo
          FROM equipos
          WHERE id_torneo = $2
          
      )
LEFT JOIN equipos e ON e.id_equipo = je.id_equipo
WHERE j.entity_id = $1
  AND j.estado = true
  AND ($3 = '' OR j.documento ILIKE $3 OR j.nombre ILIKE $3 OR j.apellido ILIKE $3);

    `, {
      bind: [entityId, id_torneo, `%${query}%`],
      type: sequelize.QueryTypes.SELECT
    });

    res.render('partials/listaJugadores', { jugadores, id_torneo });
  }


// Agregar jugador
async function agregarJugador(req, res) {
  try {
    const { documento, tipo_vinculo, fecha_fin } = req.body;
    const equipoId = req.params.equipo_id;

    if (Number(req.session.rol_id) === 2 && tipo_vinculo === 'prestamo') {
      req.flash("danger", "Un delegado no puede agregar jugadores de prestamo");
      return res.redirect(`/equipos/${equipoId}`);
    }

    if (req.session.usuario_id) {
      await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    }

    const jugador = await Jugador.findOne({ where: { documento } });
    const equipo = await Equipo.findByPk(equipoId);

    if (!jugador) {
      req.flash("danger", "Jugador no registrado");
      return res.redirect(`/equipos/${equipoId}`);
    }

    const jugadorEnTorneo = await JugadorEquipo.findOne({
      include: [{ model: Equipo }],
      where: { jugador_id: jugador.id_jugador, estado: true }
    });

    if (jugadorEnTorneo && tipo_vinculo !== "prestamo") {
      req.flash("warning", "Jugador ya pertenece a otro equipo en este torneo");
      return res.redirect(`/equipos/${equipoId}`);
    }

    // ✅ Aquí sí va el create con await
    await JugadorEquipo.create({
      jugador_id: jugador.id_jugador,
      equipo_id: equipoId,
       id_torneo: req.session.torneo_id, 
      tipo_vinculo: tipo_vinculo || "titular",
      fecha_inicio: new Date(),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
      estado: true
    });

    await registrarAuditoria(
      req.session.usuario_id,
      req.session.documento,
      "jugadores_equipos",
      "INSERT",
      { equipo_id: equipoId },
      req.session.entity_id
    );

    req.flash("success", "Jugador agregado correctamente");
    res.redirect(`/equipos/${equipoId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al agregar jugador al equipo');
  }
}



async function asignarJugadores(req, res) {
  const { id_equipo } = req.body;
  const jugadores = Array.isArray(req.body.jugadores)
    ? req.body.jugadores
    : (req.body.jugadores ? [req.body.jugadores] : []);

  try {
    const equipo = await Equipo.findByPk(id_equipo);
    if (!equipo) {
      req.flash('error', 'Equipo no encontrado');
      return res.redirect('/torneos');
    }

    if (!(await puedeAdministrarEquipo(req, equipo, { permitirDelegado: true }))) {
      req.flash('danger', 'No puede asignar jugadores a este equipo');
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
    }

    if (Number(req.session.rol_id) === 2 && !(await torneoPermiteAgregarJugadores(equipo.id_torneo))) {
      req.flash('danger', 'El torneo no permite que los delegados agreguen jugadores a sus equipos');
      return res.redirect(`/equipos/administrar/${id_equipo}`);
    }

    if (req.session.usuario_id) {
      await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    }
    if (equipo.entity_id) {
      await sequelize.query("SET app.entity_id = '" + equipo.entity_id + "'");
    }

    for (const id_jugador of jugadores) {
      await sequelize.query(`
        WITH vinculo_existente AS (
          SELECT id_jugador_equipo
          FROM jugadores_equipos
          WHERE id_jugador = $1
            AND id_torneo = $3
            AND (
              id_equipo = $2
              OR id_equipo IS NULL
              OR estado = false
              OR NOT EXISTS (
                SELECT 1
                FROM equipos e
                WHERE e.id_equipo = jugadores_equipos.id_equipo
                  AND e.id_torneo = $3
              )
            )
          ORDER BY estado DESC, id_jugador_equipo DESC
          LIMIT 1
        ),
        vinculo_actualizado AS (
          UPDATE jugadores_equipos je
          SET id_equipo = $2,
              tipo_vinculo = COALESCE(je.tipo_vinculo, 'titular'),
              fecha_inicio = COALESCE(je.fecha_inicio, CURRENT_DATE),
              fecha_fin = NULL,
              estado = true
          FROM vinculo_existente ve
          WHERE je.id_jugador_equipo = ve.id_jugador_equipo
          RETURNING je.id_jugador_equipo
        )
        INSERT INTO jugadores_equipos (id_jugador, id_equipo, id_torneo, tipo_vinculo, fecha_inicio, estado)
        SELECT $1, $2, $3, 'titular', CURRENT_DATE, true
        WHERE NOT EXISTS (SELECT 1 FROM vinculo_actualizado)
          AND NOT EXISTS (
            SELECT 1
            FROM jugadores_equipos
            WHERE id_jugador = $1
              AND id_torneo = $3
              AND estado = true
              AND EXISTS (
                SELECT 1
                FROM equipos e
                WHERE e.id_equipo = jugadores_equipos.id_equipo
                  AND e.id_torneo = $3
              )
          )
      `, { bind: [id_jugador, id_equipo, equipo.id_torneo] });
    }

    req.flash('success', 'Jugadores asignados correctamente');
    res.redirect(`/equipos/administrar/${id_equipo}`);
  } catch (error) {
    console.error("Error en asignarJugadores:", error);
    req.flash('error', 'No se pudo asignar jugadores');
    res.redirect(`/equipos/administrar/${id_equipo}`);
  }
}


//actualizarJugador

//exports.actualizarJugadores = async (req, res) => {
async function actualizarJugadores(req, res) {
  const t = await sequelize.transaction();
  try {
    const id_equipo = Array.isArray(req.body.id_equipo) 
      ? parseInt(req.body.id_equipo[0], 10) 
      : parseInt(req.body.id_equipo, 10);
    const equipo = await Equipo.findByPk(id_equipo);
    if (!equipo) {
      await t.rollback();
      req.flash('danger', 'Equipo no encontrado');
      return res.redirect('/torneos');
    }
    if (!(await puedeAdministrarEquipo(req, equipo, { permitirDelegado: true, transaction: t }))) {
      await t.rollback();
      req.flash('danger', 'No puede actualizar jugadores de este equipo');
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
    }
    const torneoId = equipo.id_torneo;

    // Auditoría
    if (req.session.usuario_id) {
      await sequelize.query(
        "SET LOCAL app.usuario_id = :usuarioId",
        { replacements: { usuarioId: req.session.usuario_id }, transaction: t }
      );
    }
    if (equipo.entity_id) {
      await sequelize.query(
        "SET LOCAL app.entity_id = :entityId",
        { replacements: { entityId: equipo.entity_id }, transaction: t }
      );
    }

    // Actualizar camisetas y capitán en un solo paso
    const capitanId = Array.isArray(req.body.capitan)
      ? parseInt(req.body.capitan[0], 10)
      : parseInt(req.body.capitan, 10);

    for (const [key, value] of Object.entries(req.body)) {
      if (key.startsWith('numero_camiseta_')) {
        const id_jugador = parseInt(key.replace('numero_camiseta_', ''), 10);
        const numero = value && value.trim() !== '' ? parseInt(value, 10) : null;

        await sequelize.query(
          `UPDATE jugadores_equipos
           SET numero_camiseta = :numero
           WHERE id_jugador = :id_jugador
             AND id_equipo = :id_equipo
             AND id_torneo = :torneoId`,
          {
            replacements: { numero, id_jugador, id_equipo, torneoId },
            transaction: t
          }
        );
      }
    }

    await sequelize.query(
      `UPDATE jugadores_equipos
       SET capitan = false
       WHERE id_equipo = :id_equipo
         AND id_torneo = :torneoId`,
      {
        replacements: { id_equipo, torneoId },
        transaction: t
      }
    );

    if (!Number.isNaN(capitanId)) {
      await sequelize.query(
        `UPDATE jugadores_equipos
         SET capitan = true
         WHERE id_jugador = :capitanId
           AND id_equipo = :id_equipo
           AND id_torneo = :torneoId
           AND estado = true`,
        {
          replacements: { capitanId, id_equipo, torneoId },
          transaction: t
        }
      );
    }

    await t.commit();
    req.flash('success', 'Cambios guardados correctamente');
    res.redirect(`/equipos/administrar/${id_equipo}`);
  } catch (error) {
    await t.rollback();
    console.error("Error al actualizar jugadores:", error);
    req.flash('danger', 'Error al actualizar jugadores');
    res.redirect(`/equipos/administrar/${req.body.id_equipo}`);
  }
}





async function desvincularJugador(req, res) {
  const { id_jugador, id_equipo } = req.body;

  try {
    if (Number(req.session.rol_id) === 2) {
      req.flash('error', 'Un delegado no puede desvincular jugadores');
      return res.redirect(`/equipos/administrar/${id_equipo}`);
    }

    const equipo = await Equipo.findByPk(id_equipo);
    if (!equipo) {
      req.flash('error', 'Equipo no encontrado');
      return res.redirect('/torneos');
    }

    if (!(await puedeAdministrarEquipo(req, equipo))) {
      req.flash('danger', 'No puede desvincular jugadores de este equipo');
      return res.redirect(`/torneos/gestionar/${equipo.id_torneo}#equipos`);
    }

    if (req.session.usuario_id) {
      await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");
    }
    if (equipo.entity_id) {
      await sequelize.query("SET app.entity_id = '" + equipo.entity_id + "'");
    }

    await sequelize.query(`
      DELETE FROM jugadores_equipos
      WHERE id_equipo = $1
        AND id_jugador = $2
        AND id_torneo = $3
    `, { bind: [id_equipo, id_jugador, equipo.id_torneo] });

    req.flash('info', 'Jugador desvinculado correctamente');
    res.redirect(`/equipos/administrar/${id_equipo}`);
  } catch (error) {
    console.error("Error en desvincularJugador:", error);
    req.flash('error', 'No se pudo desvincular al jugador');
    res.redirect(`/equipos/administrar/${id_equipo}`);
  }
}




// Agregar jugador
// Agregar jugador


module.exports = {
  listar,
  validarMudanza,
  crear,
  editarForm,
  editar,
  toggle,
  eliminar,
  JugadorEquipo, // me marca ausente
  administrar,
  ver,
  agregarJugador,
  agregarJugador,
  actualizarJugadores,
  buscarUsuariosEntidad,
  buscarJugadores,
  actualizarIcono,
  eliminarIcono,
  asignarDelegados,
  desvincularDelegado,
  asignarJugadores,
  desvincularJugador
};





