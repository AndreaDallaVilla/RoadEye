const {
  REGOLE_IDENTIFICAZIONE_ENTI_PUBBLICI,
} = require("./constants");

function normalizzaValore(valore) {
  return typeof valore === "string" ? valore.trim().toUpperCase() : "";
}

function normalizzaCodiceFiscale(codiceFiscale) {
  return normalizzaValore(codiceFiscale);
}

function normalizzaCodiceIpa(codiceIpa) {
  return normalizzaValore(codiceIpa).replace(/\s+/g, "_");
}

function normalizzaCodiceUnivoco(codiceUnivoco) {
  return normalizzaValore(codiceUnivoco).replace(/\s+/g, "");
}

function regolaCombacia(codici, regola) {
  if (regola.codiceFiscale && regola.codiceFiscale !== codici.codiceFiscale) {
    return false;
  }

  if (regola.codiceIpa && regola.codiceIpa !== codici.codiceIpa) {
    return false;
  }

  if (
    regola.codiceIpaContiene &&
    !codici.codiceIpa.includes(regola.codiceIpaContiene)
  ) {
    return false;
  }

  if (
    regola.codiceIpaIniziaCon &&
    !codici.codiceIpa.startsWith(regola.codiceIpaIniziaCon)
  ) {
    return false;
  }

  if (regola.codiceUnivoco && regola.codiceUnivoco !== codici.codiceUnivoco) {
    return false;
  }

  return true;
}

function identificaEntePubblico({
  codiceFiscale,
  codiceIpa,
  codiceUnivoco,
}) {
  const codiciNormalizzati = {
    codiceFiscale: normalizzaCodiceFiscale(codiceFiscale),
    codiceIpa: normalizzaCodiceIpa(codiceIpa),
    codiceUnivoco: normalizzaCodiceUnivoco(codiceUnivoco),
  };

  const regolaTrovata = REGOLE_IDENTIFICAZIONE_ENTI_PUBBLICI.find((regola) =>
    regolaCombacia(codiciNormalizzati, regola),
  );

  if (!regolaTrovata) {
    return null;
  }

  return {
    identificatore: regolaTrovata.identificativoIstituzionale,
    categoria: regolaTrovata.categoria,
    denominazione: regolaTrovata.denominazione,
  };
}

module.exports = {
  identificaEntePubblico,
  normalizzaCodiceFiscale,
  normalizzaCodiceIpa,
  normalizzaCodiceUnivoco,
};
