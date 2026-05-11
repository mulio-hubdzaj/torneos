const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Resultado = sequelize.define('Resultado', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    goles_local: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    goles_visitante: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'resultados',
    timestamps: false
  });

  return Resultado;
};
