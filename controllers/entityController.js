const { Entity, Usuario, Torneo } = require('../models');
const { registrarAuditoria } = require('../utils/helpers'); // ✅ Importar helper

exports.gestionar = async (req, res) => {
  try {
    if (!req.session.usuario_id) {
      req.flash("danger", "Debe iniciar sesión");
      return res.redirect('/login');
    }

    // 🔧 Parsear el parámetro a número
    const entityId = parseInt(req.params.id, 10);

    const entidad = await Entity.findByPk(entityId);
    if (!entidad || !entidad.activo) {
      req.flash("danger", "Entidad inactiva o no encontrada");
      return res.redirect('/login');
    }

    const usuario = await Usuario.findByPk(req.session.usuario_id);

    const torneos = await Torneo.findAll({
      where: { entity_id: entityId }
    });

    // 🔧 Actualizar la sesión con la entidad actual
    req.session.entity_id = entityId;

    // ✅ Guardamos mensajes en variable antes de consumirlos
    const flashMessages = req.flash();
    console.log("Entrando a entidad:", entityId);
    console.log("Session entity_id:", req.session.entity_id);

    res.render('entidad/index', {
      entidad,
      usuario,
      torneos,
      entityId,   // 👈 ya como número
      //messages: flashMessages
    });
  } catch (error) {
    console.error(error);
    req.flash("danger", "Error al gestionar entidad");
    res.redirect('/login');
  }
};

exports.crear = async (req, res) => {
  if (req.method === 'POST') {
    try {
      const { codigo, descripcion } = req.body;
      const activo = req.body.activo ? true : false;

      const nuevaEntity = await Entity.create({
        codigo,
        descripcion,
        activo
      });

      const usuarioId = req.session.usuario_id;
      const documento = req.session.documento || null;

      console.log(">>> Creando entidad:", nuevaEntity);

      await registrarAuditoria(
        usuarioId,
        documento,
        "entity",
        "INSERT",
        nuevaEntity,
        nuevaEntity.entity_id
      );

      console.log(">>> Auditoría registrada para entity");

      req.flash("success", "Entidad creada con éxito");
      return res.redirect('/entities');
    } catch (error) {
      console.error(error);
      req.flash("danger", "Error al crear entidad");
      return res.redirect('/entities');
    }
  }
  res.render('entities/create');
};

exports.editar = async (req, res) => {
  try {
    const entityId = parseInt(req.params.entity_id, 10);
    const entity = await Entity.findByPk(entityId);
    if (!entity) {
      req.flash("danger", "Entidad no encontrada");
      return res.redirect('/entities');
    }

    if (req.method === 'POST') {
      entity.codigo = req.body.codigo;
      entity.descripcion = req.body.descripcion;
      entity.activo = req.body.activo ? true : false;
      await entity.save();

      req.flash("success", "Entidad actualizada con éxito");
      return res.redirect('/entities');
    }

    res.render('entities/edit', { entity });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al editar entidad');
  }
};
exports.desactivar = async (req, res) => {
  try {
    const entityId = parseInt(req.params.id, 10); // 👈 usar 'id'
    const entity = await Entity.findByPk(entityId);

    if (!entity) {
      req.flash("danger", "Entidad no encontrada");
      return res.redirect('/entities');
    }

    entity.activo = false; // 👈 campo correcto
    await entity.save();

    req.flash("info", "Entidad desactivada");
    res.redirect('/entities');
  } catch (error) {
    console.error("Error al desactivar entidad:", error);
    req.flash("danger", "Error al desactivar entidad");
    res.redirect('/entities');
  }
};

exports.activar = async (req, res) => {
  try {
    const entityId = parseInt(req.params.id, 10); // 👈 usar 'id'
    const entity = await Entity.findByPk(entityId);

    if (!entity) {
      req.flash("danger", "Entidad no encontrada");
      return res.redirect('/entities');
    }

    entity.activo = true;
    await entity.save();

    req.flash("info", "Entidad activada");
    res.redirect('/entities');
  } catch (error) {
    console.error("Error al activar entidad:", error);
    req.flash("danger", "Error al activar entidad");
    res.redirect('/entities');
  }
};
