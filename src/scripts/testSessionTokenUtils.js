const assert = require("assert");
const {
  createSessionToken,
  getSessionExpiryDate,
  hashSessionToken,
} = require("../utils/sessionToken");

function testCreateSessionToken() {
  const tokenA = createSessionToken();
  const tokenB = createSessionToken();

  assert.strictEqual(typeof tokenA, "string", "Il token deve essere una stringa");
  assert.ok(tokenA.length >= 40, "Il token deve avere una lunghezza robusta");
  assert.notStrictEqual(tokenA, tokenB, "Due token consecutivi non devono coincidere");
}

function testHashSessionToken() {
  const token = "RoadEyeTokenDiProva";
  const hashA = hashSessionToken(token);
  const hashB = hashSessionToken(token);

  assert.strictEqual(hashA, hashB, "L'hash deve essere deterministico");
  assert.strictEqual(hashA.length, 64, "Hash SHA-256 atteso di 64 caratteri esadecimali");
  assert.ok(/^[a-f0-9]+$/.test(hashA), "Hash non in formato esadecimale");
}

function testGetSessionExpiryDate() {
  const previousValue = process.env.AUTH_SESSION_TTL_HOURS;

  try {
    process.env.AUTH_SESSION_TTL_HOURS = "2";
    const now = Date.now();
    const expiry = getSessionExpiryDate().getTime();
    const diff = expiry - now;

    assert.ok(diff > 1.9 * 60 * 60 * 1000, "Scadenza troppo corta rispetto al TTL");
    assert.ok(diff < 2.1 * 60 * 60 * 1000, "Scadenza troppo lunga rispetto al TTL");
  } finally {
    if (previousValue === undefined) {
      delete process.env.AUTH_SESSION_TTL_HOURS;
    } else {
      process.env.AUTH_SESSION_TTL_HOURS = previousValue;
    }
  }
}

function run() {
  testCreateSessionToken();
  testHashSessionToken();
  testGetSessionExpiryDate();
  console.log("Tutti i test su sessionToken.js sono passati.");
}

run();
