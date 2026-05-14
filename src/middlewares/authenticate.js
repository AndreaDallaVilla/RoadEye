const User = require("../models/User");
const PublicEntity = require("../models/PublicEntity");
const createHttpError = require("../utils/httpError");
const { hashSessionToken } = require("../utils/sessionToken");
const {
  logSecurityEvent,
  SECURITY_EVENTS,
} = require("../utils/securityAudit");

async function authenticate(req, _res, next) {
  try {
    const headerAutorizzazione = req.get("authorization");

    if (!headerAutorizzazione || !headerAutorizzazione.startsWith("Bearer ")) {
      logSecurityEvent({
        type: SECURITY_EVENTS.UNAUTHORIZED_ACCESS_ATTEMPT,
        reason: "missing_token",
        endpoint: req.path,
        ip: req.ip,
      });
      throw createHttpError(401, "Token di autenticazione mancante");
    }

    const tokenAccesso = headerAutorizzazione.slice("Bearer ".length).trim();

    if (!tokenAccesso) {
      logSecurityEvent({
        type: SECURITY_EVENTS.UNAUTHORIZED_ACCESS_ATTEMPT,
        reason: "empty_token",
        endpoint: req.path,
        ip: req.ip,
      });
      throw createHttpError(401, "Token di autenticazione mancante");
    }

    const hashToken = hashSessionToken(tokenAccesso);
    const adesso = new Date();

    // La ricerca della sessione avviene lato server, cosi un token puo essere revocato senza modificare i client.
    const querySessioneAttiva = {
      sessioni: {
        $elemMatch: {
          hashToken,
          scadeIl: { $gt: adesso },
        },
      },
    };
    let utente = await User.findOne(querySessioneAttiva).select("+hashPassword +sessioni");
    if (!utente) {
      utente = await PublicEntity.findOne(querySessioneAttiva).select("+hashPassword +sessioni");
    }

    if (!utente) {
      logSecurityEvent({
        type: SECURITY_EVENTS.UNAUTHORIZED_ACCESS_ATTEMPT,
        reason: "invalid_token",
        endpoint: req.path,
        ip: req.ip,
      });
      throw createHttpError(401, "Token di autenticazione non valido o scaduto");
    }

    const sessioneCorrente = utente.sessioni.find(
      (sessione) =>
        sessione.hashToken === hashToken &&
        sessione.scadeIl.getTime() > adesso.getTime(),
    );

    if (!sessioneCorrente) {
      logSecurityEvent({
        type: SECURITY_EVENTS.UNAUTHORIZED_ACCESS_ATTEMPT,
        reason: "expired_session",
        userId: utente._id,
        endpoint: req.path,
        ip: req.ip,
      });
      throw createHttpError(401, "Token di autenticazione non valido o scaduto");
    }

    // Aggiorna l'ultima attività della sessione per future logiche di audit o pulizia.
    sessioneCorrente.ultimoUtilizzoIl = adesso;
    await utente.save({ validateBeforeSave: false });

    req.tokenAccesso = tokenAccesso;
    req.user = utente;
    req.sessione = sessioneCorrente;

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;
