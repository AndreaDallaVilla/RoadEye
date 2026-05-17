const assert = require("assert");
const {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} = require("../utils/password");

function runTestCase(input, expectedIsValid, expectedMessage) {
  const result = validatePasswordStrength(input);
  assert.strictEqual(
    result.isValid,
    expectedIsValid,
    `Esito inatteso per input: ${String(input)}`,
  );
  assert.strictEqual(
    result.message,
    expectedMessage,
    `Messaggio inatteso per input: ${String(input)}`,
  );
}

async function run() {
  runTestCase(undefined, false, "La password è obbligatoria");
  runTestCase(12345, false, "La password è obbligatoria");
  runTestCase("Ab1!", false, "La password deve contenere almeno 10 caratteri");
  runTestCase("abcdefghijk!", false, "La password deve contenere almeno un numero");
  runTestCase("abcdefghij1!", false, "La password deve contenere almeno una lettera maiuscola");
  runTestCase("ABCDEFGHIJ1!", false, "La password deve contenere almeno una lettera minuscola");
  runTestCase("Abcdefghij1", false, "La password deve contenere almeno un carattere speciale");
  runTestCase("Abcdefghij1!", true, null);
  runTestCase("RoadEye2026$", true, null);

  const passwordValida = "RoadEye2026$";
  const hash = await hashPassword(passwordValida);
  assert.ok(typeof hash === "string" && hash.includes(":"), "Hash non valido");

  const verificaPositiva = await verifyPassword(passwordValida, hash);
  assert.strictEqual(verificaPositiva, true, "La password corretta dovrebbe risultare valida");

  const verificaNegativa = await verifyPassword("PasswordErrata2026$", hash);
  assert.strictEqual(verificaNegativa, false, "La password errata dovrebbe risultare non valida");

  const hashFormatoInvalido = "not-a-real-hash";
  const verificaHashInvalido = await verifyPassword(passwordValida, hashFormatoInvalido);
  assert.strictEqual(
    verificaHashInvalido,
    false,
    "Con hash invalido verifyPassword dovrebbe restituire false",
  );

  console.log("Tutti i test su password.js sono passati.");
}

run().catch((error) => {
  console.error("Test password falliti:", error.message);
  process.exit(1);
});
