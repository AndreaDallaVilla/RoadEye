const TIPI_UTENTE = Object.freeze({
  UTENTE_REGISTRATO: "Utente Registrato",
  ENTE_PUBBLICO: "Ente Pubblico",
});

const VALORI_TIPI_UTENTE = Object.freeze(Object.values(TIPI_UTENTE));

const STATI_ACCOUNT = Object.freeze({
  ATTIVO: "Attivo",
  SOSPESO: "Sospeso",
});

const VALORI_STATI_ACCOUNT = Object.freeze(Object.values(STATI_ACCOUNT));

const SESSI = Object.freeze({
  MASCHIO: "Maschio",
  FEMMINA: "Femmina",
});

const VALORI_SESSI = Object.freeze(Object.values(SESSI));

const CATEGORIE_ENTI_PUBBLICI = Object.freeze({
  COMUNE: "Comune",
  POLIZIA_DI_STATO: "ForzePolizia",
  CARABINIERI: "ForzePolizia",
  POLIZIA_LOCALE: "PoliziaLocale",
  VIGILI_DEL_FUOCO: "VigiliDelfuoco",
  SERVIZIO_DI_SOCCORSO: "ServizioDiSoccorso",
  CENTRALE_OPERATIVA: "CentraleOperativa",
});

const VALORI_CATEGORIE_ENTI_PUBBLICI = Object.freeze(
  Object.values(CATEGORIE_ENTI_PUBBLICI),
);

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_CODICE_FISCALE = /^[A-Z0-9]{11,16}$/;
const REGEX_PEC = REGEX_EMAIL;
const REGEX_CODICE_IPA = /^[A-Z0-9_]{4,10}$/;
const REGEX_CODICE_UNIVOCO = /^[A-Z0-9]{4,10}$/;
const REGEX_NOME_UTENTE_PUBBLICO = /^[a-zA-Z0-9_.-]{3,30}$/;

const REGOLE_IDENTIFICAZIONE_ENTI_PUBBLICI = Object.freeze([
  Object.freeze({
    identificativoIstituzionale: "Carabinieri",
    categoria: CATEGORIE_ENTI_PUBBLICI.CARABINIERI,
    denominazione: "Arma dei Carabinieri - Comando Provinciale",
    codiceFiscale: "80007080213",
    codiceIpa: "CC",
    codiceUnivoco: "Q5D7B5",
  }),
  Object.freeze({
    identificativoIstituzionale: "Polizia_di_stato",
    categoria: CATEGORIE_ENTI_PUBBLICI.POLIZIA_DI_STATO,
    denominazione: "Polizia di Stato - Questura/Commissariato",
    codiceFiscale: "80016810220",
    codiceIpa: "XZR4RNHR",
    codiceUnivoco: "MD6312",
  }),
  Object.freeze({
    identificativoIstituzionale: "Vigili_del_fuoco",
    categoria: CATEGORIE_ENTI_PUBBLICI.VIGILI_DEL_FUOCO,
    denominazione: "Vigili del Fuoco",
    codiceFiscale: "96020750228",
    codiceIpa: "P_TN",
    codiceUnivoco: "1972KO",
  }),
  Object.freeze({
    identificativoIstituzionale: "Polizia_locale",
    categoria: CATEGORIE_ENTI_PUBBLICI.POLIZIA_LOCALE,
    denominazione: "Polizia Locale / Municipale",
    codiceFiscale: "00355870221",
    codiceIpa: "C_1378",
    codiceUnivoco: "KE9B1B",
  }),
  Object.freeze({
    identificativoIstituzionale: "Servizio_di_soccorso",
    categoria: CATEGORIE_ENTI_PUBBLICI.SERVIZIO_DI_SOCCORSO,
    denominazione: "Servizio di soccorso sanitario",
    codiceFiscale: "01429410226",
    codiceIpa: "APSS"
  }),
  Object.freeze({
    identificativoIstituzionale: "comune",
    categoria: CATEGORIE_ENTI_PUBBLICI.COMUNE,
    denominazione: "Comune",
    codiceFiscale: "00355870221",
    codiceIpa: "C_1378",
  }),
  Object.freeze({
    identificativoIstituzionale: "Centrale_Operativa",
    categoria: CATEGORIE_ENTI_PUBBLICI.CENTRALE_OPERATIVA,
    denominazione: "Centrale Operativa",
    codiceFiscale: "00355870221",
    codiceIpa: "P_TN",
    codiceUnivoco: "00EFWV",
  }),
]);

module.exports = {
  CATEGORIE_ENTI_PUBBLICI,
  REGEX_CODICE_FISCALE,
  REGEX_CODICE_IPA,
  REGEX_CODICE_UNIVOCO,
  REGEX_EMAIL,
  REGEX_NOME_UTENTE_PUBBLICO,
  REGEX_PEC,
  REGOLE_IDENTIFICAZIONE_ENTI_PUBBLICI,
  SESSI,
  STATI_ACCOUNT,
  TIPI_UTENTE,
  VALORI_CATEGORIE_ENTI_PUBBLICI,
  VALORI_SESSI,
  VALORI_STATI_ACCOUNT,
  VALORI_TIPI_UTENTE,
};
