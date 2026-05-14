const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");

const apiRouter = require("./routes");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const { apiLimiter } = require("./middlewares/rateLimiting");

const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
  // HSTS - Force HTTPS
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  
  // Content Security Policy - rigoroso
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // X-Frame-Options - prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // X-XSS-Protection - legacy browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  next();
});

// CORS - Whitelist esplicito (non permettere "*" in produzione)
const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(",").map(url => url.trim())
  : [];

if (allowedOrigins.length === 0) {
  console.warn(
    "⚠️ WARNING: CORS is not properly configured. Set CLIENT_URL environment variable to a list of allowed origins.",
  );
}

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10kb" })); // Limita grandezza richieste
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

// Apply rate limiting alla API
app.use("/api", apiLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "roadeye-api" });
});

app.use("/api/v1", apiRouter);
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
