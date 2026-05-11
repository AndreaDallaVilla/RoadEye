const createHttpError = require("../utils/httpError");

const DEFAULT_OPTIONS = Object.freeze({
  abortEarly: false,
  allowUnknown: false,
  convert: true,
  stripUnknown: {
    arrays: false,
    objects: true,
  },
});

function formatValidationError(error) {
  return error.details.map((detail) => ({
    campo: detail.path.join("."),
    messaggio: detail.message,
  }));
}

function validate(schema, source = "body") {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source], DEFAULT_OPTIONS);

    if (error) {
      const validationError = createHttpError(400, "Validazione input fallita");
      validationError.details = formatValidationError(error);
      next(validationError);
      return;
    }

    req[source] = value;
    next();
  };
}

module.exports = validate;
