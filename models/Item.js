module.exports = (sequelize, DataTypes) => {
  const Item = sequelize.define('Item', {
    id_item: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    monto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_torneo: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'items',
    timestamps: false
  });

  return Item;
};
