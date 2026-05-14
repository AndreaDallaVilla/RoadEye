// definizione dell'interfaccia API
const express = require('express');
const router = express.Router();
const annuncioController = require('../controllers/announcements.controller');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { createAnnouncementSchema } = require('../validators/announcements.validation');

router.get('/active', annuncioController.listaAttivi);
router.post('/', authenticate, validate(createAnnouncementSchema), annuncioController.crea);

module.exports = router;
