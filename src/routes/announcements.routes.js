// definizione dell'interfaccia API
const express = require('express');
const router = express.Router();
const annuncioController = require('../controllers/annuncioController');

router.post('/', annuncioController.crea);

module.exports = router;