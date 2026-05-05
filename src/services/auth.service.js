const User = require("../models/User");
const PublicEntity = require("../models/PublicEntity");

const {
  STATI_ACCOUNT,
  TIPI_UTENTE,
} = require("../utils/constants");

//Gestione degli errori dovuti a incongruenze con i campi interessati
const createHttpError = require("../utils/httpError");
const { normalizzaCodiceFiscale } = require("../utils/codiceFiscale");
const {
  normalizzaCodiceIpa,
  normalizzaCodiceUnivoco,
} = require("../utils/identificazioneEntePubblico");

const { assertStrongPassword, hashPassword, verifyPassword } = require("../utils/password");
const {
  createSessionToken,
  getSessionExpiryDate,
  hashSessionToken,
} = require("../utils/sessionToken");

function normalizzaEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function getCodiciEnteDaPayload(payload) {
  return {
    codiceFiscale: normalizzaCodiceFiscale(payload.codiceFiscale),
    codiceIpa: normalizzaCodiceIpa(payload.codiceIpa),
    codiceUnivoco: normalizzaCodiceUnivoco(payload.codiceUnivoco),
  };
}

function normalizzaValoreTesto(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validaCodiceMfa(codiceMfa) {
  const codiceAtteso = process.env.AUTH_MFA_TEST_CODE || "000000";
  return typeof codiceMfa === "string" && codiceMfa.trim() === codiceAtteso;
}

async function trovaUtentePerEmail(email) {
  const utente = await User.findOne({ email }).select("+hashPassword +sessioni");
  if (utente) {
    return utente;
  }

  return PublicEntity.findOne({ email }).select("+hashPassword +sessioni");
}

async function trovaUtentePerLogin(payload) {
  const email = normalizzaEmail(payload.email);
  const codiciEnte = getCodiciEnteDaPayload(payload);

  if (payload.publicEntityId) {
    const ente = await PublicEntity.findById(payload.publicEntityId).select("+hashPassword +sessioni");

    if (!ente) {
      throw createHttpError(401, "Credenziali ente non valide");
    }

    const pec = normalizzaEmail(payload.pec);
    const codiceIpa = normalizzaCodiceIpa(payload.codiceIpa);
    const codiceUnivoco = normalizzaCodiceUnivoco(payload.codiceUnivoco);
    const codiceUnivocoAtteso = normalizzaCodiceUnivoco(ente.profilo?.codiceUnivoco);

    if (!pec || pec !== normalizzaEmail(ente.profilo?.pec)) {
      throw createHttpError(401, "Credenziali ente non valide");
    }

    if (!codiceIpa || codiceIpa !== normalizzaCodiceIpa(ente.profilo?.codiceIpa)) {
      throw createHttpError(401, "Credenziali ente non valide");
    }

    if (codiceUnivocoAtteso && codiceUnivoco !== codiceUnivocoAtteso) {
      throw createHttpError(401, "Credenziali ente non valide");
    }

    return ente;
  }

  if (email) {
    return trovaUtentePerEmail(email);
  }

  if (codiciEnte.codiceFiscale && codiciEnte.codiceIpa && codiciEnte.codiceUnivoco) {
    return PublicEntity.findOne({
      tipoUtente: TIPI_UTENTE.ENTE_PUBBLICO,
      codiceFiscale: codiciEnte.codiceFiscale,
      "profilo.codiceIpa": codiciEnte.codiceIpa,
      "profilo.codiceUnivoco": codiciEnte.codiceUnivoco,
    }).select("+hashPassword +sessioni");
  }

  throw createHttpError(
    400,
    "Per il login inserisci email e password, oppure codice fiscale, codice IPA, codice univoco e password",
  );
}

function rimuoviSessioniScadute(utente) {
  // Rimuove le sessioni scadute prima di aggiungere una nuova sessione attiva.
  const adesso = Date.now();
  utente.sessioni = utente.sessioni.filter(
    (sessione) => sessione.scadeIl.getTime() > adesso,
  );
}

function costruisciProfilo(payload) {
  const tipoUtente = payload.tipoUtente;

  if (tipoUtente === TIPI_UTENTE.UTENTE_REGISTRATO) {
    // Salva solo i campi pertinenti al ruolo selezionato.
    return {
      nome: payload.nome?.trim(),
      cognome: payload.cognome?.trim(),
      nomeUtentePubblico: payload.nomeUtentePubblico?.trim(),
      dataNascita: payload.dataNascita,
      sesso: payload.sesso,
      numeroTelefono: payload.numeroTelefono?.trim(),
    };
  }

  if (tipoUtente === TIPI_UTENTE.ENTE_PUBBLICO) {
    return {
      denominazione: payload.denominazione?.trim(),
      pec: payload.pec?.trim().toLowerCase(),
      codiceIpa: normalizzaCodiceIpa(payload.codiceIpa),
      codiceUnivoco: normalizzaCodiceUnivoco(payload.codiceUnivoco),
      categoria: payload.categoria,
    };
  }

  return {};
}

function sanitizzaUtente(utente) {
  return utente.toJSON();
}

async function verificaCampiUnivoci({
  email,
  codiceFiscale,
  nomeUtentePubblico,
  tipoUtente,
  codiceIpa,
  codiceUnivoco,
}) {
  const utenteConEmail =
    (await User.findOne({ email })) || (await PublicEntity.findOne({ email }));
  if (utenteConEmail) {
    throw createHttpError(409, "Email già in uso");
  }

  if (tipoUtente === TIPI_UTENTE.UTENTE_REGISTRATO) {
    const utenteRegistratoConCodiceFiscale = await User.findOne({
      tipoUtente: TIPI_UTENTE.UTENTE_REGISTRATO,
      codiceFiscale,
    });
    if (utenteRegistratoConCodiceFiscale) {
      throw createHttpError(409, "Codice fiscale già in uso");
    }

    if (nomeUtentePubblico) {
      const utenteConNomePubblico = await User.findOne({
        "profilo.nomeUtentePubblico": nomeUtentePubblico,
      });
      if (utenteConNomePubblico) {
        throw createHttpError(409, "Nome utente pubblico già in uso");
      }
    }
    return;
  }

  if (tipoUtente === TIPI_UTENTE.ENTE_PUBBLICO) {
    const enteEsistente = await PublicEntity.findOne({
      tipoUtente: TIPI_UTENTE.ENTE_PUBBLICO,
      codiceFiscale,
      "profilo.codiceIpa": codiceIpa,
      "profilo.codiceUnivoco": codiceUnivoco,
    });
    if (enteEsistente) {
      throw createHttpError(
        409,
        "Ente già in uso con la stessa combinazione di codice fiscale, codice IPA e codice univoco",
      );
    }
  }
}

async function creaSessioneUtente(utente) {
  rimuoviSessioniScadute(utente);

  const tokenAccesso = createSessionToken();
  const scadeIl = getSessionExpiryDate();

  // Salva solo l'hash del token, cosi logout e controlli restano gestiti dal server.
  utente.sessioni.push({
    hashToken: hashSessionToken(tokenAccesso),
    scadeIl,
  });

  await utente.save();

  return tokenAccesso;
}

async function registerUser(payload) {
  const tipoUtente = payload.tipoUtente;
  const email = normalizzaEmail(payload.email);
  const codiceFiscale = normalizzaCodiceFiscale(payload.codiceFiscale);
  const codiceIpa = normalizzaCodiceIpa(payload.codiceIpa);
  const codiceUnivoco = normalizzaCodiceUnivoco(payload.codiceUnivoco);
  const password = payload.password;
  const nomeUtentePubblico = payload.nomeUtentePubblico?.trim();

  if (!tipoUtente) {
    throw createHttpError(400, "Il tipo utente è obbligatorio");
  }

  if (!Object.values(TIPI_UTENTE).includes(tipoUtente)) {
    throw createHttpError(400, "Il tipo utente non è valido");
  }

  if (!email) {
    throw createHttpError(400, "L'email è obbligatoria");
  }

  if (!codiceFiscale) {
    throw createHttpError(400, "Il codice fiscale è obbligatorio");
  }

  assertStrongPassword(password);
  await verificaCampiUnivoci({
    email,
    codiceFiscale,
    nomeUtentePubblico,
    tipoUtente,
    codiceIpa,
    codiceUnivoco,
  });

  // La password non viene mai salvata in chiaro, nemmeno durante la registrazione iniziale.
  const hashPasswordUtente = await hashPassword(password);
  const accountModel = tipoUtente === TIPI_UTENTE.ENTE_PUBBLICO ? PublicEntity : User;

  const utente = await accountModel.create({
    tipoUtente,
    codiceFiscale,
    email,
    hashPassword: hashPasswordUtente,
    statoAccount: STATI_ACCOUNT.ATTIVO,
    impostazioni: {
      localizzazioneAttiva: Boolean(payload.localizzazioneAttiva),
      mfaAttiva: false,
      notificheAttive: Boolean(payload.notificheAttive),
    },
    profilo: costruisciProfilo(payload),
  });

  const utenteConSessioni = await accountModel.findById(utente._id).select("+sessioni");
  const tokenAccesso = await creaSessioneUtente(utenteConSessioni);
  const utenteCorrente = await accountModel.findById(utente._id);

  return {
    tokenAccesso,
    utente: sanitizzaUtente(utenteCorrente),
  };
}

async function loginUser(payload) {
  const password = payload.password;

  if (!password) {
    throw createHttpError(400, "La password è obbligatoria");
  }

  const utente = await trovaUtentePerLogin(payload);

  if (!utente) {
    throw createHttpError(401, "Credenziali non valide");
  }

  const passwordValida = await verifyPassword(password, utente.hashPassword);

  if (!passwordValida) {
    throw createHttpError(401, "Credenziali non valide");
  }

  if (utente.statoAccount !== STATI_ACCOUNT.ATTIVO) {
    throw createHttpError(403, "L'account non e attivo");
  }

  if (utente.impostazioni?.mfaAttiva) {
    if (!payload.codiceMfa) {
      throw createHttpError(401, "Codice MFA obbligatorio");
    }

    if (!validaCodiceMfa(payload.codiceMfa)) {
      throw createHttpError(401, "Codice MFA non valido");
    }
  }

  // Ogni login genera un nuovo token, cosi dispositivi diversi possono avere sessioni separate.
  const tokenAccesso = await creaSessioneUtente(utente);
  const accountModel = utente.tipoUtente === TIPI_UTENTE.ENTE_PUBBLICO ? PublicEntity : User;
  const utenteCorrente = await accountModel.findById(utente._id);

  return {
    tokenAccesso,
    utente: sanitizzaUtente(utenteCorrente),
  };
}

async function logoutUser(utente, tokenAccesso) {
  const hashToken = hashSessionToken(tokenAccesso);

  // Rimuove solo la sessione corrente invece di invalidare tutti i dispositivi.
  utente.sessioni = utente.sessioni.filter(
    (sessione) => sessione.hashToken !== hashToken,
  );

  await utente.save();
}

function getCurrentUser(utente) {
  return sanitizzaUtente(utente);
}

async function listPublicEntities() {
  const enti = await PublicEntity.find({ tipoUtente: TIPI_UTENTE.ENTE_PUBBLICO })
    .sort({ "profilo.denominazione": 1 })
    .select("profilo.denominazione profilo.codiceUnivoco");

  return enti.map((ente) => ({
    id: ente._id,
    denominazione: normalizzaValoreTesto(ente.profilo?.denominazione),
    richiedeCodiceUnivoco: Boolean(normalizzaValoreTesto(ente.profilo?.codiceUnivoco)),
  }));
}

module.exports = {
  getCurrentUser,
  listPublicEntities,
  loginUser,
  logoutUser,
  registerUser,
};
