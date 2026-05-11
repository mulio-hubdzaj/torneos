const sequelize = require('./config/config');

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida correctamente con PostgreSQL.');
  } catch (error) {
    console.error('❌ Error al conectar con PostgreSQL:', error);
  } finally {
    await sequelize.close();
  }
}

testConnection();
