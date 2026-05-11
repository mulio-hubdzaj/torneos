const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const JugadorEquipo = sequelize.define('JugadorEquipo', {
    id_jugador_equipo: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    id_jugador: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_equipo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    id_torneo: {                     // 👈 faltaba
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'torneos',
        key: 'id_torneo'
      }
    },
    tipo_vinculo: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    observaciones: {              
      type: DataTypes.TEXT,
      allowNull: true
    },
    numero_camiseta: {              // 👈 faltaba
      type: DataTypes.INTEGER,
      allowNull: true
    },
    capitan: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'jugadores_equipos',
    timestamps: false
  });

  JugadorEquipo.associate = (models) => {
    JugadorEquipo.belongsTo(models.Jugador, {
      foreignKey: 'id_jugador',
      as: 'Jugador'
    });

    JugadorEquipo.belongsTo(models.Equipo, {
      foreignKey: 'id_equipo',
      as: 'Equipo'
    });

    JugadorEquipo.belongsTo(models.Torneo, {   // 👈 opcional, si querés navegar torneo
      foreignKey: 'id_torneo',
      as: 'Torneo'
    });
  };

  return JugadorEquipo;
};
