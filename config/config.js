const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('torneos_db', 'postgres', 'Soporte2018', {
  host: 'localhost',
  dialect: 'postgres',
  port: 5432,
});

module.exports = sequelize;
