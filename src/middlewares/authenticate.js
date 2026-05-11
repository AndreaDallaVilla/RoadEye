const User = require("../models/User");
const PublicEntity = require("../models/PublicEntity");
const createHttpError = require("../utils/httpError");
const { hashSessionToken } = require("../utils/sessionToken");

async function authenticate(req, _res, next) {
  try {
    const headerAutorizzazione = req.get("authorization");

    if (!headerAutorizzazione || !headerAutorizzazione.startsWith("Bearer ")) {
      throw createHttpError(401, "Token di autenticazione mancante");
    }

    const tokenAccesso = headerAutorizzazione.slice("Bearer ".length).trim();

    if (!tokenAccesso) {
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
      throw createHttpError(401, "Token di autenticazione non valido o scaduto");
    }

    const sessioneCorrente = utente.sessioni.find(
      (sessione) =>
        sessione.hashToken === hashToken &&
        sessione.scadeIl.getTime() > adesso.getTime(),
    );

    if (!sessioneCorrente) {
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
