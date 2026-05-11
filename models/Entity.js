
// models/Entity.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Entity = sequelize.define('Entity', {
    entity_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    codigo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'entity',
    timestamps: false,
    underscored: true // ✅ asegura que Sequelize use nombres con guión bajo
  });

  return Entity;
};
