const assert = require("assert");
const {
  isValidCodiceFiscale,
  isValidCodiceFiscalePersonaFisica,
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
    isValidCodiceFiscalePersonaFisica("RSSMRA85T10A562S", {
      dataNascita: "1985-12-10",
      sesso: "Maschio",
    }),
    true,
    "Codice fiscale persona fisica coerente con data e sesso atteso",
  );
  assert.strictEqual(
    isValidCodiceFiscalePersonaFisica("RSSMRA85T10A562S", {
      dataNascita: "1985-12-11",
      sesso: "Maschio",
    }),
    false,
    "Codice fiscale con data nascita non coerente dovrebbe essere invalido",
  );
  assert.strictEqual(
    isValidCodiceFiscalePersonaFisica("RSSMRA85T10A562S", {
      dataNascita: "1985-12-10",
      sesso: "Femmina",
    }),
    false,
    "Codice fiscale con sesso non coerente dovrebbe essere invalido",
  );
  assert.strictEqual(
    isValidCodiceFiscalePersonaFisica("RSSMRA85T10A562S", {
      dataNascita: "1885-12-10",
      sesso: "Maschio",
    }),
    true,
    "Il confronto con la data deve usare le due cifre dell'anno presenti nel CF",
  );
  assert.strictEqual(
    isValidCodiceFiscalePersonaFisica("12345678903", {
      dataNascita: "1985-12-10",
      sesso: "Maschio",
    }),
    false,
    "Un utente registrato non deve poter usare un codice fiscale numerico da 11 cifre",
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
