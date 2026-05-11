// models/DelegadoEquipo.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DelegadoEquipo = sequelize.define('DelegadoEquipo', {
    id_delegado_equipo: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'id_delegado_equipo'
    },
    id_equipo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_equipo'
    },
    id_usuario: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'id_usuario'
    },
    rol: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'rol'
    }
  }, {
    tableName: 'delegados_equipos',
    timestamps: false
  });

  // 🔑 Asociaciones
  DelegadoEquipo.associate = (models) => {
  DelegadoEquipo.belongsTo(models.Equipo, { foreignKey: 'id_equipo', as: 'Equipo' });
  DelegadoEquipo.belongsTo(models.Usuario, { foreignKey: 'id_usuario', as: 'Usuario' });
};


  return DelegadoEquipo;
};
