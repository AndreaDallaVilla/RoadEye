const mapsService = require("../services/maps.service");

async function geocode(req, res, next) {
  try {
    const result = await mapsService.geocodificaIndirizzo(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function reverseGeocode(req, res, next) {
  try {
    const result = await mapsService.geocodificaInversa(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function nearestRoad(req, res, next) {
  try {
    const result = await mapsService.trovaStradaVicina(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

function getEmbedUrl(req, res, next) {
  try {
    const result = mapsService.creaEmbedUrl(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

function getClientConfig(_req, res, next) {
  try {
    const result = mapsService.creaConfigurazioneClient();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  geocode,
  getClientConfig,
  getEmbedUrl,
  nearestRoad,
  reverseGeocode,
};
