// models/Equipo.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Equipo = sequelize.define('Equipo', {
    id_equipo: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'id_equipo'
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'nombre'
    },
    icono: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'icono'
    },
    id_torneo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_torneo'
    },
    id_grupo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'id_grupo'
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'entity_id'
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'estado'
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'observaciones'
    }
  }, {
    tableName: 'equipos',
    timestamps: false
  });

  // 🔑 Asociaciones
  Equipo.associate = (models) => {
    Equipo.belongsTo(models.Grupo, { foreignKey: 'id_grupo', as: 'Grupo' });
    Equipo.belongsTo(models.Torneo, { foreignKey: 'id_torneo', as: 'Torneo' });

    Equipo.hasMany(models.DelegadoEquipo, { foreignKey: 'id_equipo', as: 'Delegados' });

    Equipo.belongsToMany(models.Jugador, {
      through: models.JugadorEquipo,
      foreignKey: 'id_equipo',
      otherKey: 'id_jugador',
      as: 'Jugadores'
    });
  };

  // 🔧 Hook para asignar icono por defecto
  Equipo.beforeCreate((equipo) => {
    if (!equipo.icono) {
      equipo.icono = '/images/default_team.png';
    }
  });

  return Equipo;
};
