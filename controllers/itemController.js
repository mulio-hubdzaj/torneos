const { Op } = require('sequelize');
const { Item, Torneo, sequelize } = require('../models');

function normalizarNombreItem(valor) {
  return String(valor || '').trim().toLowerCase();
}

async function existeItemDuplicado({ nombre, id_torneo, entity_id, id_item = null }) {
  const where = {
    id_torneo: Number(id_torneo),
    entity_id: Number(entity_id)
  };

  if (id_item) {
    where.id_item = { [Op.ne]: Number(id_item) };
  }

  return Item.findOne({
    where: {
      ...where,
      [Op.and]: sequelize.where(
        sequelize.fn('lower', sequelize.fn('trim', sequelize.col('nombre'))),
        normalizarNombreItem(nombre)
      )
    }
  });
}

function redirectItems(req, fallback = '/torneos') {
  const referer = req.get('referer') || '';
  if (referer.includes('#items')) return referer;
  if (referer.includes('/torneos/gestionar/')) {
    return `${referer.split('#')[0]}#items`;
  }
  return fallback;
}

async function validarTorneoAdmin(req, idTorneo) {
  const torneo = await Torneo.findByPk(idTorneo, { attributes: ['id_torneo', 'entity_id'] });
  if (!torneo) return { ok: false, message: 'Torneo no encontrado' };
  if (Number(req.session.rol_id) !== 99 && Number(req.session.entity_id) !== Number(torneo.entity_id)) {
    return { ok: false, message: 'No puede administrar items de otra entidad' };
  }
  return { ok: true, torneo };
}

exports.crear = async (req, res) => {
  try {
    const { nombre, descripcion, monto, id_torneo } = req.body;
    const montoNumero = Number(monto);

    if (!nombre || monto === undefined || monto === '' || !id_torneo) {
      req.flash('danger', 'Faltan parámetros requeridos');
      return res.redirect(redirectItems(req));
    }

    const permiso = await validarTorneoAdmin(req, id_torneo);
    if (!permiso.ok) {
      req.flash('danger', permiso.message);
      return res.redirect(redirectItems(req));
    }
    const entity_id = permiso.torneo.entity_id;

    if (Number.isNaN(montoNumero) || montoNumero < 0) {
      req.flash('danger', 'El monto debe ser un número positivo');
      return res.redirect(redirectItems(req));
    }

    const itemDuplicado = await existeItemDuplicado({ nombre, id_torneo, entity_id });
    if (itemDuplicado) {
      req.flash('danger', 'Ya existe un item con ese nombre en este torneo');
      return res.redirect(redirectItems(req));
    }

    await sequelize.query(`SET app.usuario_id = '${req.session.usuario_id}'`);
    await sequelize.query(`SET app.entity_id = '${entity_id}'`);

    await Item.create({
      nombre: nombre.trim(),
      descripcion: descripcion || null,
      monto: montoNumero,
      id_torneo: Number(id_torneo),
      entity_id: Number(entity_id)
    });

    req.flash('success', 'Item creado correctamente');
    return res.redirect(redirectItems(req));
  } catch (error) {
    console.error('Error al crear item:', error);
    req.flash('danger', 'No se pudo crear el item');
    return res.redirect(redirectItems(req));
  }
};

exports.actualizar = async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id_item);
    if (!item) {
      req.flash('danger', 'Item no encontrado');
      return res.redirect(redirectItems(req));
    }

    const { nombre, descripcion, monto } = req.body;
    const montoNumero = Number(monto);

    const permiso = await validarTorneoAdmin(req, item.id_torneo);
    if (!permiso.ok) {
      req.flash('danger', permiso.message);
      return res.redirect(redirectItems(req));
    }
    const id_torneo = item.id_torneo;
    const entity_id = item.entity_id;

    if (Number.isNaN(montoNumero) || montoNumero < 0) {
      req.flash('danger', 'El monto debe ser un número positivo');
      return res.redirect(redirectItems(req));
    }

    const itemDuplicado = await existeItemDuplicado({
      nombre,
      id_torneo,
      entity_id,
      id_item: item.id_item
    });
    if (itemDuplicado) {
      req.flash('danger', 'Ya existe un item con ese nombre en este torneo');
      return res.redirect(redirectItems(req));
    }

    await sequelize.query(`SET app.usuario_id = '${req.session.usuario_id}'`);
    await sequelize.query(`SET app.entity_id = '${entity_id}'`);

    await item.update({
      nombre: nombre?.trim(),
      descripcion: descripcion || null,
      monto: montoNumero,
      id_torneo: item.id_torneo,
      entity_id: item.entity_id
    });

    req.flash('success', 'Item actualizado correctamente');
    return res.redirect(redirectItems(req));
  } catch (error) {
    console.error('Error al actualizar item:', error);
    req.flash('danger', 'No se pudo actualizar el item');
    return res.redirect(redirectItems(req));
  }
};

exports.eliminar = async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id_item);
    if (!item) {
      req.flash('danger', 'Item no encontrado');
      return res.redirect(redirectItems(req));
    }

    const permiso = await validarTorneoAdmin(req, item.id_torneo);
    if (!permiso.ok) {
      req.flash('danger', permiso.message);
      return res.redirect(redirectItems(req));
    }

    await sequelize.query(`SET app.usuario_id = '${req.session.usuario_id}'`);
    if (item.entity_id) {
      await sequelize.query(`SET app.entity_id = '${item.entity_id}'`);
    }

    await item.destroy();
    req.flash('success', 'Item eliminado correctamente');
    return res.redirect(redirectItems(req));
  } catch (error) {
    console.error('Error al eliminar item:', error);
    req.flash('danger', 'No se pudo eliminar el item');
    return res.redirect(redirectItems(req));
  }
};
