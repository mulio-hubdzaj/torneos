const express = require('express');
const router = express.Router();
const usoController = require('../controllers/usoController');

router.post('/ping', usoController.registrarPing);

module.exports = router;
