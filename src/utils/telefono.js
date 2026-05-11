const {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} = require("libphonenumber-js");

const PAESI_TELEFONO = Object.freeze(getCountries());
const PREFISSI_TELEFONO = Object.freeze(
  Array.from(new Set(PAESI_TELEFONO.map((codicePaese) => `+${getCountryCallingCode(codicePaese)}`))),
);

function creaBandieraPaese(codicePaese) {
  return codicePaese
    .toUpperCase()
    .replace(/./g, (carattere) => String.fromCodePoint(127397 + carattere.charCodeAt(0)));
}

function costruisciListaPaesiTelefono(locale = "it") {
  const displayNames = typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames([locale], { type: "region" })
    : null;

  return PAESI_TELEFONO.map((codicePaese) => ({
    codice: codicePaese,
    nome: displayNames?.of(codicePaese) || codicePaese,
    prefisso: `+${getCountryCallingCode(codicePaese)}`,
    bandiera: creaBandieraPaese(codicePaese),
  })).sort((a, b) => a.nome.localeCompare(b.nome, locale));
}

function normalizzaTelefono({ nazioneTelefono, numeroTelefono } = {}) {
  const paeseCodice = typeof nazioneTelefono === "string" ? nazioneTelefono.trim().toUpperCase() : "";
  const numeroInserito = typeof numeroTelefono === "string" ? numeroTelefono.trim() : "";

  if (!paeseCodice && !numeroInserito) {
    return {
      nazioneTelefono: undefined,
      prefissoTelefono: undefined,
      numeroTelefono: undefined,
    };
  }

  if (!PAESI_TELEFONO.includes(paeseCodice)) {
    return {
      errore: "Seleziona una nazione valida per il numero di telefono",
    };
  }

  if (!numeroInserito) {
    return {
      errore: "Inserisci il numero di telefono",
    };
  }

  const telefono = parsePhoneNumberFromString(numeroInserito, paeseCodice);

  if (!telefono || telefono.country !== paeseCodice || !telefono.isValid()) {
    return {
      errore: `Il numero di telefono non e coerente con il prefisso +${getCountryCallingCode(paeseCodice)}`,
    };
  }

  return {
    nazioneTelefono: paeseCodice,
    prefissoTelefono: `+${telefono.countryCallingCode}`,
    numeroTelefono: telefono.number,
  };
}

module.exports = {
  PAESI_TELEFONO,
  PREFISSI_TELEFONO,
  costruisciListaPaesiTelefono,
  normalizzaTelefono,
};
