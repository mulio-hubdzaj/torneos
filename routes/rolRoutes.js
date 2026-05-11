const express = require('express');
const router = express.Router();
const rolController = require('../controllers/rolController');

router.get('/', rolController.listar);
router.post('/', rolController.crear);

module.exports = router;
