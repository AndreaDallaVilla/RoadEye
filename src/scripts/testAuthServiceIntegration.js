const assert = require("assert");
const mongoose = require("mongoose");

const connectToDatabase = require("../config/db");
const User = require("../models/User");
const PublicEntity = require("../models/PublicEntity");
const authService = require("../services/auth.service");
const { TIPI_UTENTE } = require("../utils/constants");
const { hashSessionToken } = require("../utils/sessionToken");

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

async function run() {
  const suffix = uniqueSuffix();
  const email = `test.auth.${suffix}@roadeye.local`;
  const codiceFiscale = "RSSMRA85T10A562S";
  const nomeUtentePubblico = `test_user_${suffix}`;
  const enteEmail = `test.ente.${suffix}@roadeye.local`;
  const enteCodiceFiscale = `ENTEPB85T10A56${String(suffix).slice(-2)}`;
  const enteCodiceIpa = `PA${String(suffix).slice(-4)}`;
  const enteCodiceUnivoco = `U${String(suffix).slice(-5)}`;
  const password = "RoadEyeAuth2026$";
  const previousMfaTestCode = process.env.AUTH_MFA_TEST_CODE;
  process.env.AUTH_MFA_TEST_CODE = "123456";

  await connectToDatabase();

  try {
    await User.deleteMany({
      $or: [{ email }, { codiceFiscale }, { "profilo.nomeUtentePubblico": nomeUtentePubblico }],
    });

    const registerResult = await authService.registerUser({
      tipoUtente: TIPI_UTENTE.UTENTE_REGISTRATO,
      email,
      codiceFiscale,
      password,
      nome: "Mario",
      cognome: "Rossi",
      nomeUtentePubblico,
      dataNascita: "1999-01-01",
      sesso: "Maschio",
      notificheAttive: true,
      localizzazioneAttiva: true,
    });

    assert.ok(registerResult.tokenAccesso, "Token assente dopo register");
    assert.strictEqual(registerResult.utente.email, email, "Email non coerente dopo register");
    assert.strictEqual(registerResult.utente.codiceFiscale, codiceFiscale, "Codice fiscale non coerente");
    assert.strictEqual(
      registerResult.utente.profilo.nomeUtentePubblico,
      nomeUtentePubblico,
      "Nome utente pubblico non coerente",
    );
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(registerResult.utente, "hashPassword"),
      false,
      "hashPassword non deve essere esposto nella response",
    );

    const userAfterRegister = await User.findOne({ email }).select("+hashPassword +sessioni");
    assert.ok(userAfterRegister, "Utente non trovato su DB dopo register");
    assert.ok(userAfterRegister.hashPassword, "Hash password non salvato");
    assert.strictEqual(userAfterRegister.sessioni.length, 1, "Sessioni attese: 1 dopo register");
    assert.strictEqual(
      userAfterRegister.sessioni[0].hashToken,
      hashSessionToken(registerResult.tokenAccesso),
      "Hash token della sessione register non coerente",
    );

    const loginResult = await authService.loginUser({
      email,
      password,
    });
    assert.ok(loginResult.tokenAccesso, "Token assente dopo login");
    assert.notStrictEqual(
      loginResult.tokenAccesso,
      registerResult.tokenAccesso,
      "Login deve generare un nuovo token",
    );

    const userAfterLogin = await User.findOne({ email }).select("+sessioni");
    assert.strictEqual(userAfterLogin.sessioni.length, 2, "Sessioni attese: 2 dopo login");

    const userForLogout = await User.findOne({ email }).select("+sessioni");
    await authService.logoutUser(userForLogout, loginResult.tokenAccesso);

    const userAfterLogout = await User.findOne({ email }).select("+sessioni");
    const loginHash = hashSessionToken(loginResult.tokenAccesso);
    const hasLoggedOutSession = userAfterLogout.sessioni.some(
      (sessione) => sessione.hashToken === loginHash,
    );
    assert.strictEqual(hasLoggedOutSession, false, "La sessione di login dovrebbe essere rimossa");

    const publicUser = authService.getCurrentUser(userAfterLogout);
    assert.strictEqual(publicUser.email, email, "getCurrentUser deve mantenere i dati pubblici");
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(publicUser, "sessioni"),
      false,
      "getCurrentUser non deve esporre sessioni",
    );

    let loginError;
    try {
      await authService.loginUser({
        email,
        password: "PasswordSbagliata2026$",
      });
    } catch (error) {
      loginError = error;
    }
    assert.ok(loginError, "Con password errata era atteso un errore");
    assert.strictEqual(loginError.statusCode, 401, "Status code errato per credenziali non valide");

    const registerEnteResult = await authService.registerUser({
      tipoUtente: TIPI_UTENTE.ENTE_PUBBLICO,
      email: enteEmail,
      codiceFiscale: enteCodiceFiscale,
      password,
      denominazione: "Comune Test RoadEye",
      pec: `comune.${suffix}@pec.it`,
      codiceIpa: enteCodiceIpa,
      codiceUnivoco: enteCodiceUnivoco,
    });
    assert.ok(registerEnteResult.tokenAccesso, "Token assente dopo register ente");

    const enteLoginResult = await authService.loginUser({
      codiceFiscale: enteCodiceFiscale,
      codiceIpa: enteCodiceIpa.toLowerCase(),
      codiceUnivoco: ` ${enteCodiceUnivoco} `,
      password,
    });
    assert.ok(
      enteLoginResult.tokenAccesso,
      "Login ente con codice fiscale+IPA+univoco dovrebbe restituire token",
    );

    const enteForMfa = await PublicEntity.findOne({ email: enteEmail }).select("+sessioni");
    enteForMfa.impostazioni.mfaAttiva = true;
    await enteForMfa.save();

    let mfaMissingError;
    try {
      await authService.loginUser({
        codiceFiscale: enteCodiceFiscale,
        codiceIpa: enteCodiceIpa,
        codiceUnivoco: enteCodiceUnivoco,
        password,
      });
    } catch (error) {
      mfaMissingError = error;
    }
    assert.ok(mfaMissingError, "Senza codice MFA era atteso un errore");
    assert.strictEqual(mfaMissingError.statusCode, 401, "Status code errato su MFA mancante");

    let mfaInvalidError;
    try {
      await authService.loginUser({
        codiceFiscale: enteCodiceFiscale,
        codiceIpa: enteCodiceIpa,
        codiceUnivoco: enteCodiceUnivoco,
        password,
        codiceMfa: "999999",
      });
    } catch (error) {
      mfaInvalidError = error;
    }
    assert.ok(mfaInvalidError, "Con codice MFA errato era atteso un errore");
    assert.strictEqual(mfaInvalidError.statusCode, 401, "Status code errato su MFA non valido");

    const enteMfaLogin = await authService.loginUser({
      codiceFiscale: enteCodiceFiscale,
      codiceIpa: enteCodiceIpa,
      codiceUnivoco: enteCodiceUnivoco,
      password,
      codiceMfa: "123456",
    });
    assert.ok(enteMfaLogin.tokenAccesso, "Con MFA valido il login dovrebbe avere successo");

    console.log("Test integrazione auth.service passati.");
  } finally {
    await User.deleteMany({ email });
    await PublicEntity.deleteMany({ email: enteEmail });
    if (previousMfaTestCode === undefined) {
      delete process.env.AUTH_MFA_TEST_CODE;
    } else {
      process.env.AUTH_MFA_TEST_CODE = previousMfaTestCode;
    }
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error("Test integrazione auth.service falliti:", error.message);
  process.exit(1);
});
