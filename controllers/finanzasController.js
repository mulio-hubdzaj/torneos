const { Finanzas, Torneo, sequelize } = require('../models');
const { registrarAuditoria } = require('../utils/helpers');

async function setAuditContext(req, entityId = null) {
  if (req.session.usuario_id) {
    await sequelize.query('SET app.usuario_id = :usuarioId', {
      replacements: { usuarioId: req.session.usuario_id }
    });
  }
  if (entityId || req.session.entity_id) {
    await sequelize.query('SET app.entity_id = :entityId', {
      replacements: { entityId: entityId || req.session.entity_id }
    });
  }
}

exports.listar = async (req, res) => {
  try {
    const finanzas = await Finanzas.findAll({ include: Torneo });
    res.render('finanzas', { finanzas });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener finanzas');
  }
};

exports.crear = async (req, res) => {
  try {
    const { id_torneo, monto_inscripcion, monto_aportado, deuda_total } = req.body;
    const torneo = await Torneo.findByPk(id_torneo, { attributes: ['entity_id'] });
    await setAuditContext(req, torneo?.entity_id);

    const nueva = await Finanzas.create({
      id_torneo,
      monto_inscripcion,
      monto_aportado,
      deuda_total,
      entity_id: torneo?.entity_id || req.session.entity_id || null
    });

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "finanzas", "INSERT", { id_torneo });

    req.flash("success", "Registro financiero creado con éxito");
    res.redirect('/finanzas');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear registro financiero');
  }
};

exports.detalle = async (req, res) => {
  try {
    const finanzaId = req.params.finanza_id;
    const finanza = await Finanzas.findByPk(finanzaId, { include: Torneo });
    if (!finanza) {
      req.flash("danger", "Registro financiero no encontrado");
      return res.redirect('/finanzas');
    }
    res.render('detalle_finanza', { finanza });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener detalle financiero');
  }
};

exports.actualizar = async (req, res) => {
  try {
    const finanzaId = req.params.finanza_id;
    const finanza = await Finanzas.findByPk(finanzaId);
    if (!finanza) {
      req.flash("danger", "Registro financiero no encontrado");
      return res.redirect('/finanzas');
    }

    finanza.monto_inscripcion = req.body.monto_inscripcion;
    finanza.monto_aportado = req.body.monto_aportado;
    finanza.deuda_total = req.body.deuda_total;
    await setAuditContext(req, finanza.entity_id);
    await finanza.save();

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "finanzas", "UPDATE", { finanza_id: finanzaId });

    req.flash("success", "Registro financiero actualizado correctamente");
    res.redirect('/finanzas');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al actualizar registro financiero');
  }
};
