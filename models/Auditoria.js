const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Auditoria = sequelize.define('Auditoria', {
    id_auditoria: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    id_usuario: {
      type: DataTypes.UUID, // debe coincidir con Usuario.id_usuario
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id_usuario'
      }
    },
    accion: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tabla_afectada: {
      type: DataTypes.STRING,
      allowNull: true
    },
    detalle: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('detalle');
        try {
          return rawValue ? JSON.parse(rawValue) : null;
        } catch (e) {
          return rawValue;
        }
      },
      set(value) {
        if (typeof value === 'object') {
          this.setDataValue('detalle', JSON.stringify(value));
        } else {
          this.setDataValue('detalle', value);
        }
      }
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'entity',
        key: 'entity_id'
      }
    },
    documento: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'auditoria',
    timestamps: false,
    underscored: true // ✅ asegura que Sequelize use nombres con guión bajo
  });

  return Auditoria;
};
