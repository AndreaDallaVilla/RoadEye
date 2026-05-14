const express = require("express");

const mapsController = require("../controllers/maps.controller");
const validate = require("../middlewares/validate");
const {
  embedUrlQuerySchema,
  geocodeQuerySchema,
  nearestRoadQuerySchema,
  reverseGeocodeQuerySchema,
} = require("../validators/maps.validation");

const router = express.Router();

router.get("/geocode", validate(geocodeQuerySchema, "query"), mapsController.geocode);
router.get("/reverse-geocode", validate(reverseGeocodeQuerySchema, "query"), mapsController.reverseGeocode);
router.get("/nearest-road", validate(nearestRoadQuerySchema, "query"), mapsController.nearestRoad);
router.get("/embed-url", validate(embedUrlQuerySchema, "query"), mapsController.getEmbedUrl);
router.get("/client-config", mapsController.getClientConfig);

module.exports = router;
