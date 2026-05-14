const createHttpError = require("./httpError");

const MAX_LOGIN_ATTEMPTS = Number(process.env.AUTH_MAX_LOGIN_ATTEMPTS || 5);
const LOCKOUT_DURATION_MINUTES = Number(process.env.AUTH_LOCKOUT_DURATION_MINUTES || 15);

function isAccountLocked(utente) {
  if (!utente.sicurezza?.bloccatoFino) {
    return false;
  }

  const adesso = new Date();
  const sbloccatoFino = new Date(utente.sicurezza.bloccatoFino);

  if (adesso > sbloccatoFino) {
    // Account dovrebbe essere sbloccato
    return false;
  }

  return true;
}

function getAccountLockedErrorMessage(utente) {
  if (!utente.sicurezza?.bloccatoFino) {
    return "Account temporaneamente bloccato";
  }

  const adesso = new Date();
  const sbloccatoFino = new Date(utente.sicurezza.bloccatoFino);
  const minutiRimanenti = Math.ceil((sbloccatoFino - adesso) / 1000 / 60);

  return `Account bloccato dopo troppi tentativi di accesso. Riprova tra ${minutiRimanenti} minuti.`;
}

function getBloccatoFinoDate() {
  const ttlMilliseconds = LOCKOUT_DURATION_MINUTES * 60 * 1000;
  return new Date(Date.now() + ttlMilliseconds);
}

async function registraLoginFallito(utente) {
  // Incrementa il contatore di tentativi falliti
  if (!utente.sicurezza) {
    utente.sicurezza = {};
  }

  utente.sicurezza.tentativi_login_falliti = (utente.sicurezza.tentativi_login_falliti || 0) + 1;
  utente.sicurezza.ultimo_tentativo_il = new Date();

  // Se il limite è raggiunto, blocca l'account
  if (utente.sicurezza.tentativi_login_falliti >= MAX_LOGIN_ATTEMPTS) {
    utente.sicurezza.bloccatoFino = getBloccatoFinoDate();
  }

  await utente.save();

  return utente.sicurezza.tentativi_login_falliti;
}

async function azzeraLoginFalliti(utente) {
  if (utente.sicurezza) {
    utente.sicurezza.tentativi_login_falliti = 0;
    utente.sicurezza.bloccatoFino = null;
    await utente.save();
  }
}

module.exports = {
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  isAccountLocked,
  getAccountLockedErrorMessage,
  getBloccatoFinoDate,
  registraLoginFallito,
  azzeraLoginFalliti,
};
