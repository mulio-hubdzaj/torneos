const { Usuario } = require('./models');

async function listarUsuarios() {
  try {
    const usuarios = await Usuario.findAll({
      attributes: ['documento', 'entity_id', 'estado'],
      limit: 5
    });

    console.log('Usuarios existentes:');
    usuarios.forEach(user => {
      console.log(`Documento: ${user.documento}, Entity: ${user.entity_id}, Estado: ${user.estado}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listarUsuarios();