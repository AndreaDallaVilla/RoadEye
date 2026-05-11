const { Joi, text } = require("./common.validation");

const TOPIC = [
  "Incidente stradale",
  "Cantiere stradale",
  "Evento",
  "Ferimento animali",
  "Pericolo bordo strada",
  "Autovelox",
];

const GRAVITA = ["Bassa", "Media", "Alta", "Altissima"];
const INTERAZIONE_CONSENTITA = ["Utenti Registrati", "Enti pubblici"];

const createAnnouncementSchema = Joi.object({
  descrizione: text({ max: 1000 }).allow("").default(""),
  topic: Joi.string().valid(...TOPIC).required(),
  gravita: Joi.string()
    .valid(...GRAVITA)
    .when("topic", {
      is: Joi.valid("Incidente stradale", "Pericolo bordo strada"),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  ufficiale: Joi.boolean().truthy("true").falsy("false").default(false),
  tempoVitaResiduo: Joi.number().integer().min(0).default(24),
  interazioneConsentita: Joi.string().valid(...INTERAZIONE_CONSENTITA).default("Utenti Registrati"),
  posizione: text({ max: 300 }).allow("").optional(),
  coordinate: Joi.object({
    latitudine: Joi.number().min(-90).max(90).required(),
    longitudine: Joi.number().min(-180).max(180).required(),
  }).optional(),
});

module.exports = {
  createAnnouncementSchema,
};
