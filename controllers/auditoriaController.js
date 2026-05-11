
//controllers/auditori

const { Auditoria, Entity, Usuario } = require('../models');

exports.listar = async (req, res) => {
  try {
    const auditorias = await Auditoria.findAll({
      include: [Entity, Usuario],
      order: [['fecha_hora', 'DESC']]
    });
    res.render('auditorias', { auditorias });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener registros de auditoría');
  }
};

exports.detalle = async (req, res) => {
  try {
    const idAuditoria = req.params.id_auditoria;
    const auditoria = await Auditoria.findByPk(idAuditoria, { include: [Entity, Usuario] });
    if (!auditoria) {
      req.flash("danger", "Registro de auditoría no encontrado");
      return res.redirect('/auditorias');
    }
    res.render('detalle_auditoria', { auditoria });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener detalle de auditoría');
  }
};
