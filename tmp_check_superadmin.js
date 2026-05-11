const { Usuario } = require('./models');

(async () => {
  try {
    const users = await Usuario.findAll({ where: { rol_id: 99 }, limit: 20, attributes: ['id_usuario','nombre','documento','rol_id','entity_id','estado'] });
    console.log('Super admins:', users.map(u => u.get({ plain:true })));
    const example = await Usuario.findOne({ where: { documento: '5160826' }, attributes: ['id_usuario','nombre','documento','rol_id','entity_id','estado'] });
    console.log('Usuario 5160826:', example ? example.get({ plain:true }) : 'not found');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
})();
