const express = require('express');
const router = express.Router();
const { Entity, Usuario, sequelize } = require('../models'); // Importamos sequelize

// Vista general de entidades (solo superadmin)
router.get('/', async (req, res) => {
  if (!req.session.usuario_id || req.session.rol_id !== 99) {
    req.flash("danger", "Acceso restringido: solo SuperAdmin");
    return res.redirect('/login');
  }
  const entidades = await Entity.findAll({
    order: [
      ['activo', 'DESC'],
      ['codigo', 'ASC']
    ]
  });
  res.render('admin/index', { entidades});
});

// Mostrar formulario de nueva entidad
router.get('/nueva', async (req, res) => {
  if (req.session.rol_id !== 99) {
    req.flash("danger", "Acceso restringido: solo SuperAdmin");
    return res.redirect('/login');
  }
  res.render('admin/agregar');
});

// Administrar entidad
router.get('/gestionar/:id', async (req, res) => {
  if (!req.session.usuario_id) {
    req.flash("danger", "Debe iniciar sesión");
    return res.redirect('/login');
  }

  const entidad = await Entity.findByPk(req.params.id);
  if (!entidad || !entidad.activo) {
    req.flash("danger", "Entidad inactiva o no encontrada");
    return res.redirect('/login');
  }

  const usuario = await Usuario.findByPk(req.session.usuario_id);
  //res.render('index', { entidad, usuario, messages: req.flash() });
  res.render('index', { entidad, usuario });
});

// Guardar nueva entidad
router.post('/nueva', async (req, res) => {
  if (req.session.rol_id !== 99) {
    req.flash("danger", "Acceso restringido: solo SuperAdmin");
    return res.redirect('/login');
  }
  try {
    // Seteamos el usuario en la sesión de Postgres
    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");

    const { codigo, descripcion } = req.body;
    await Entity.create({
      codigo,
      descripcion,
      activo: true
    });
    req.flash("success", "Entidad creada exitosamente");
    res.redirect('/admin');
  } catch (error) {
    console.error("Error al crear entidad:", error);
    req.flash("danger", "No se pudo crear la entidad al parecer ya existe");
    res.redirect('/admin');
  }
});

// Toggle activo/inactivo
router.post('/entidades/toggle/:id', async (req, res) => {
  if (req.session.rol_id !== 99) {
    req.flash("danger", "Acceso restringido: solo SuperAdmin");
    return res.redirect('/login');
  }

  try {
    // Seteamos el usuario antes de la operación
    await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");

    const entityId = parseInt(req.params.id, 10);
    const entidad = await Entity.findByPk(entityId);

    if (!entidad) {
      req.flash("danger", "Entidad no encontrada");
      return res.redirect('/admin');
    }

    entidad.activo = !entidad.activo;
    await entidad.save();

    req.flash("success", `Entidad ${entidad.activo ? "activada" : "desactivada"} correctamente`);
    res.redirect('/admin');
  } catch (error) {
    console.error("Error al actualizar entidad:", error);
    req.flash("danger", "Error al actualizar entidad");
    res.redirect('/admin');
  }
});


// Mostrar formulario de edición
router.get('/editar/:id', async (req, res) => {
  if (req.session.rol_id !== 99) {
    req.flash("danger", "Acceso restringido: solo SuperAdmin");
    return res.redirect('/login');
  }
  const entidad = await Entity.findByPk(req.params.id);
  res.render('admin/editar', { entidad });
});

// Guardar edición
router.post('/editar/:id', async (req, res) => {
  if (req.session.rol_id !== 99) {
    req.flash("danger", "Acceso restringido: solo SuperAdmin");
    return res.redirect('/login');
  }

  // Seteamos el usuario antes de la operación
  await sequelize.query("SET app.usuario_id = '" + req.session.usuario_id + "'");

  const entidad = await Entity.findByPk(req.params.id);
  if (entidad) {
    entidad.descripcion = req.body.descripcion;
    await entidad.save();
    req.flash("success", "Descripción actualizada");
  }
  res.redirect('/admin');
});

module.exports = router;
