// models/Grupo.js
module.exports = (sequelize, DataTypes) => {
  const Grupo = sequelize.define('Grupo', {
    id_grupo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre_grupo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    id_torneo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,   // 🔑 ahora es obligatorio
      references: {
        model: 'entity',  // referencia a la tabla entity
        key: 'entity_id'
      }
    }
  }, {
    tableName: 'grupos',
    timestamps: false
  });

  return Grupo;
};
