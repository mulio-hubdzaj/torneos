const { Op } = require('sequelize');
const { Jugador, JugadorEquipo, Equipo, sequelize } = require('../models');

// 🔧 Función auxiliar para calcular edad y meses transcurridos desde último cumpleaños
function calcularEdadYMeses(fechaNacimiento) {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);

  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();

  if (hoy.getDate() < nacimiento.getDate()) {
    meses--;
  }
  if (meses < 0) {
    edad--;
    meses += 12;
  }

  return { edad, meses };
}

// 📌 Mostrar formulario de nuevo jugador
exports.nuevo = (req, res) => {
  if (![2, 3, 99].includes(Number(req.session.rol_id))) {
    req.flash("danger", "No tiene permisos para registrar jugadores");
    return res.redirect(`/torneos/gestionar/${req.query.torneo_id || req.session.torneo_id}#jugadores`);
  }

  req.session.entity_id = parseInt(req.query.entity_id, 10);
  req.session.torneo_id = parseInt(req.query.torneo_id, 10);

  res.render('jugadores/nuevo', {
    entity_id: req.session.entity_id,
    torneo_id: req.session.torneo_id,
    rol_id: req.session.rol_id,
   // messages: req.flash()   // 👈 ahora sí correcto
  });
};


// 📌 Crear nuevo jugador
exports.crear = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    req.session.entity_id = parseInt(req.body.entity_id || req.query.entity_id, 10);
    req.session.torneo_id = parseInt(req.body.torneo_id || req.query.torneo_id, 10);

    const entityId = req.session.entity_id;
    const torneoId = req.session.torneo_id;
    const { nombre, apellido, documento, fecha_nacimiento } = req.body;
    const esDelegado = Number(req.session.rol_id) === 2;
    const estado = esDelegado ? "true" : req.body.estado;
    const observaciones = esDelegado ? "" : (req.body.observaciones || "");

    if (![2, 3, 99].includes(Number(req.session.rol_id))) {
      req.flash("danger", "No tiene permisos para registrar jugadores");
      await t.rollback();
      return res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
    }

    // 🔎 Validar duplicado SOLO dentro de la misma entidad
    const existente = await Jugador.findOne({ where: { documento, entity_id: entityId } });
    if (existente) {
      req.flash("danger", "Ya existe un jugador con ese documento en esta entidad");
      await t.rollback();
      return res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
    }

    // 🔑 Setear variable de sesión en Postgres con validación
    if (req.session.usuario_id) {
      await sequelize.query(`SET LOCAL app.usuario_id = '${req.session.usuario_id}'`, { transaction: t });
    }

    // 👉 Insertar en jugadores y guardar referencia
    const nuevoJugador = await Jugador.create({
      nombre,
      apellido,
      documento,
      fecha_nacimiento,
      estado: estado === "true",
      entity_id: entityId,
      observaciones
    }, { transaction: t });

    // 👉 Insertar vínculo en jugadores_equipos
    await JugadorEquipo.create({
      id_jugador: nuevoJugador.id_jugador,
      id_torneo: torneoId,
      estado: estado === "true",
      observaciones
    }, { transaction: t });

    await t.commit();
    req.flash("success", "Jugador registrado correctamente");
    return res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
  } catch (error) {
    await t.rollback();
    console.error(error);
    req.flash("danger", "Error al crear jugador");
    return res.redirect(`/torneos/gestionar/${req.session.torneo_id}#jugadores`);
  }
};


// 📌 Cambiar estado del jugador (AJAX)
exports.cambiarEstado = async (req, res) => {
  const t = await sequelize.transaction(); // 👈 transacción explícita
  try {
    const jugador = await Jugador.findByPk(req.params.id);
    if (!jugador) {
      await t.rollback();
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    // 🔑 Setear variable de sesión en Postgres con validación
    console.log(">>> usuario_id en sesión:", req.session.usuario_id);
    if (req.session.usuario_id) {
      await sequelize.query(`SET LOCAL app.usuario_id = '${req.session.usuario_id}'`, { transaction: t });
    } else {
      console.warn("⚠️ No hay usuario_id en sesión, auditoría guardará NULL");
    }

    await jugador.update(
      { estado: req.body.estado === "true" },
      { transaction: t }
    );

    await t.commit();
    return res.json({ success: true });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar estado del jugador' });
  }
};



// controllers/jugadorController.js
//const { Jugador, Torneo, JugadorEquipo, Equipo } = require('../models');

/*exports.listar = async (req, res) => {
  try {
    const { documento, equipo } = req.query;
    let entityId = req.session.entity_id;
    let torneoId = req.session.torneo_id;

    // 🔧 Si sos super_admin y no hay entityId en sesión, lo tomamos del torneo
    if (!entityId && req.session.rol_id === 99 && torneoId) {
      const torneo = await Torneo.findByPk(torneoId);
      if (torneo) {
        entityId = torneo.entity_id;
        req.session.entity_id = entityId;
      }
    }

    // 🔧 Si no hay torneo en sesión pero viene en query, lo guardamos
    if (!torneoId && req.query.torneo_id) {
      torneoId = parseInt(req.query.torneo_id, 10);
      req.session.torneo_id = torneoId;
    }

    // Log de sesión visible
    console.log("\n\n*************** SESIÓN ACTUAL ***************");
    console.log(">>> entityId:", entityId ?? "NO DEFINIDO");
    console.log(">>> torneoId:", torneoId ?? "NO DEFINIDO");
    console.log("********************************************\n\n");

    // Consulta de jugadores filtrada por entidad
    const jugadores = await Jugador.findAll({
      where: { entity_id: entityId },
      include: [{
        model: JugadorEquipo,
        as: 'JugadorEquipos',
        include: [{ model: Equipo, as: 'Equipo' }]
      }]
    });

    // Normalización de fechas
    jugadores.forEach(j => {
      const rawFecha = j.getDataValue('fecha_nacimiento');
      if (rawFecha) {
        j.setDataValue('fecha_nacimiento_fmt', rawFecha);
        const fecha = new Date(`${rawFecha}T00:00:00`);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fecha.getFullYear();
        let meses = hoy.getMonth() - fecha.getMonth();
        if (hoy.getDate() < fecha.getDate()) meses--;
        if (meses < 0) { edad--; meses += 12; }
        j.setDataValue('edad', edad);
        j.setDataValue('meses', meses);
      } else {
        j.setDataValue('fecha_nacimiento_fmt', '');
        j.setDataValue('edad', '');
        j.setDataValue('meses', '');
      }
    });

    // Render de la vista
    res.render('jugadores/listar', {
      jugadores: jugadores.map(j => j.get({ plain: true })),
      entityId,
      torneoId,
      messages: req.flash()
    });

  } catch (error) {
    console.error("Error al listar jugadores:", error);
    req.flash("danger", "Error al listar jugadores");
    res.redirect('/torneos');
  }
};
*/

exports.listar = (req, res) => {
  res.send("listar deshabilitado temporalmente");
};

/// 📌 Editar datos del jugador (vista del lápiz)
exports.editar = async (req, res) => {
  try {
    const jugador = await Jugador.findByPk(req.params.id);
    const torneoId = req.session.torneo_id;

    if (!jugador) {
      req.flash("danger", "Jugador no encontrado");
      return res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
    }

    // 👉 Buscar vínculo del jugador en el torneo actual
    let vinculo = await JugadorEquipo.findOne({
      where: { id_jugador: req.params.id, id_torneo: torneoId }
    });

    // 👉 Si no existe vínculo, crearlo automáticamente con valores iniciales
    if (!vinculo) {
      if (!req.session.usuario_id) {
        req.flash("danger", "Sesión inválida: usuario no definido");
        return res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
      }

      // Usar SET para que persista en la conexión
      await sequelize.query(
        "SET app.usuario_id = :usuarioId",
        { replacements: { usuarioId: req.session.usuario_id } }
      );

      vinculo = await JugadorEquipo.create({
        id_jugador: req.params.id,
        id_torneo: torneoId,
        id_equipo: null,              // sin equipo por defecto
        estado: true,                 // activo por defecto
        observaciones: '',
        tipo_vinculo: 'titular',      // valor inicial
        fecha_inicio: new Date()      // fecha de creación del vínculo
      });
      console.log(">>> vínculo creado automáticamente:", vinculo.toJSON());
    } else {
      console.log(">>> vínculo encontrado:", vinculo.toJSON());
    }

    res.render('jugadores/editar', { 
      jugador, 
      vinculo,          // 👈 datos específicos del torneo
      torneo_id: torneoId
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al cargar jugador');
  }
};


// 📌 Actualizar datos del jugador
exports.actualizar = async (req, res) => {
  const t = await sequelize.transaction(); // 👈 transacción explícita
  try {
    const { nombre, apellido, documento, fecha_nacimiento, estado, observaciones } = req.body;
    const jugador = await Jugador.findByPk(req.params.id);
    const torneoId = req.session.torneo_id;

    if (!jugador) {
      req.flash("danger", "Jugador no encontrado");
      await t.rollback();
      return res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
    }

    // 🔎 Validar duplicado SOLO dentro de la misma entidad
    const duplicado = await Jugador.findOne({
      where: { documento, id_jugador: { [Op.ne]: req.params.id }, entity_id: req.session.entity_id }
    });
    if (duplicado) {
      req.flash("danger", "Ya existe otro jugador con ese documento en esta entidad");
      await t.rollback();
      return res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
    }

    // 🔑 Setear variable de sesión en Postgres con validación
    console.log(">>> usuario_id en sesión:", req.session.usuario_id);
    if (!req.session.usuario_id) {
      req.flash("danger", "Sesión inválida: usuario no definido");
      await t.rollback();
      return res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
    }

    // Usar SET en lugar de SET LOCAL
    await sequelize.query(
      "SET app.usuario_id = :usuarioId",
      { replacements: { usuarioId: req.session.usuario_id }, transaction: t }
    );

    // 👉 Actualizar datos globales del jugador (nombre, documento, etc.)
    await jugador.update({
      nombre,
      apellido,
      documento,
      fecha_nacimiento,
      entity_id: req.session.entity_id
    }, { transaction: t });

    // 👉 Actualizar estado y observaciones SOLO en el torneo actual
    await JugadorEquipo.update(
      { estado: estado === "true", observaciones },
      { where: { id_jugador: req.params.id, id_torneo: torneoId }, transaction: t }
    );

    await t.commit();
    req.flash("success", "Jugador actualizado correctamente en el torneo");
    res.redirect(`/torneos/gestionar/${torneoId}#jugadores`);
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).send('Error al actualizar jugador');
  }
};
