const Joi = require("joi");

function rejectHtml(value, helpers) {
  if (/[<>]/.test(value)) {
    return helpers.error("string.noHtml");
  }

  return value;
}

function text({ max = 255, required = false } = {}) {
  let schema = Joi.string()
    .trim()
    .max(max)
    .custom(rejectHtml)
    .messages({
      "string.noHtml": "{{#label}} non puo contenere markup HTML",
    });

  if (required) {
    schema = schema.required();
  } else {
    schema = schema.optional();
  }

  return schema;
}

const objectId = Joi.string().trim().hex().length(24);

module.exports = {
  Joi,
  objectId,
  text,
};
