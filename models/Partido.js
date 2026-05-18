const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Partido = sequelize.define('Partido', {
    id_partido: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    id_torneo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    equipo_a: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    equipo_b: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    hora: {
      type: DataTypes.TIME,
      allowNull: true
    },
    estado: {
      type: DataTypes.STRING(20),
      defaultValue: 'programado'
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    numero_fecha: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    goles_a: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    goles_b: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    id_grupo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    id_cancha: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'partidos',
    timestamps: false
  });

  return Partido;
};
