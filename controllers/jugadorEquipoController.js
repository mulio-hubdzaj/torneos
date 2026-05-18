const { JugadorEquipo, Jugador, Equipo } = require('../models');
const { registrarAuditoria } = require('../utils/helpers');

function puedeAdministrarEntidad(req, entityId) {
  return Number(req.session.rol_id) === 99 || Number(req.session.entity_id) === Number(entityId);
}

async function cargarVinculoPermitido(req, vinculoId) {
  const vinculo = await JugadorEquipo.findByPk(vinculoId, {
    include: [
      { model: Jugador, as: 'Jugador' },
      { model: Equipo, as: 'Equipo' }
    ]
  });

  if (!vinculo) return null;

  const entityId = vinculo.Equipo?.entity_id || vinculo.Jugador?.entity_id;
  if (!puedeAdministrarEntidad(req, entityId)) return null;

  return vinculo;
}

exports.listar = async (req, res) => {
  try {
    const include = [
      { model: Jugador, as: 'Jugador' },
      { model: Equipo, as: 'Equipo' }
    ];

    const where = Number(req.session.rol_id) === 99
      ? {}
      : { '$Equipo.entity_id$': req.session.entity_id };

    const vinculos = await JugadorEquipo.findAll({
      include,
      where,
      order: [
        ['fecha_inicio', 'ASC'],
        [{ model: Jugador, as: 'Jugador' }, 'nombre', 'ASC']
      ]
    });

    res.render('jugadores_equipos', { vinculos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener vinculos jugador-equipo');
  }
};

exports.crear = async (req, res) => {
  try {
    const { jugador_id, equipo_id } = req.body;
    const equipo = await Equipo.findByPk(equipo_id, { attributes: ['entity_id'] });

    if (!equipo || !puedeAdministrarEntidad(req, equipo.entity_id)) {
      req.flash("danger", "No puede crear vinculos en otra entidad");
      return res.redirect(req.get('referer') || '/torneos');
    }

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "jugadores_equipos", "INSERT", { jugador_id, equipo_id }, equipo.entity_id);

    req.flash("success", "Vinculo jugador-equipo registrado en auditoria");
    res.redirect('/jugador-equipo');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear vinculo jugador-equipo');
  }
};

exports.detalle = async (req, res) => {
  try {
    const vinculo = await cargarVinculoPermitido(req, req.params.id_jugador_equipo);
    if (!vinculo) {
      req.flash("danger", "Vinculo no encontrado");
      return res.redirect('/jugador-equipo');
    }

    res.render('detalle_jugador_equipo', { vinculo });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener detalle del vinculo');
  }
};

exports.actualizar = async (req, res) => {
  try {
    const vinculo = await cargarVinculoPermitido(req, req.params.id_jugador_equipo);
    if (!vinculo) {
      req.flash("danger", "Vinculo no encontrado");
      return res.redirect('/jugador-equipo');
    }

    vinculo.tipo_vinculo = req.body.tipo_vinculo || vinculo.tipo_vinculo;
    vinculo.fecha_fin = req.body.fecha_fin ? new Date(req.body.fecha_fin) : vinculo.fecha_fin;
    vinculo.estado = req.body.estado ? true : false;
    await vinculo.save();

    const usuarioId = req.session.usuario_id;
    const entityId = vinculo.Equipo?.entity_id || vinculo.Jugador?.entity_id || req.session.entity_id;
    await registrarAuditoria(usuarioId, null, "jugadores_equipos", "UPDATE", { vinculoId: vinculo.id_jugador_equipo }, entityId);

    req.flash("success", "Vinculo jugador-equipo actualizado correctamente");
    res.redirect('/jugador-equipo');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al actualizar vinculo jugador-equipo');
  }
};
