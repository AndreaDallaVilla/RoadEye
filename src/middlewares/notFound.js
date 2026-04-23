function notFound(req, res, _next) {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = notFound;
