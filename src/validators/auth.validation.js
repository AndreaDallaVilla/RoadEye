const { Joi, objectId, text } = require("./common.validation");
const {
  REGEX_CODICE_FISCALE,
  REGEX_CODICE_IPA,
  REGEX_CODICE_UNIVOCO,
  REGEX_NOME_UTENTE_PUBBLICO,
  TIPI_UTENTE,
  VALORI_SESSI,
  VALORI_TIPI_UTENTE,
} = require("../utils/constants");

const email = Joi.string().trim().lowercase().email({ tlds: false }).max(254);
const password = Joi.string().min(1).max(128);
const otpCode = Joi.string().trim().pattern(/^[0-9]{6}$/);
const codiceFiscale = Joi.string().trim().uppercase().pattern(REGEX_CODICE_FISCALE);
const codiceIpa = Joi.string().trim().uppercase().pattern(REGEX_CODICE_IPA);
const codiceUnivoco = Joi.string().trim().uppercase().pattern(REGEX_CODICE_UNIVOCO);
const codiceMfa = Joi.string().trim().pattern(/^[0-9]{6}$/);

const registerSchema = Joi.object({
  tipoUtente: Joi.string().valid(...VALORI_TIPI_UTENTE).required(),
  email: email.required(),
  codiceFiscale: codiceFiscale.required(),
  password: password.required(),
  codiceVerificaEmail: otpCode.optional(),
  consensoTrattamentoDati: Joi.boolean().truthy("true").falsy("false").when("tipoUtente", {
    is: TIPI_UTENTE.UTENTE_REGISTRATO,
    then: Joi.valid(true).required(),
    otherwise: Joi.strip(),
  }),
  localizzazioneAttiva: Joi.boolean().truthy("true").falsy("false").optional(),
  notificheAttive: Joi.boolean().truthy("true").falsy("false").optional(),

  nome: text({ max: 80 }).when("tipoUtente", {
    is: TIPI_UTENTE.UTENTE_REGISTRATO,
    then: Joi.required(),
    otherwise: Joi.strip(),
  }),
  cognome: text({ max: 80 }).when("tipoUtente", {
    is: TIPI_UTENTE.UTENTE_REGISTRATO,
    then: Joi.required(),
    otherwise: Joi.strip(),
  }),
  nomeUtentePubblico: Joi.string()
    .trim()
    .pattern(REGEX_NOME_UTENTE_PUBBLICO)
    .optional()
    .when("tipoUtente", {
      is: TIPI_UTENTE.UTENTE_REGISTRATO,
      otherwise: Joi.strip(),
    }),
  dataNascita: Joi.date().iso().max("now").when("tipoUtente", {
    is: TIPI_UTENTE.UTENTE_REGISTRATO,
    then: Joi.required(),
    otherwise: Joi.strip(),
  }),
  luogoNascita: text({ max: 120 }).when("tipoUtente", {
    is: TIPI_UTENTE.UTENTE_REGISTRATO,
    then: Joi.required(),
    otherwise: Joi.strip(),
  }),
  sesso: Joi.string().valid(...VALORI_SESSI).when("tipoUtente", {
    is: TIPI_UTENTE.UTENTE_REGISTRATO,
    then: Joi.required(),
    otherwise: Joi.strip(),
  }),
  nazioneTelefono: Joi.string().trim().uppercase().length(2).optional().when("tipoUtente", {
    is: TIPI_UTENTE.UTENTE_REGISTRATO,
    otherwise: Joi.strip(),
  }),
  numeroTelefono: Joi.string().trim().pattern(/^[0-9+\s().-]{5,30}$/).optional().when("tipoUtente", {
    is: TIPI_UTENTE.UTENTE_REGISTRATO,
    otherwise: Joi.strip(),
  }),

  denominazione: text({ max: 160 }).when("tipoUtente", {
    is: TIPI_UTENTE.ENTE_PUBBLICO,
    then: Joi.required(),
    otherwise: Joi.strip(),
  }),
  pec: email.when("tipoUtente", {
    is: TIPI_UTENTE.ENTE_PUBBLICO,
    then: Joi.required(),
    otherwise: Joi.strip(),
  }),
  codiceIpa: codiceIpa.when("tipoUtente", {
    is: TIPI_UTENTE.ENTE_PUBBLICO,
    then: Joi.required(),
    otherwise: Joi.strip(),
  }),
  codiceUnivoco: codiceUnivoco.when("tipoUtente", {
    is: TIPI_UTENTE.ENTE_PUBBLICO,
    then: Joi.optional(),
    otherwise: Joi.strip(),
  }),
  categoria: text({ max: 80 }).optional().strip(),
}).and("nazioneTelefono", "numeroTelefono");

const loginSchema = Joi.object({
  email: email.optional(),
  publicEntityId: objectId.optional(),
  pec: email.when("publicEntityId", {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  codiceFiscale: codiceFiscale.optional(),
  codiceIpa: codiceIpa.when("publicEntityId", {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  codiceUnivoco: codiceUnivoco.optional(),
  password: password.required(),
  codiceMfa: codiceMfa.optional(),
}).or("email", "publicEntityId", "codiceFiscale");

const emailOnlySchema = Joi.object({
  email: email.required(),
});

const resetPasswordSchema = Joi.object({
  email: email.required(),
  codiceReset: otpCode.required(),
  password: password.optional(),
  nuovaPassword: password.optional(),
}).xor("password", "nuovaPassword");

const phoneCountriesQuerySchema = Joi.object({
  locale: Joi.string().trim().lowercase().pattern(/^[a-z]{2}(-[a-z]{2})?$/).default("it"),
});

module.exports = {
  emailOnlySchema,
  loginSchema,
  phoneCountriesQuerySchema,
  registerSchema,
  resetPasswordSchema,
};
