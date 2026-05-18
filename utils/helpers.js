const { DateTime } = require('luxon');

// Calcular edad (igual que en Flask)
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = DateTime.now();
  const nacimiento = DateTime.fromJSDate(fechaNacimiento);
  let años = hoy.year - nacimiento.year;
  let meses = hoy.month - nacimiento.month;
  if (hoy.day < nacimiento.day) meses -= 1;
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }
  return `${años} años ${meses} meses`;
}

// Registrar auditoría neutralizada
async function registrarAuditoria(usuarioId, documento, tabla, accion, detalle, entityId = null) {
  console.log(">>> registrarAuditoria deshabilitada (auditoría se maneja por triggers en BD)");
  // No hace nada, solo devuelve OK
  return true;
}

async function registrarAccesoAuditoria(usuarioId, entityId, pantalla, detalle = {}) {
  try {
    const { sequelize } = require('../models');
    await sequelize.query(`
      INSERT INTO auditoria (id_usuario, accion, tabla_afectada, detalle, fecha_hora, entity_id)
      VALUES (:usuarioId, 'INGRESO', 'pantalla', CAST(:detalle AS jsonb), now(), :entityId)
    `, {
      replacements: {
        usuarioId: usuarioId || null,
        entityId: entityId || null,
        detalle: JSON.stringify({
          pantalla,
          ...detalle
        })
      }
    });
  } catch (error) {
    console.error('No se pudo registrar acceso en auditoria:', error.message);
  }
}

function debeRegistrarAccesoSesion(req, clave, minutos = 30) {
  if (!req.session) return true;

  const ahora = Date.now();
  const intervalo = minutos * 60 * 1000;
  req.session.auditAccess = req.session.auditAccess || {};

  const ultimo = Number(req.session.auditAccess[clave] || 0);
  if (ultimo && ahora - ultimo < intervalo) {
    return false;
  }

  req.session.auditAccess[clave] = ahora;
  return true;
}

module.exports = {
  calcularEdad,
  registrarAuditoria,
  registrarAccesoAuditoria,
  debeRegistrarAccesoSesion
};
