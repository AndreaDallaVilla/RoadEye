const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const createHttpError = require("../utils/httpError");

// Rate limiter per login - 5 tentativi ogni 15 minuti per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // 5 richieste
  message: "Troppi tentativi di accesso. Riprova tra 15 minuti.",
  standardHeaders: false, // Disabilita header RateLimit-*
  skip: (req, res) => {
    // Non contare come tentativo se l'errore è di validazione
    res.on("finish", () => {
      // Solo log, il conteggio avviene comunque
    });
    return false;
  },
  handler: (req, res) => {
    res.status(429).json({
      message: "Troppi tentativi di accesso. Riprova tra 15 minuti.",
    });
  },
});

// Rate limiter per registrazione - 3 nuovi account ogni 1 ora per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3, // 3 richieste
  message: "Troppi tentativi di registrazione. Riprova dopo un'ora.",
  standardHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Troppi tentativi di registrazione. Riprova dopo un'ora.",
    });
  },
});

// Rate limiter per password reset - 3 richieste ogni 1 ora per email
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3, // 3 richieste
  keyGenerator: (req, res) => {
    // Usa email come chiave invece di IP
    return req.body?.email || ipKeyGenerator(req);
  },
  message: "Troppi tentativi di reset password. Riprova dopo un'ora.",
  standardHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Troppi tentativi di reset password. Riprova dopo un'ora.",
    });
  },
});

// Rate limiter per email verification - 5 richieste ogni 1 ora per email
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 5, // 5 richieste
  keyGenerator: (req, res) => {
    return req.body?.email || ipKeyGenerator(req);
  },
  message: "Troppi tentativi di verifica email. Riprova dopo un'ora.",
  standardHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: "Troppi tentativi di verifica email. Riprova dopo un'ora.",
    });
  },
});

// Rate limiter generico per API - 100 richieste ogni 15 minuti per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // 100 richieste
  standardHeaders: false,
  skip: (req) => {
    // Non limitare health check
    return req.path === "/health";
  },
  handler: (req, res) => {
    res.status(429).json({
      message: "Troppe richieste. Riprova tra 15 minuti.",
    });
  },
});

module.exports = {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  apiLimiter,
};