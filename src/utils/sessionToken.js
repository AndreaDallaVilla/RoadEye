const crypto = require("crypto");

//Funzionamento: Il token in chiaro viene restituito una sola volta al client e non viene mai salvato cosi com'è nel database.
function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

// Metodo: Salvare solo l'hash del token riduce l'impatto di un'eventuale perdita del database.
function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Funzione: Usata per la gestione della scadenza delle sessioni
function getSessionExpiryDate() {
  const ttlHours = Number(process.env.AUTH_SESSION_TTL_HOURS || 24);
  const ttlMilliseconds = ttlHours * 60 * 60 * 1000;

  return new Date(Date.now() + ttlMilliseconds);
}

module.exports = {
  createSessionToken,
  getSessionExpiryDate,
  hashSessionToken,
};
