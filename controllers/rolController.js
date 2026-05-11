const { Rol, Usuario, Entity } = require('../models');
const { registrarAuditoria } = require('../utils/helpers');

exports.listar = async (req, res) => {
  try {
    const roles = await Rol.findAll({ include: [Entity, Usuario] });
    res.render('roles', { roles });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener roles');
  }
};

exports.crear = async (req, res) => {
  try {
    const { nombre_rol, entity_id } = req.body;
    const nuevo = await Rol.create({ nombre_rol, entity_id });

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, null, "roles", "INSERT", { nombre_rol });

    req.flash("success", "Rol creado con éxito");
    res.redirect('/roles');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear rol');
  }
};
