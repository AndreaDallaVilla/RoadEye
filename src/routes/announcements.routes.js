// definizione dell'interfaccia API
const express = require('express');
const router = express.Router();
const annuncioController = require('../controllers/announcements.controller');

router.get('/active', annuncioController.listaAttivi);
router.post('/', annuncioController.crea);

module.exports = router;
