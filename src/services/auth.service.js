const User = require("../models/User");
const PublicEntity = require("../models/PublicEntity");
const EmailOtp = require("../models/EmailOtp");
const emailService = require("./email.service");

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
const { costruisciListaPaesiTelefono, normalizzaTelefono } = require("../utils/telefono");
const {
  OTP_MAX_ATTEMPTS,
  createOtpCode,
  getOtpExpiryDate,
  hashOtpCode,
} = require("../utils/emailOtp");
const {
  isAccountLocked,
  getAccountLockedErrorMessage,
  registraLoginFallito,
  azzeraLoginFalliti,
} = require("../utils/accountLockout");
const {
  logSecurityEvent,
  SECURITY_EVENTS,
} = require("../utils/securityAudit");

const OTP_PURPOSES = Object.freeze({
  EMAIL_VERIFICATION: "email-verification",
  PASSWORD_RESET: "password-reset",
});
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS || 60);

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
    const telefono = normalizzaTelefono({
      nazioneTelefono: payload.nazioneTelefono,
      numeroTelefono: payload.numeroTelefono,
    });

    if (telefono.errore) {
      throw createHttpError(400, telefono.errore);
    }

    // Salva solo i campi pertinenti al ruolo selezionato.
    return {
      nome: payload.nome?.trim(),
      cognome: payload.cognome?.trim(),
      nomeUtentePubblico: payload.nomeUtentePubblico?.trim(),
      dataNascita: payload.dataNascita,
      luogoNascita: payload.luogoNascita?.trim(),
      sesso: payload.sesso,
      numeroTelefono: telefono.numeroTelefono,
      nazioneTelefono: telefono.nazioneTelefono,
      prefissoTelefono: telefono.prefissoTelefono,
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

async function creaOtpEmail(email, purpose) {
  const existingOtp = await EmailOtp.findOne({ email, purpose }).sort({ createdAt: -1 });

  if (existingOtp) {
    const elapsedSeconds = Math.floor((Date.now() - existingOtp.createdAt.getTime()) / 1000);
    const remainingSeconds = OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;

    if (remainingSeconds > 0) {
      throw createHttpError(
        429,
        `Attendi ${remainingSeconds} secondi prima di richiedere un nuovo codice`,
      );
    }
  }

  const code = createOtpCode();

  await EmailOtp.deleteMany({ email, purpose });
  await EmailOtp.create({
    email,
    purpose,
    codeHash: hashOtpCode(email, purpose, code),
    expiresAt: getOtpExpiryDate(),
  });

  if (purpose === OTP_PURPOSES.PASSWORD_RESET) {
    await emailService.sendPasswordResetCode(email, code);
    return;
  }

  await emailService.sendEmailVerificationCode(email, code);
}

async function requestEmailVerification(payload) {
  const email = normalizzaEmail(payload.email);

  if (!email) {
    throw createHttpError(400, "L'email Ã¨ obbligatoria");
  }

  const utenteConEmail =
    (await User.findOne({ email })) || (await PublicEntity.findOne({ email }));
  if (utenteConEmail) {
    throw createHttpError(409, "Email giÃ  in uso");
  }

  await creaOtpEmail(email, OTP_PURPOSES.EMAIL_VERIFICATION);

  return {
    message: "Codice di verifica inviato all'email indicata",
  };
}

async function verificaOtpEmail(email, purpose, code) {
  const codice = typeof code === "string" ? code.trim() : "";

  if (!/^[0-9]{6}$/.test(codice)) {
    throw createHttpError(400, "Codice monouso non valido");
  }

  const otp = await EmailOtp.findOne({ email, purpose }).select("+codeHash");

  if (!otp || otp.expiresAt.getTime() <= Date.now()) {
    throw createHttpError(400, "Codice monouso scaduto o non richiesto");
  }

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await EmailOtp.deleteOne({ _id: otp._id });
    throw createHttpError(429, "Troppi tentativi: richiedi un nuovo codice");
  }

  if (otp.codeHash !== hashOtpCode(email, purpose, codice)) {
    otp.attempts += 1;
    await otp.save();
    throw createHttpError(400, "Codice monouso errato");
  }

  otp.verifiedAt = new Date();
  await otp.save();
  return otp;
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

  await utente.save({ validateBeforeSave: false });

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
  const consensoTrattamentoDati = payload.consensoTrattamentoDati === true;

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

  if (tipoUtente === TIPI_UTENTE.UTENTE_REGISTRATO && !consensoTrattamentoDati) {
    throw createHttpError(400, "Per registrarti devi accettare il trattamento dei dati personali");
  }

  await verificaCampiUnivoci({
    email,
    codiceFiscale,
    nomeUtentePubblico,
    tipoUtente,
    codiceIpa,
    codiceUnivoco,
  });

  let otpVerificaEmail = null;
  if (!payload.codiceVerificaEmail) {
    await creaOtpEmail(email, OTP_PURPOSES.EMAIL_VERIFICATION);
    return {
      richiedeVerificaEmail: true,
      message: "Codice di verifica inviato all'email indicata",
    };
  }

  otpVerificaEmail = await verificaOtpEmail(
    email,
    OTP_PURPOSES.EMAIL_VERIFICATION,
    payload.codiceVerificaEmail,
  );

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
    consensi: {
      trattamentoDati: consensoTrattamentoDati,
      trattamentoDatiAccettatoIl: consensoTrattamentoDati ? new Date() : undefined,
    },
    profilo: costruisciProfilo(payload),
  });

  const utenteConSessioni = await accountModel.findById(utente._id).select("+sessioni");
  const tokenAccesso = await creaSessioneUtente(utenteConSessioni);
  const utenteCorrente = await accountModel.findById(utente._id);
  await EmailOtp.deleteOne({ _id: otpVerificaEmail._id });

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

  // Unified error message per security
  const CREDENZIALI_NON_VALIDE = "Credenziali non valide";

  let utente;
  try {
    utente = await trovaUtentePerLogin(payload);
  } catch (error) {
    // Se trovaUtentePerLogin lancia errore, ritorna unified message
    logSecurityEvent({
      type: SECURITY_EVENTS.LOGIN_FAILED,
      reason: "invalid_credentials",
      ip: payload._ipAddress,
    });
    throw createHttpError(401, CREDENZIALI_NON_VALIDE);
  }

  if (!utente) {
    logSecurityEvent({
      type: SECURITY_EVENTS.LOGIN_FAILED,
      reason: "user_not_found",
      ip: payload._ipAddress,
    });
    throw createHttpError(401, CREDENZIALI_NON_VALIDE);
  }

  // Controlla se account è bloccato per troppi tentativi falliti
  if (isAccountLocked(utente)) {
    logSecurityEvent({
      type: SECURITY_EVENTS.LOGIN_FAILED,
      reason: "account_locked",
      userId: utente._id,
      ip: payload._ipAddress,
    });
    throw createHttpError(429, getAccountLockedErrorMessage(utente));
  }

  const passwordValida = await verifyPassword(password, utente.hashPassword);

  if (!passwordValida) {
    // Registra tentativo fallito
    await registraLoginFallito(utente);

    logSecurityEvent({
      type: SECURITY_EVENTS.LOGIN_FAILED,
      reason: "invalid_password",
      userId: utente._id,
      ip: payload._ipAddress,
      attempts: utente.sicurezza?.tentativi_login_falliti || 0,
    });

    throw createHttpError(401, CREDENZIALI_NON_VALIDE);
  }

  if (utente.statoAccount !== STATI_ACCOUNT.ATTIVO) {
    logSecurityEvent({
      type: SECURITY_EVENTS.LOGIN_FAILED,
      reason: "account_inactive",
      userId: utente._id,
      ip: payload._ipAddress,
    });
    throw createHttpError(403, "L'account non è attivo");
  }

  // Enti pubblici (PublicEntity) devono avere MFA abilitato
  const isEntePublico = utente.tipoUtente === TIPI_UTENTE.ENTE_PUBBLICO;
  if (isEntePublico && !utente.impostazioni?.mfaAttiva) {
    // MFA obbligatorio per enti pubblici
    throw createHttpError(403, "MFA obbligatorio per gli enti pubblici. Contatta l'amministratore.");
  }

  if (utente.impostazioni?.mfaAttiva) {
    if (!payload.codiceMfa) {
      throw createHttpError(401, "Codice MFA obbligatorio");
    }

    if (!validaCodiceMfa(payload.codiceMfa)) {
      logSecurityEvent({
        type: SECURITY_EVENTS.LOGIN_FAILED,
        reason: "invalid_mfa",
        userId: utente._id,
        ip: payload._ipAddress,
      });
      throw createHttpError(401, CREDENZIALI_NON_VALIDE);
    }
  }

  // Login riuscito - azzera tentavi falliti e aggiorna ultimo accesso
  await azzeraLoginFalliti(utente);
  utente.sicurezza = utente.sicurezza || {};
  utente.sicurezza.ultimo_accesso_il = new Date();
  await utente.save({ validateBeforeSave: false });

  // Ogni login genera un nuovo token, cosi dispositivi diversi possono avere sessioni separate.
  const tokenAccesso = await creaSessioneUtente(utente);
  const accountModel = utente.tipoUtente === TIPI_UTENTE.ENTE_PUBBLICO ? PublicEntity : User;
  const utenteCorrente = await accountModel.findById(utente._id);

  logSecurityEvent({
    type: SECURITY_EVENTS.LOGIN_SUCCESS,
    userId: utente._id,
    tipoUtente: utente.tipoUtente,
    ip: payload._ipAddress,
  });

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

  await utente.save({ validateBeforeSave: false });
}

async function requestPasswordReset(payload) {
  const email = normalizzaEmail(payload.email);

  if (!email) {
    throw createHttpError(400, "L'email è obbligatoria");
  }

  const utente = await trovaUtentePerEmail(email);

  // Unified message: anche se utente non esiste, ritorna stesso messaggio
  // Questo previene email enumeration
  const successMessage = "Se esiste un account con questa email, riceverai un codice di reset";

  if (!utente) {
    logSecurityEvent({
      type: SECURITY_EVENTS.PASSWORD_RESET_REQUESTED,
      reason: "user_not_found",
      email: email,
    });
    // Non lanciare errore - ritorna lo stesso messaggio
    return {
      message: successMessage,
    };
  }

  try {
    await creaOtpEmail(email, OTP_PURPOSES.PASSWORD_RESET);

    logSecurityEvent({
      type: SECURITY_EVENTS.PASSWORD_RESET_REQUESTED,
      userId: utente._id,
      email: email,
    });

    return {
      message: successMessage,
    };
  } catch (error) {
    // Se c'è cooldown su OTP, still return success message
    if (error.statusCode === 429) {
      return {
        message: successMessage,
      };
    }
    throw error;
  }
}

async function resetPassword(payload) {
  const email = normalizzaEmail(payload.email);
  const password = payload.password || payload.nuovaPassword;

  if (!email) {
    throw createHttpError(400, "L'email è obbligatoria");
  }

  assertStrongPassword(password);
  const utente = await trovaUtentePerEmail(email);

  if (!utente) {
    throw createHttpError(404, "Nessun account associato a questa email");
  }

  const otp = await verificaOtpEmail(
    email,
    OTP_PURPOSES.PASSWORD_RESET,
    payload.codiceReset,
  );

  utente.hashPassword = await hashPassword(password);
  utente.sessioni = [];
  utente.sicurezza = utente.sicurezza || {};
  utente.sicurezza.last_password_change_il = new Date();
  await utente.save({ validateBeforeSave: false });
  await EmailOtp.deleteOne({ _id: otp._id });

  logSecurityEvent({
    type: SECURITY_EVENTS.PASSWORD_RESET_COMPLETED,
    userId: utente._id,
    email: email,
  });

  return {
    message: "Password aggiornata con successo",
  };
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

function listPhoneCountries(locale) {
  return costruisciListaPaesiTelefono(locale);
}

module.exports = {
  getCurrentUser,
  listPhoneCountries,
  listPublicEntities,
  loginUser,
  logoutUser,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  registerUser,
};
