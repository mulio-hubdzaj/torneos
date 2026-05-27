const { sequelize } = require('../models');

function normalizarOrigen(valor) {
  const origen = String(valor || '').trim().toLowerCase();
  return origen === 'apk' ? 'apk' : 'web';
}

async function tablaUsoExiste() {
  const [resultado] = await sequelize.query(
    "SELECT to_regclass('public.app_uso_diario') AS tabla",
    { type: sequelize.QueryTypes.SELECT }
  );
  return Boolean(resultado && resultado.tabla);
}

exports.registrarPing = async (req, res) => {
  try {
    if (!req.session?.usuario_id) {
      return res.status(204).end();
    }

    if (!(await tablaUsoExiste())) {
      return res.status(204).end();
    }

    const origen = normalizarOrigen(req.body?.origen || req.get('X-Torneos-Client'));
    await sequelize.query(`
      INSERT INTO app_uso_diario (
        fecha,
        usuario_id,
        entity_id,
        rol_id,
        origen,
        primer_acceso,
        ultimo_acceso,
        cantidad_pings
      )
      VALUES (
        CURRENT_DATE,
        :usuarioId,
        :entityId,
        :rolId,
        :origen,
        NOW(),
        NOW(),
        1
      )
      ON CONFLICT (fecha, usuario_id, origen)
      DO UPDATE SET
        ultimo_acceso = NOW(),
        entity_id = EXCLUDED.entity_id,
        rol_id = EXCLUDED.rol_id,
        cantidad_pings = app_uso_diario.cantidad_pings + 1
    `, {
      replacements: {
        usuarioId: req.session.usuario_id,
        entityId: req.session.entity_id || null,
        rolId: req.session.rol_id || null,
        origen
      },
      type: sequelize.QueryTypes.INSERT
    });

    return res.status(204).end();
  } catch (error) {
    console.error('Error al registrar uso de app:', error);
    return res.status(204).end();
  }
};
