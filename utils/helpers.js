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

module.exports = {
  calcularEdad,
  registrarAuditoria
};
