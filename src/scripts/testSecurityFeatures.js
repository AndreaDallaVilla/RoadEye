#!/usr/bin/env node

/**
 * Security Features Test Suite
 * Testa le nuove implementazioni di sicurezza
 */

const http = require("http");
const querystring = require("querystring");

const BASE_URL = "http://localhost:3001";
const TEST_EMAIL = `test-${Date.now()}@test.com`;
const TEST_PASSWORD = "TestPassword123!";

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function logTest(name, passed, details = "") {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status}: ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }

  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function testSecurityHeaders() {
  console.log("\n🔒 Testing Security Headers...");

  const res = await makeRequest("GET", "/health");

  const hasHSTS = res.headers["strict-transport-security"];
  logTest(
    "HSTS Header Present",
    !!hasHSTS,
    hasHSTS || "Missing Strict-Transport-Security header",
  );

  const hasCSP = res.headers["content-security-policy"];
  logTest(
    "CSP Header Present",
    !!hasCSP,
    hasCSP ? "CSP configured" : "Missing Content-Security-Policy header",
  );

  const hasNoSniff = res.headers["x-content-type-options"];
  logTest(
    "X-Content-Type-Options Header",
    hasNoSniff === "nosniff",
    hasNoSniff || "Missing X-Content-Type-Options header",
  );

  const hasXFrame = res.headers["x-frame-options"];
  logTest(
    "X-Frame-Options Header",
    hasXFrame === "DENY",
    hasXFrame || "Missing X-Frame-Options header",
  );
}

async function testCORSConfiguration() {
  console.log("\n🔒 Testing CORS Configuration...");

  // Test con unauthorized origin
  try {
    const res = await makeRequest("GET", "/api/announcements/active", null, {
      Origin: "https://unauthorized.com",
    });

    const corsAllowOrigin = res.headers["access-control-allow-origin"];
    const isCORSBlocked =
      !corsAllowOrigin || corsAllowOrigin !== "https://unauthorized.com";

    logTest(
      "CORS Blocks Unauthorized Origins",
      isCORSBlocked,
      `Access-Control-Allow-Origin: ${corsAllowOrigin || "not set"}`,
    );
  } catch (error) {
    logTest("CORS Blocks Unauthorized Origins", false, error.message);
  }
}

async function testRateLimiting() {
  console.log("\n🔒 Testing Rate Limiting...");

  // Test login rate limiting - make 6 requests (limit is 5 per 15 min)
  const results = [];
  for (let i = 0; i < 6; i++) {
    try {
      const res = await makeRequest("POST", "/api/auth/login", {
        email: "test@test.com",
        password: "wrongpassword",
      });
      results.push(res.status);
    } catch (error) {
      results.push(null);
    }
  }

  // First 5 should return 401 (wrong credentials), 6th should return 429 (rate limited)
  const lastStatus = results[results.length - 1];
  logTest(
    "Login Rate Limiting Active",
    lastStatus === 429,
    `6th attempt returned ${lastStatus} (expected 429)`,
  );
}

async function testAccountLockout() {
  console.log("\n🔒 Testing Account Lockout...");

  // Create a test user first
  try {
    await makeRequest("POST", "/api/auth/register", {
      tipoUtente: "Utente Registrato",
      email: TEST_EMAIL,
      codiceFiscale: "RSSMRA90A01H501U",
      password: TEST_PASSWORD,
      nome: "Test",
      cognome: "User",
      dataNascita: "1990-01-01",
      luogoNascita: "Roma",
      sesso: "Maschio",
      consensoTrattamentoDati: true,
    });

    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await makeRequest("POST", "/api/auth/login", {
        email: TEST_EMAIL,
        password: "wrongpassword",
      });
    }

    // 6th attempt should fail with account locked message
    const res = await makeRequest("POST", "/api/auth/login", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD, // even with right password
    });

    const isLocked = res.status === 429;
    logTest(
      "Account Lockout After Failed Attempts",
      isLocked,
      `Status: ${res.status}, Body: ${res.body?.message}`,
    );
  } catch (error) {
    logTest(
      "Account Lockout After Failed Attempts",
      false,
      `Error: ${error.message}`,
    );
  }
}

async function testUnifiedErrorMessages() {
  console.log("\n🔒 Testing Unified Error Messages...");

  try {
    // Test non-existent email
    const res1 = await makeRequest("POST", "/api/auth/login", {
      email: "nonexistent@test.com",
      password: "TestPassword123!",
    });

    // Test wrong password
    const res2 = await makeRequest("POST", "/api/auth/login", {
      email: TEST_EMAIL,
      password: "WrongPassword123!",
    });

    const messages1 = res1.body?.message || "";
    const messages2 = res2.body?.message || "";

    // Both should return the same error message
    const sameMessage = messages1 === messages2;
    logTest(
      "Unified Login Error Messages",
      sameMessage,
      `Both return: "${messages1}"`,
    );
  } catch (error) {
    logTest(
      "Unified Login Error Messages",
      false,
      `Error: ${error.message}`,
    );
  }
}

async function testRequestSizeLimit() {
  console.log("\n🔒 Testing Request Size Limiting...");

  try {
    // Try to send a payload > 10KB
    const largePayload = {
      tipoUtente: "Utente Registrato",
      email: "test@test.com",
      codiceFiscale: "RSSMRA90A01H501U",
      password: "TestPassword123!",
      nome: "Test",
      cognome: "User",
      dataNascita: "1990-01-01",
      luogoNascita: "Roma",
      sesso: "Maschio",
      consensoTrattamentoDati: true,
      // Add large string to exceed 10KB
      largeData: "x".repeat(11000),
    };

    const res = await makeRequest("POST", "/api/auth/register", largePayload);

    // Should reject with 413 (Payload Too Large) or similar
    const isRejected = res.status === 413 || res.status === 400;
    logTest(
      "Request Size Limiting (>10KB)",
      isRejected,
      `Status: ${res.status}`,
    );
  } catch (error) {
    logTest(
      "Request Size Limiting (>10KB)",
      false,
      `Error: ${error.message}`,
    );
  }
}

async function runAllTests() {
  console.log("🧪 RoadEye Security Features Test Suite\n");
  console.log("━".repeat(50));

  try {
    await testSecurityHeaders();
    await testCORSConfiguration();
    await testRateLimiting();
    await testAccountLockout();
    await testUnifiedErrorMessages();
    await testRequestSizeLimit();
  } catch (error) {
    console.error("Test error:", error);
  }

  console.log("\n" + "━".repeat(50));
  console.log("\n📊 Test Results:");
  console.log(`   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  console.log(`   📝 Total: ${testResults.tests.length}`);

  if (testResults.failed > 0) {
    console.log("\n❌ Failed Tests:");
    testResults.tests
      .filter((t) => !t.passed)
      .forEach((t) => {
        console.log(`   - ${t.name}: ${t.details}`);
      });
  } else {
    console.log("\n✅ All tests passed!");
  }

  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(console.error);
