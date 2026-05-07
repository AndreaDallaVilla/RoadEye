const assert = require("assert");
const {
  isValidCodiceFiscale,
  normalizzaCodiceFiscale,
} = require("../utils/codiceFiscale");

function run() {
  assert.strictEqual(
    normalizzaCodiceFiscale(" rssmra85t10a562s "),
    "RSSMRA85T10A562S",
    "Normalizzazione codice fiscale non corretta",
  );

  assert.strictEqual(
    isValidCodiceFiscale("RSSMRA85T10A562S"),
    true,
    "Codice fiscale 16 caratteri valido atteso",
  );
  assert.strictEqual(
    isValidCodiceFiscale("RSSMRA85T10A562A"),
    false,
    "Codice fiscale con check character errato dovrebbe essere invalido",
  );
  assert.strictEqual(
    isValidCodiceFiscale("ABCDEF12G34H567I"),
    false,
    "Codice fiscale 16 caratteri non coerente dovrebbe essere invalido",
  );
  assert.strictEqual(
    isValidCodiceFiscale("12345678903"),
    false,
    "Codice fiscale numerico con checksum errato dovrebbe essere invalido",
  );
  assert.strictEqual(
    isValidCodiceFiscale(""),
    false,
    "Stringa vuota non valida",
  );

  console.log("Tutti i test su codiceFiscale.js sono passati.");
}

run();
