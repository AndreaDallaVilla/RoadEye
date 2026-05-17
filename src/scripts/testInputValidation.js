const assert = require("assert");

const app = require("../app");
const {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} = require("../validators/auth.validation");
const { createAnnouncementSchema } = require("../validators/announcements.validation");
const {
  embedUrlQuerySchema,
  geocodeQuerySchema,
  reverseGeocodeQuerySchema,
} = require("../validators/maps.validation");

const joiOptions = Object.freeze({
  abortEarly: false,
  allowUnknown: false,
  convert: true,
  stripUnknown: {
    arrays: false,
    objects: true,
  },
});

function validate(schema, payload) {
  return schema.validate(payload, joiOptions);
}

function assertValid(schema, payload, message) {
  const result = validate(schema, payload);
  assert.ifError(result.error);
  assert.ok(result.value, message);
  return result.value;
}

function assertInvalid(schema, payload, message) {
  const result = validate(schema, payload);
  assert.ok(result.error, message);
  return result.error;
}

async function withServer(run) {
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function requestJson(baseUrl, path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    // Alcuni errori infrastrutturali possono non avere corpo JSON.
  }

  return { response, data };
}

function runSchemaSanitizationTests() {
  const sanitizedRegister = assertValid(registerSchema, {
    tipoUtente: "Utente Registrato",
    email: " TEST@Example.COM ",
    codiceFiscale: "rssmra85t10a562s",
    password: "RoadEye2026$",
    nome: " Mario ",
    cognome: " Rossi ",
    dataNascita: "1999-01-01",
    luogoNascita: " Trento ",
    sesso: "Maschio",
    consensoTrattamentoDati: true,
    isAdmin: true,
    statoAccount: "Attivo",
    sessioni: [{ hashToken: "unsafe" }],
  }, "Register valido dovrebbe essere sanitizzato");

  assert.strictEqual(sanitizedRegister.email, "test@example.com");
  assert.strictEqual(sanitizedRegister.codiceFiscale, "RSSMRA85T10A562S");
  assert.strictEqual(sanitizedRegister.nome, "Mario");
  assert.strictEqual(Object.hasOwn(sanitizedRegister, "isAdmin"), false);
  assert.strictEqual(Object.hasOwn(sanitizedRegister, "statoAccount"), false);
  assert.strictEqual(Object.hasOwn(sanitizedRegister, "sessioni"), false);

  const sanitizedAnnouncement = assertValid(createAnnouncementSchema, {
    topic: "Incidente stradale",
    gravita: "Alta",
    descrizione: " Coda in tangenziale ",
    coordinate: {
      latitudine: "46.0667",
      longitudine: "11.1211",
      extra: "ignored",
    },
    punteggioFeedback: 999,
    stato: "Attivo",
  }, "Annuncio valido dovrebbe essere sanitizzato");

  assert.strictEqual(sanitizedAnnouncement.descrizione, "Coda in tangenziale");
  assert.strictEqual(sanitizedAnnouncement.coordinate.latitudine, 46.0667);
  assert.strictEqual(Object.hasOwn(sanitizedAnnouncement.coordinate, "extra"), false);
  assert.strictEqual(Object.hasOwn(sanitizedAnnouncement, "punteggioFeedback"), false);
  assert.strictEqual(Object.hasOwn(sanitizedAnnouncement, "stato"), false);
}

function runAttackPayloadSchemaTests() {
  assertInvalid(loginSchema, {
    email: { $ne: null },
    password: "RoadEye2026$",
  }, "NoSQL injection su email deve essere respinta");

  assertInvalid(emailOnlySchema, {
    email: { $gt: "" },
  }, "NoSQL injection su email-only deve essere respinta");

  assertInvalid(registerSchema, {
    tipoUtente: "Utente Registrato",
    email: "user@example.com",
    codiceFiscale: "RSSMRA85T10A562S",
    password: "RoadEye2026$",
    nome: "<script>alert(1)</script>",
    cognome: "Rossi",
    dataNascita: "1999-01-01",
    luogoNascita: "Trento",
    sesso: "Maschio",
    consensoTrattamentoDati: true,
  }, "XSS nei campi profilo deve essere respinto");

  assertInvalid(createAnnouncementSchema, {
    topic: "Incidente stradale",
    gravita: "Alta",
    descrizione: "<img src=x onerror=alert(1)>",
  }, "XSS nella descrizione annuncio deve essere respinto");

  assertInvalid(createAnnouncementSchema, {
    topic: "Incidente stradale",
    gravita: "Alta",
    coordinate: {
      latitudine: "nord",
      longitudine: "11.1211",
    },
  }, "Manipolazione tipo coordinate deve essere respinta");

  assertInvalid(createAnnouncementSchema, {
    topic: "Incidente stradale",
    gravita: "Critica",
  }, "Bypass enum gravita deve essere respinto");

  assertInvalid(registerSchema, {
    tipoUtente: "Utente Registrato",
    email: "user@example.com",
    codiceFiscale: "RSSMRA85T10A562S",
    password: "RoadEye2026$",
    nome: "Mario",
    cognome: "Rossi",
    dataNascita: "1999-01-01",
    luogoNascita: "Trento",
    sesso: "Maschio",
    consensoTrattamentoDati: false,
  }, "Bypass consenso GDPR deve essere respinto");

  assertInvalid(resetPasswordSchema, {
    email: "user@example.com",
    codiceReset: "123456",
    password: "RoadEye2026$",
    nuovaPassword: "OtherPassword2026$",
  }, "Reset password con due campi password deve essere respinto");
}

function runQuerySchemaTests() {
  assertValid(geocodeQuerySchema, {
    indirizzo: " Piazza Duomo, Trento ",
    admin: "true",
  }, "Geocode query valida dovrebbe passare");

  assertInvalid(geocodeQuerySchema, {
    indirizzo: "<script>alert(1)</script>",
  }, "Geocode query con HTML deve essere respinta");

  assertValid(reverseGeocodeQuerySchema, {
    lat: "46.0667",
    lng: "11.1211",
  }, "Reverse geocode query valida dovrebbe passare");

  assertInvalid(reverseGeocodeQuerySchema, {
    lat: "91",
    lng: "11.1211",
  }, "Latitudine fuori range deve essere respinta");

  assertValid(embedUrlQuerySchema, {
    query: "Trento",
    zoom: "12",
  }, "Embed query valida dovrebbe passare");

  assertInvalid(embedUrlQuerySchema, {
    query: "Trento",
    zoom: "40",
  }, "Zoom fuori range deve essere respinto");
}

async function runHttpMiddlewareTests() {
  await withServer(async (baseUrl) => {
    const cases = [
      {
        path: "/api/auth/login",
        method: "POST",
        body: { email: { $ne: null }, password: "RoadEye2026$" },
      },
      {
        path: "/api/auth/register",
        method: "POST",
        body: {
          tipoUtente: "Utente Registrato",
          email: "user@example.com",
          codiceFiscale: "RSSMRA85T10A562S",
          password: "RoadEye2026$",
          nome: "<script>alert(1)</script>",
          cognome: "Rossi",
          dataNascita: "1999-01-01",
          luogoNascita: "Trento",
          sesso: "Maschio",
          consensoTrattamentoDati: true,
        },
      },
      {
        path: "/api/announcements",
        method: "POST",
        body: {
          topic: "Incidente stradale",
          gravita: "Critica",
        },
        expectedStatus: 401,
      },
      {
        path: "/api/maps/reverse-geocode?lat=91&lng=11.1211",
      },
      {
        path: "/api/maps/geocode?indirizzo=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      },
    ];

    for (const testCase of cases) {
      const { response, data } = await requestJson(baseUrl, testCase.path, testCase);
      const expectedStatus = testCase.expectedStatus || 400;
      assert.strictEqual(response.status, expectedStatus, `${testCase.path} dovrebbe restituire ${expectedStatus}`);

      if (expectedStatus === 400) {
        assert.strictEqual(data?.message, "Validazione input fallita");
        assert.ok(Array.isArray(data?.details), `${testCase.path} dovrebbe includere details`);
        assert.ok(data.details.length > 0, `${testCase.path} dovrebbe includere almeno un dettaglio`);
      }

      if (expectedStatus === 401) {
        assert.strictEqual(data?.message, "Token di autenticazione mancante");
      }
    }
  });
}

async function run() {
  runSchemaSanitizationTests();
  runAttackPayloadSchemaTests();
  runQuerySchemaTests();
  await runHttpMiddlewareTests();
  console.log("Test validazione input passati.");
}

if (require.main === module) {
  run().catch((error) => {
    console.error("Test validazione input falliti:", error.message);
    process.exit(1);
  });
}

module.exports = {
  run,
};
