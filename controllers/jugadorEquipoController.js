const { JugadorEquipo, Jugador, Equipo } = require('../models');
const { registrarAuditoria } = require('../utils/helpers');

exports.listar = async (req, res) => {
  try {
    const vinculos = await JugadorEquipo.findAll({
      include: [Jugador, Equipo],
      order: [
        ['fecha_inicio', 'ASC'],        // primero los más antiguos
        [Jugador, 'nombre', 'ASC']      // luego ordenados por nombre
      ]
    });
    res.render('jugadores_equipos', { vinculos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener vínculos jugador-equipo');
  }
};


exports.crear = async (req, res) => {
  try {
    const { jugador_id, equipo_id, tipo_vinculo, fecha_fin } = req.body;

    /*const nuevo = await JugadorEquipo.create({
      jugador_id,
      equipo_id,
      tipo_vinculo: tipo_vinculo || "titular",
      fecha_inicio: new Date(),
      fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
      estado: true
    });
*/
    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "jugadores_equipos", "INSERT", { jugador_id, equipo_id });

    req.flash("success", "Vínculo jugador-equipo creado con éxito");
    res.redirect('/jugadores_equipos');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear vínculo jugador-equipo');
  }
};

exports.detalle = async (req, res) => {
  try {
    const vinculoId = req.params.id_jugador_equipo;
    const vinculo = await JugadorEquipo.findByPk(vinculoId, { include: [Jugador, Equipo] });
    if (!vinculo) {
      req.flash("danger", "Vínculo no encontrado");
      return res.redirect('/jugadores_equipos');
    }
    res.render('detalle_jugador_equipo', { vinculo });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener detalle del vínculo');
  }
};

exports.actualizar = async (req, res) => {
  try {
    const vinculoId = req.params.id_jugador_equipo;
    const vinculo = await JugadorEquipo.findByPk(vinculoId);
    if (!vinculo) {
      req.flash("danger", "Vínculo no encontrado");
      return res.redirect('/jugadores_equipos');
    }

    vinculo.tipo_vinculo = req.body.tipo_vinculo || vinculo.tipo_vinculo;
    vinculo.fecha_fin = req.body.fecha_fin ? new Date(req.body.fecha_fin) : vinculo.fecha_fin;
    vinculo.estado = req.body.estado ? true : false;
    await vinculo.save();

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "jugadores_equipos", "UPDATE", { vinculoId });

    req.flash("success", "Vínculo jugador-equipo actualizado correctamente");
    res.redirect('/jugadores_equipos');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al actualizar vínculo jugador-equipo');
  }
};
