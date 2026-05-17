const assert = require("assert");
const createHttpError = require("../utils/httpError");

function run() {
  const error = createHttpError(409, "Conflitto risorsa");

  assert.ok(error instanceof Error, "createHttpError deve restituire un Error");
  assert.strictEqual(error.statusCode, 409, "statusCode non corretto");
  assert.strictEqual(error.message, "Conflitto risorsa", "Messaggio non corretto");

  console.log("Tutti i test su httpError.js sono passati.");
}

run();
