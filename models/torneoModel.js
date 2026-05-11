const { DataTypes } = require('sequelize');
const sequelize = require('../config/config');

const Torneo = sequelize.define('Torneo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fecha_inicio: {
    type: DataTypes.DATE,
    allowNull: false
  },
  fecha_fin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'torneos_db', // nombre exacto de la tabla en torneos_db
  timestamps: false
});

module.exports = Torneo;
