const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Jugador = sequelize.define('Jugador', {
    id_jugador: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    apellido: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    documento: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    fecha_nacimiento: {
      type: DataTypes.DATE,
      allowNull: false
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'jugadores',
    timestamps: false
  });

  // Asociación solo para consultas, no para create
  Jugador.associate = (models) => {
    Jugador.hasMany(models.JugadorEquipo, {
      foreignKey: 'id_jugador',
      as: 'Vinculos'
    });
  };

  return Jugador;
};
