const { Finanzas, Torneo } = require('../models');
const { registrarAuditoria } = require('../utils/helpers');

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
    const nueva = await Finanzas.create({
      id_torneo,
      monto_inscripcion,
      monto_aportado,
      deuda_total
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
