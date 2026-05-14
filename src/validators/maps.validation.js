const { Joi, text } = require("./common.validation");

const geocodeQuerySchema = Joi.object({
  indirizzo: text({ max: 300 }).optional(),
  address: text({ max: 300 }).optional(),
  area: Joi.string().valid("trentino").optional(),
}).or("indirizzo", "address");

const reverseGeocodeQuerySchema = Joi.object({
  latitudine: Joi.number().min(-90).max(90).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  longitudine: Joi.number().min(-180).max(180).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  lon: Joi.number().min(-180).max(180).optional(),
})
  .or("latitudine", "lat")
  .or("longitudine", "lng", "lon");

const nearestRoadQuerySchema = Joi.object({
  latitudine: Joi.number().min(-90).max(90).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  longitudine: Joi.number().min(-180).max(180).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  lon: Joi.number().min(-180).max(180).optional(),
  distanzaMassimaMetri: Joi.number().min(1).max(100).optional(),
})
  .or("latitudine", "lat")
  .or("longitudine", "lng", "lon");

const embedUrlQuerySchema = Joi.object({
  query: text({ max: 300 }).optional(),
  indirizzo: text({ max: 300 }).optional(),
  address: text({ max: 300 }).optional(),
  placeId: Joi.string().trim().max(160).optional(),
  place_id: Joi.string().trim().max(160).optional(),
  latitudine: Joi.number().min(-90).max(90).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  longitudine: Joi.number().min(-180).max(180).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  lon: Joi.number().min(-180).max(180).optional(),
  zoom: Joi.number().integer().min(1).max(21).optional(),
}).or("query", "indirizzo", "address", "placeId", "place_id", "latitudine", "lat");

module.exports = {
  embedUrlQuerySchema,
  geocodeQuerySchema,
  nearestRoadQuerySchema,
  reverseGeocodeQuerySchema,
};
