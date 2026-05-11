// controllers/authController.js
const express = require('express');
const router = express.Router();
const { Usuario, Entity, sequelize } = require('../models'); // 🔑 importar sequelize
const bcrypt = require('bcrypt');

// Mostrar formulario de login
router.get('/login', (req, res) => {
  res.render('login'); // los mensajes llegan por res.locals.messages
});

// Procesar login
router.post('/login', async (req, res) => {
  const { documento, contrasena, entidad } = req.body;

  try {
    let entityId = null;

    // Validar entidad
    if (entidad && entidad.trim() !== '') {
      const parsedEntity = parseInt(entidad, 10);
      if (!isNaN(parsedEntity)) {
        const entidadObj = await Entity.findByPk(parsedEntity);

        if (!entidadObj) {
          req.flash("danger", "Entidad no encontrada");
          return res.redirect('/login');
        }

        if (!entidadObj.activo) {
          req.flash("danger", "Entidad inactiva");
          return res.redirect('/login');
        }

        entityId = parsedEntity;
      }
    }

    // Construir cláusula de búsqueda con documento + entidad obligatoria
    let whereClause = { documento };
    if (entityId) {
      whereClause.entity_id = entityId;
    }

    const user = await Usuario.findOne({ where: whereClause });

    if (!user) {
      req.flash("danger", "Usuario no encontrado en la entidad seleccionada");
      return res.redirect('/login');
    }

    const validPassword = await bcrypt.compare(contrasena, user.contrasena_hash);
    if (!validPassword) {
      req.flash("danger", "Contraseña incorrecta");
      return res.redirect('/login');
    }

    // Guardar datos en sesión
    req.session.usuario_id = user.id_usuario;
    req.session.rol_id = user.rol_id;
    req.session.entity_id = user.entity_id;

    // Reglas de negocio
    if (!entityId && user.rol_id !== 99) {
      req.flash("danger", "Debe seleccionar una entidad válida");
      return res.redirect('/login');
    }

    switch (user.rol_id) {
      case 1: // Espectador
        req.flash("success", "Bienvenido Espectador");
        const torneoEsp = await Torneo.findOne({ where: { entity_id: user.entity_id, estado: true } });
        if (torneoEsp) {
          req.session.torneo_id = torneoEsp.id_torneo;
          return res.redirect(`/torneos/gestionar/${torneoEsp.id_torneo}`);
        }
        return res.redirect('/torneos');

      case 2: // Delegado
        req.flash("success", "Bienvenido Delegado");
        const torneoDel = await Torneo.findOne({ where: { entity_id: user.entity_id, estado: true } });
        if (torneoDel) {
          req.session.torneo_id = torneoDel.id_torneo;
          return res.redirect(`/torneos/gestionar/${torneoDel.id_torneo}`);
        }
        return res.redirect('/torneos');

      case 3: // Admin
        req.flash("success", "Bienvenido Admin");
        return res.redirect(`/entidad/gestionar/${user.entity_id}`);

      case 99: // Super Admin
        req.flash("success", "Bienvenido Super Admin");
        return res.redirect('/admin');

      default:
        req.flash("danger", "Rol no reconocido");
        return res.redirect('/login');
    }

  } catch (error) {
    console.error("Error en login:", error);
    req.flash("danger", "Error interno al iniciar sesión");
    res.redirect('/login');
  }
});
