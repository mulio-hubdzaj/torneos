const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EquipoMovimientoGrupo = sequelize.define('EquipoMovimientoGrupo', {
    id_movimiento: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    id_equipo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_torneo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_grupo_origen: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_grupo_destino: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    fecha_movimiento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    id_usuario: {
      type: DataTypes.UUID,
      allowNull: true
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'equipos_movimientos_grupo',
    timestamps: false
  });

  EquipoMovimientoGrupo.associate = (models) => {
    EquipoMovimientoGrupo.belongsTo(models.Equipo, { foreignKey: 'id_equipo', as: 'Equipo' });
    EquipoMovimientoGrupo.belongsTo(models.Torneo, { foreignKey: 'id_torneo', as: 'Torneo' });
    EquipoMovimientoGrupo.belongsTo(models.Grupo, { foreignKey: 'id_grupo_origen', as: 'GrupoOrigen' });
    EquipoMovimientoGrupo.belongsTo(models.Grupo, { foreignKey: 'id_grupo_destino', as: 'GrupoDestino' });
    EquipoMovimientoGrupo.belongsTo(models.Usuario, { foreignKey: 'id_usuario', as: 'Usuario' });
  };

  return EquipoMovimientoGrupo;
};
