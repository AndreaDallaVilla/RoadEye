//Usato per gestire l'assenza di route
function notFound(req, res, _next) {
  res.status(404).json({
    message: `Percorso non trovato: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = notFound;
