const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Cancha = sequelize.define('Cancha', {
    id_cancha: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    id_torneo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    direccion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'canchas',
    timestamps: false
  });

  return Cancha;
};
