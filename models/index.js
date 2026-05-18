// models/index.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

// Importar modelos
const Usuario = require('./Usuario')(sequelize, DataTypes);
const Entity = require('./Entity')(sequelize, DataTypes);
const Torneo = require('./Torneo')(sequelize, DataTypes);
const Grupo = require('./Grupo')(sequelize, DataTypes);
const Equipo = require('./Equipo')(sequelize, DataTypes);
const Item = require('./Item')(sequelize, DataTypes);
const Partido = require('./Partido')(sequelize, DataTypes);
const Auditoria = require('./Auditoria')(sequelize, DataTypes);
const Jugador = require('./Jugador')(sequelize, DataTypes);
const JugadorEquipo = require('./JugadorEquipo')(sequelize, DataTypes);
const DelegadoEquipo = require('./DelegadoEquipo')(sequelize, DataTypes);
const EquipoMovimientoGrupo = require('./EquipoMovimientoGrupo')(sequelize, DataTypes);
const Cancha = require('./Cancha')(sequelize, DataTypes);

// Guardar en objeto db
const db = {
  sequelize,
  Usuario,
  Entity,
  Torneo,
  Grupo,
  Equipo,
  Item,
  Partido,
  Auditoria,
  Jugador,
  JugadorEquipo,
  DelegadoEquipo,
  EquipoMovimientoGrupo,
  Cancha
};

// 🔑 Ejecutar asociaciones si existen
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Asociaciones básicas que ya tenías
Torneo.hasMany(Grupo, { foreignKey: 'id_torneo' });
Grupo.belongsTo(Torneo, { foreignKey: 'id_torneo' });

Grupo.hasMany(Equipo, { foreignKey: 'id_grupo' });
Equipo.belongsTo(Grupo, { foreignKey: 'id_grupo' });

Torneo.hasMany(Equipo, { foreignKey: 'id_torneo' });
Equipo.belongsTo(Torneo, { foreignKey: 'id_torneo' });

module.exports = db;
