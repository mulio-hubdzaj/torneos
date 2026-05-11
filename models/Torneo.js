const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Torneo = sequelize.define('Torneo', {
    id_torneo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre_torneo: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    temporada: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: true
    },
    portada: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'torneos',
    timestamps: false
  });

  return Torneo;
};
