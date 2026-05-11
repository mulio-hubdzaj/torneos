const { Usuario, Rol, Entity } = require('../models');
const { registrarAuditoria } = require('../utils/helpers');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

exports.listar = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({ include: [Rol, Entity] });
    res.render('usuarios', { usuarios });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener usuarios');
  }
};

exports.crear = async (req, res) => {
  try {
    const { nombre, documento, correo, contrasena, rol_id, entity_id } = req.body;
    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    const nuevoUsuario = await Usuario.create({
      id_usuario: uuidv4(),
      nombre,
      documento,
      correo,
      contrasena_hash: contrasenaHash,
      rol_id,
      entity_id,
      estado: true
    });

    const usuarioId = req.session.usuario_id;
    await registrarAuditoria(usuarioId, documento, "usuarios", "INSERT", { nombre });

    req.flash("success", "Usuario creado con éxito");
    res.redirect('/usuarios');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al crear usuario');
  }
};
