//Gestisce gli errori lanciati
function errorHandler(error, _req, res, _next) {
  const duplicatedFieldLabels = {
    email: "Email",
    codiceFiscale: "Codice fiscale",
    "profilo.nomeUtentePubblico": "Nome utente pubblico",
  };

  let statusCode = error.statusCode || 500;
  let message = error.message || "Errore interno del server";
  let details;

  if (error?.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(error.keyPattern || error.keyValue || {})[0];
    const duplicatedFieldLabel = duplicatedFieldLabels[duplicatedField] || duplicatedField;
    message = duplicatedField
      ? `${duplicatedFieldLabel} già in uso`
      : "Uno dei campi univoci è già in uso";
  }

  if (error?.name === "ValidationError") {
    statusCode = 400;
    message = "Validazione fallita";
    details = Object.values(error.errors).map((validationError) => validationError.message);
  }

  res.status(statusCode).json({
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = errorHandler;
