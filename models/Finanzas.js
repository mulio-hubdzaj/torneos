const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Finanzas = sequelize.define('Finanzas', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    id_torneo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    concepto: {
      type: DataTypes.STRING,
      allowNull: false
    },
    monto: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false
    },
    fecha: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'finanzas',
    timestamps: false
  });

  return Finanzas;
};
