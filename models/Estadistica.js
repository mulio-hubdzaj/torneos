const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Estadistica = sequelize.define('Estadistica', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    jugador_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    goles: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    asistencias: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    tarjetas: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'estadisticas',
    timestamps: false
  });

  return Estadistica;
};
