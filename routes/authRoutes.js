// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { Usuario, Entity, Torneo } = require('../models');
const bcrypt = require('bcrypt');

function validarContrasenaSegura(contrasena) {
  const texto = String(contrasena || '');
  const requisitos = [
    { ok: texto.length >= 8, mensaje: 'al menos 8 caracteres' },
    { ok: (texto.match(/\d/g) || []).length >= 2, mensaje: 'al menos 2 numeros' },
    { ok: /[^A-Za-z0-9\s]/.test(texto), mensaje: 'al menos 1 caracter especial' }
  ];
  return {
    ok: requisitos.every(req => req.ok),
    mensaje: `La contraseña debe tener ${requisitos.map(req => req.mensaje).join(', ')}`
  };
}

// Mostrar formulario de login
router.get('/login', (req, res) => {
  res.render('login'); // los mensajes llegan por res.locals.messages
});

router.get('/cambiar-contrasena', (req, res) => {
  if (!req.session.usuario_id || !req.session.debe_cambiar_contrasena) {
    return res.redirect('/login');
  }

  res.render('cambiar_contrasena');
});

router.post('/cambiar-contrasena', async (req, res) => {
  try {
    if (!req.session.usuario_id || !req.session.debe_cambiar_contrasena) {
      return res.redirect('/login');
    }

    const nuevaContrasena = String(req.body.contrasena || '').trim();
    const confirmarContrasena = String(req.body.confirmar_contrasena || '').trim();

    const seguridad = validarContrasenaSegura(nuevaContrasena);
    if (!seguridad.ok) {
      req.flash("danger", seguridad.mensaje);
      return res.redirect('/cambiar-contrasena');
    }

    if (nuevaContrasena !== confirmarContrasena) {
      req.flash("danger", "Las contraseñas no coinciden");
      return res.redirect('/cambiar-contrasena');
    }

    const usuario = await Usuario.findByPk(req.session.usuario_id);
    if (!usuario) {
      req.flash("danger", "Usuario no encontrado");
      return res.redirect('/login');
    }

    usuario.contrasena_hash = await bcrypt.hash(nuevaContrasena, 10);
    usuario.debe_cambiar_contrasena = false;
    usuario.reset_contrasena_en = null;
    await usuario.save();

    req.session.debe_cambiar_contrasena = false;
    req.flash("success", "Contraseña actualizada correctamente");

    switch (Number(req.session.rol_id)) {
      case 1:
      case 2: {
        const torneo = await Torneo.findOne({ where: { entity_id: req.session.entity_id, estado: true } });
        return res.redirect(torneo ? `/torneos/gestionar/${torneo.id_torneo}` : '/torneos');
      }
      case 3:
        return res.redirect(`/entidad/gestionar/${req.session.entity_id}`);
      case 99:
        return res.redirect('/admin');
      default:
        return res.redirect('/login');
    }
  } catch (error) {
    console.error("Error al cambiar contraseña temporal:", error);
    req.flash("danger", "No se pudo cambiar la contraseña");
    return res.redirect('/cambiar-contrasena');
  }
});

// Procesar login
router.post('/login', async (req, res) => {
  const { documento, contrasena, entidad } = req.body;

  try {
    let entityId = null;

    // Validar entidad por código alfanumérico (ej: A2)
    if (entidad && entidad.trim() !== '') {
      const entidadObj = await Entity.findOne({
        where: { codigo: entidad.toUpperCase() }
      });

      if (!entidadObj) {
        req.flash("danger", "Entidad no encontrada");
        return res.redirect('/login');
      }

      if (!entidadObj.activo) {
        req.flash("danger", "Entidad inactiva");
        return res.redirect('/login');
      }

      entityId = entidadObj.entity_id;
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
    req.session.debe_cambiar_contrasena = Boolean(user.debe_cambiar_contrasena);

    // Reglas de negocio
    if (!entityId && user.rol_id !== 99) {
      req.flash("danger", "Debe seleccionar una entidad válida");
      return res.redirect('/login');
    }

    if (user.debe_cambiar_contrasena) {
      req.flash("info", "Debe cambiar la contraseña temporal antes de continuar");
      return res.redirect('/cambiar-contrasena');
    }

    // Redirección según rol
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

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.redirect('/login');
  });
});

// Mostrar formulario de registro
router.get('/registro', (req, res) => {
  res.render('registro'); // los mensajes ya están en res.locals.messages
});

// Procesar registro
router.post('/registro', async (req, res) => {
  try {
    const { nombre, apellido, correo, documento, contrasena, entidad } = req.body;
    const nombreCompleto = [nombre, apellido]
      .map(valor => String(valor || '').trim().toUpperCase())
      .filter(Boolean)
      .join(' ');
    const correoNormalizado = String(correo || '').trim().toLowerCase();
    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correoNormalizado);

    if (!nombreCompleto || !documento || !contrasena || !entidad || !correoNormalizado) {
      req.flash("danger", "Complete todos los datos del registro");
      return res.redirect('/registro');
    }

    if (!correoValido) {
      req.flash("danger", "Ingrese un correo valido, por ejemplo usuario@dominio.com");
      return res.redirect('/registro');
    }

    const seguridadRegistro = validarContrasenaSegura(contrasena);
    if (!seguridadRegistro.ok) {
      req.flash("danger", seguridadRegistro.mensaje);
      return res.redirect('/registro');
    }

    // Validar entidad por código
    let entityId = null;
    if (entidad && entidad.trim() !== '') {
      const entidadObj = await Entity.findOne({
        where: { codigo: entidad.toUpperCase(), activo: true }
      });
      if (!entidadObj) {
        req.flash("danger", "Entidad no encontrada o inactiva");
        return res.redirect('/registro');
      }
      entityId = entidadObj.entity_id;
    }

    // Validar duplicado de documento + entidad
    const existente = await Usuario.findOne({
      where: {
        documento,
        entity_id: entityId
      }
    });

    if (existente) {
      req.flash("danger", "Ya existe un usuario con ese documento en la entidad seleccionada");
      return res.redirect('/registro');
    }

    // Encriptar contraseña
    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    // Crear usuario
    await Usuario.create({
      nombre: nombreCompleto,
      correo: correoNormalizado,
      documento,
      contrasena_hash: contrasenaHash,
      entity_id: entityId,
      rol_id: 1,
      estado: true,
      creado_en: new Date()
    });

    req.flash("success", "Usuario registrado con éxito");
    res.redirect('/login');
  } catch (error) {
    console.error("Error en registro:", error);
    req.flash("danger", "Error al registrar usuario");
    res.redirect('/registro');
  }
});

module.exports = router;
