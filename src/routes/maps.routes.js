const express = require("express");

const mapsController = require("../controllers/maps.controller");

const router = express.Router();

router.get("/geocode", mapsController.geocode);
router.get("/reverse-geocode", mapsController.reverseGeocode);
router.get("/embed-url", mapsController.getEmbedUrl);

module.exports = router;
