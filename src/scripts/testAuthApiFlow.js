const assert = require("assert");

function getBaseUrl() {
  const port = process.env.PORT || 3000;
  return process.env.TEST_API_BASE_URL || `http://localhost:${port}/api`;
}

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

function generateCodiceFiscaleFromSuffix(suffix) {
  const baseTenDigits = suffix.replace(/[^0-9]/g, "").slice(-10).padStart(10, "0");
  let sum = 0;

  for (let i = 0; i < baseTenDigits.length; i += 1) {
    let digit = Number(baseTenDigits[i]);
    if ((i + 1) % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
      sum += digit;
    } else {
      sum += digit;
    }
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return `${baseTenDigits}${checkDigit}`;
}

async function sendJson(method, url, body, token) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  return { response, data };
}

async function run() {
  const baseUrl = getBaseUrl();
  const suffix = uniqueSuffix();
  const email = `test.api.${suffix}@example.com`;
  const nomeUtentePubblico = `api_user_${suffix}`;
  const codiceFiscale = generateCodiceFiscaleFromSuffix(suffix);
  const password = "RoadEye2026$";

  console.log(`[INFO] Base URL: ${baseUrl}`);

  const phoneCountries = await sendJson("GET", `${baseUrl}/auth/phone-countries?locale=it`);
  assert.strictEqual(phoneCountries.response.status, 200, "Phone countries deve restituire 200");
  assert.ok(
    phoneCountries.data?.nazioni?.some((nazione) => nazione.codice === "IT" && nazione.prefisso === "+39"),
    "Phone countries deve includere l'Italia con prefisso +39",
  );
  console.log("[OK] Phone countries 200");

  const registerPayload = {
    tipoUtente: "Utente Registrato",
    email,
    codiceFiscale,
    password,
    nome: "Mario",
    cognome: "Rossi",
    nomeUtentePubblico,
    dataNascita: "1999-01-01",
    sesso: "Maschio",
    nazioneTelefono: "IT",
    numeroTelefono: "3331234567",
    notificheAttive: true,
    localizzazioneAttiva: true,
  };

  const register = await sendJson("POST", `${baseUrl}/auth/register`, registerPayload);
  assert.strictEqual(register.response.status, 201, "Register deve restituire 201");
  assert.ok(register.data?.tokenAccesso, "Register deve restituire tokenAccesso");
  console.log("[OK] Register 201");

  const login = await sendJson("POST", `${baseUrl}/auth/login`, { email, password });
  assert.strictEqual(login.response.status, 200, "Login deve restituire 200");
  assert.ok(login.data?.tokenAccesso, "Login deve restituire tokenAccesso");
  const token = login.data.tokenAccesso;
  console.log("[OK] Login 200");

  const me = await sendJson("GET", `${baseUrl}/auth/me`, null, token);
  assert.strictEqual(me.response.status, 200, "ME deve restituire 200 con token valido");
  assert.ok(me.data?.utente, "ME deve restituire utente");
  console.log("[OK] Me 200");

  const logout = await sendJson("POST", `${baseUrl}/auth/logout`, null, token);
  assert.strictEqual(logout.response.status, 200, "Logout deve restituire 200");
  console.log("[OK] Logout 200");

  const meAfterLogout = await sendJson("GET", `${baseUrl}/auth/me`, null, token);
  assert.strictEqual(
    meAfterLogout.response.status,
    401,
    "ME dopo logout deve restituire 401",
  );
  console.log("[OK] Me dopo logout 401");

  console.log("Test API auth completato con successo.");
}

module.exports = {
  run,
};

if (require.main === module) {
  run().catch((error) => {
    console.error("Test API auth fallito:", error.message);
    process.exit(1);
  });
}
