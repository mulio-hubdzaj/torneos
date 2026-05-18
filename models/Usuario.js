// models/Usuario.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize) => {
  const Usuario = sequelize.define('Usuario', {
    id_usuario: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    correo: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    contrasena_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    debe_cambiar_contrasena: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    reset_contrasena_en: {
      type: DataTypes.DATE
    },
    rol_id: {
      type: DataTypes.INTEGER
    },
    estado: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    creado_en: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    documento: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    entity_id: {
      type: DataTypes.INTEGER
    }
  }, {
    tableName: 'usuarios',
    timestamps: false
  });

  // Método para validar contraseña
  Usuario.prototype.validarPassword = function (contrasena) {
    return bcrypt.compareSync(contrasena, this.contrasena_hash);
  };

  // 🔑 Asociaciones
  Usuario.associate = (models) => {
  Usuario.hasMany(models.DelegadoEquipo, { foreignKey: 'id_usuario', as: 'DelegadosEquipos' });
};

  return Usuario;
};
