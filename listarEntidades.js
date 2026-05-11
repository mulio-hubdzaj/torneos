const { Entity } = require('./models');

async function listarEntidades() {
  try {
    const entidades = await Entity.findAll({
      where: { activo: true },
      attributes: ['entity_id', 'codigo', 'descripcion']
    });

    console.log('Entidades activas:');
    entidades.forEach(ent => {
      console.log(`ID: ${ent.entity_id}, Código: ${ent.codigo}, Descripción: ${ent.descripcion}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listarEntidades();