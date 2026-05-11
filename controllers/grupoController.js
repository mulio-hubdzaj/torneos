// controllers/grupoController.js
const { Grupo, Equipo, Torneo } = require('../models');

function volverAtras(req, fallback = '/torneos') {
  return req.get('referer') || fallback;
}

// Crear grupo
exports.crear = async (req, res) => {
  try {
    const { nombre_grupo, id_torneo } = req.body;
    let entityId = req.session.entity_id;

    // Log extendido para verificar sesión
    
    console.log("Sesión al crear grupo:", {
      usuario_id: req.session.usuario_id,
      rol_id: req.session.rol_id,
      entity_id: req.session.entity_id,
      documento: req.session.documento
    });

    // 🔑 Si la sesión no tiene entity_id (super_admin), lo tomamos del torneo
    if (!entityId && req.session.rol_id === 99) {
      const torneo = await Torneo.findByPk(id_torneo);
      if (torneo) {
        entityId = torneo.entity_id;
        req.session.entity_id = entityId;
        //console.log("Entity ID asignado desde torneo en crear grupo:", entityId);
      }
    }

    if (!entityId) {
      req.flash("danger", "No se pudo determinar la entidad para el grupo");
      return res.redirect(`/torneos/gestionar/${id_torneo}`);
    }

    await Grupo.create({
      nombre_grupo,
      id_torneo,
      estado: true,
      entity_id: entityId
    });

    req.flash("success", "Grupo creado con éxito");
    res.redirect(`/torneos/gestionar/${id_torneo}`);
  } catch (error) {
    console.error("Error al crear grupo:", error);
    req.flash("danger", "No se pudo crear el grupo al parecer ya existe uno similar");
    res.redirect(`/torneos/gestionar/${req.body.id_torneo}`);
  }
};

// Gestionar grupo individual
exports.gestionar = async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const entityId = req.session.entity_id;

    const grupo = await Grupo.findOne({
      where: { id_grupo, entity_id: entityId },
      include: [Equipo]
    });

    if (!grupo) {
      req.flash("danger", "Grupo no encontrado");
      return res.redirect("/grupos");
    }

    res.render("grupos/gestionar", {
      grupo,
      //messages: req.flash()
    });
  } catch (error) {
    console.error("Error al gestionar grupo:", error);
    res.status(500).send("Error al gestionar grupo");
  }
};

// Listar grupos de un torneo
exports.listar = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.id_torneo, 10);
    const entityId = req.session.entity_id;

    const grupos = await Grupo.findAll({
      where: { id_torneo: torneoId, entity_id: entityId },
      include: [{ model: Equipo }]
    });

    const torneo = await Torneo.findByPk(torneoId);

    if (!torneo) {
      req.flash("danger", "Torneo no encontrado");
      return res.redirect("/torneos");
    }

    res.render('torneos/index', { torneo, grupos});
  } catch (error) {
    console.error("Error al obtener grupos:", error);
    res.status(500).send('Error al obtener grupos');
  }
};

// Editar nombre del grupo
exports.editar = async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const { nombre_grupo, entity_id } = req.body;

    const grupo = await Grupo.findByPk(id_grupo);
    if (!grupo) {
      req.flash("danger", "Grupo no encontrado");
      return res.redirect(volverAtras(req));
    }

    grupo.nombre_grupo = nombre_grupo;
    grupo.entity_id = entity_id || req.session.entity_id;
    await grupo.save();

    req.flash("success", "Nombre del grupo actualizado");
    res.redirect(`/torneos/gestionar/${grupo.id_torneo}`);
  } catch (error) {
    console.error("Error al editar grupo:", error);
    req.flash("danger", "No se pudo actualizar el grupo");
    res.redirect("back");
  }
};

// Eliminar grupo
exports.eliminar = async (req, res) => {
  try {
    const { id_grupo } = req.params;
    const grupo = await Grupo.findByPk(id_grupo, { include: [Equipo] });

    if (!grupo) {
      req.flash("danger", "Grupo no encontrado");
      return res.redirect("back");
    }

    if (grupo.Equipos && grupo.Equipos.length > 0) {
      req.flash("danger", "No se puede eliminar: el grupo contiene equipos");
      return res.redirect(`/torneos/gestionar/${grupo.id_torneo}`);
    }

    await grupo.destroy();
    req.flash("success", "Grupo eliminado con éxito");
    res.redirect(`/torneos/gestionar/${grupo.id_torneo}`);
  } catch (error) {
    console.error("Error al eliminar grupo:", error);
    req.flash("danger", "Error al eliminar grupo");
    res.redirect(volverAtras(req));
  }
};
