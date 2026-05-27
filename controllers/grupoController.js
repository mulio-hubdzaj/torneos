// controllers/grupoController.js
const { Grupo, Equipo, Torneo, EquipoMovimientoGrupo, sequelize } = require('../models');
const { Op } = require('sequelize');

function volverAtras(req, fallback = '/torneos') {
  return req.get('referer') || fallback;
}

function esAdmin(req) {
  return [3, 99].includes(Number(req.session.rol_id));
}

function puedeAdministrarEntidad(req, entityId) {
  return Number(req.session.rol_id) === 99 || Number(req.session.entity_id) === Number(entityId);
}

async function cargarTorneoAdministrable(req, idTorneo) {
  if (!esAdmin(req)) return null;

  const torneo = await Torneo.findByPk(idTorneo, {
    attributes: ['id_torneo', 'entity_id']
  });

  if (!torneo || !puedeAdministrarEntidad(req, torneo.entity_id)) return null;
  return torneo;
}

// Crear grupo
exports.crear = async (req, res) => {
  try {
    const { nombre_grupo, id_torneo } = req.body;
    const torneo = await cargarTorneoAdministrable(req, id_torneo);

    if (!torneo) {
      req.flash("danger", "No tiene permisos para crear grupos en este torneo");
      return res.redirect(volverAtras(req));
    }

    await Grupo.create({
      nombre_grupo,
      id_torneo,
      estado: true,
      entity_id: torneo.entity_id
    });

    req.flash("success", "Grupo creado con exito");
    res.redirect(`/torneos/gestionar/${id_torneo}#grupos`);
  } catch (error) {
    console.error("Error al crear grupo:", error);
    req.flash("danger", "No se pudo crear el grupo al parecer ya existe uno similar");
    res.redirect(req.body.id_torneo ? `/torneos/gestionar/${req.body.id_torneo}#grupos` : volverAtras(req));
  }
};

// Gestionar grupo individual
exports.gestionar = async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const grupo = await Grupo.findByPk(id_grupo, { include: [Equipo] });

    if (!grupo || !puedeAdministrarEntidad(req, grupo.entity_id)) {
      req.flash("danger", "Grupo no encontrado");
      return res.redirect("/grupos");
    }

    res.render("grupos/gestionar", { grupo });
  } catch (error) {
    console.error("Error al gestionar grupo:", error);
    res.status(500).send("Error al gestionar grupo");
  }
};

// Listar grupos de un torneo
exports.listar = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.id_torneo, 10);
    const torneo = await Torneo.findByPk(torneoId);

    if (!torneo || !puedeAdministrarEntidad(req, torneo.entity_id)) {
      req.flash("danger", "No puede acceder a grupos de otra entidad");
      return res.redirect("/torneos");
    }

    const grupos = await Grupo.findAll({
      where: { id_torneo: torneoId, entity_id: torneo.entity_id },
      include: [{ model: Equipo }]
    });

    res.render('torneos/index', { torneo, grupos });
  } catch (error) {
    console.error("Error al obtener grupos:", error);
    res.status(500).send('Error al obtener grupos');
  }
};

// Editar nombre del grupo
exports.editar = async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const { nombre_grupo } = req.body;

    const grupo = await Grupo.findByPk(id_grupo);
    if (!grupo) {
      req.flash("danger", "Grupo no encontrado");
      return res.redirect(volverAtras(req));
    }

    if (!esAdmin(req) || !puedeAdministrarEntidad(req, grupo.entity_id)) {
      req.flash("danger", "No tiene permisos para editar este grupo");
      return res.redirect(volverAtras(req));
    }

    grupo.nombre_grupo = nombre_grupo;
    await grupo.save();

    req.flash("success", "Nombre del grupo actualizado");
    res.redirect(`/torneos/gestionar/${grupo.id_torneo}#grupos`);
  } catch (error) {
    console.error("Error al editar grupo:", error);
    req.flash("danger", "No se pudo actualizar el grupo");
    res.redirect(volverAtras(req));
  }
};

exports.actualizarVisibilidadFixture = async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const visibleFixture = req.body.visible_fixture === '1';

    const [grupo] = await sequelize.query(`
      SELECT id_grupo, id_torneo, entity_id, nombre_grupo
      FROM grupos
      WHERE id_grupo = :idGrupo
      LIMIT 1
    `, {
      replacements: { idGrupo: id_grupo },
      type: sequelize.QueryTypes.SELECT
    });

    if (!grupo) {
      req.flash("danger", "Grupo no encontrado");
      return res.redirect(volverAtras(req));
    }

    if (!esAdmin(req) || !puedeAdministrarEntidad(req, grupo.entity_id)) {
      req.flash("danger", "No tiene permisos para editar este grupo");
      return res.redirect(volverAtras(req));
    }

    try {
      await sequelize.query(`
        UPDATE grupos
        SET visible_fixture = :visibleFixture
        WHERE id_grupo = :idGrupo
      `, {
        replacements: { visibleFixture, idGrupo: id_grupo }
      });
    } catch (error) {
      if (error?.parent?.code === '42703') {
        req.flash("danger", "Falta aplicar el SQL de visible_fixture en la tabla grupos.");
        return res.redirect(`/torneos/gestionar/${grupo.id_torneo}#grupos`);
      }
      throw error;
    }

    req.flash(
      "success",
      visibleFixture
        ? `El grupo ${grupo.nombre_grupo} vuelve a verse en Fixture`
        : `El grupo ${grupo.nombre_grupo} dejo de verse en Fixture`
    );
    return res.redirect(`/torneos/gestionar/${grupo.id_torneo}#grupos`);
  } catch (error) {
    console.error("Error al actualizar visibilidad del grupo en fixture:", error);
    req.flash("danger", "No se pudo actualizar la visibilidad del grupo en Fixture");
    return res.redirect(volverAtras(req));
  }
};

// Eliminar grupo
exports.eliminar = async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const grupo = await Grupo.findByPk(id_grupo, { include: [Equipo] });

    if (!grupo) {
      req.flash("danger", "Grupo no encontrado");
      return res.redirect(volverAtras(req));
    }

    if (!esAdmin(req) || !puedeAdministrarEntidad(req, grupo.entity_id)) {
      req.flash("danger", "No tiene permisos para eliminar este grupo");
      return res.redirect(volverAtras(req));
    }

    if (grupo.Equipos && grupo.Equipos.length > 0) {
      req.flash("danger", "No se puede eliminar: el grupo contiene equipos");
      return res.redirect(`/torneos/gestionar/${grupo.id_torneo}#grupos`);
    }

    await EquipoMovimientoGrupo.destroy({
      where: {
        [Op.or]: [
          { id_grupo_origen: grupo.id_grupo },
          { id_grupo_destino: grupo.id_grupo }
        ]
      }
    });

    await grupo.destroy();
    req.flash("success", "Grupo eliminado con exito");
    res.redirect(`/torneos/gestionar/${grupo.id_torneo}#grupos`);
  } catch (error) {
    console.error("Error al eliminar grupo:", error);
    req.flash("danger", "Error al eliminar grupo");
    res.redirect(volverAtras(req));
  }
};
