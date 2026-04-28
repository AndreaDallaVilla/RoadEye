const { spawn } = require("child_process");
const { run } = require("./testAuthApiFlow");

function getBaseUrl() {
  const port = process.env.PORT || 3000;
  return process.env.TEST_API_BASE_URL || `http://localhost:${port}/api`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(baseUrl, timeoutMs = 30000) {
  const start = Date.now();
  const healthUrl = baseUrl.replace(/\/api$/, "/health");

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Server not ready yet.
    }
    await sleep(500);
  }

  throw new Error(`Server non pronto entro ${timeoutMs}ms su ${healthUrl}`);
}

function stopProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      resolve();
      return;
    }

    child.once("exit", () => resolve());
    child.kill("SIGTERM");

    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 5000);
  });
}

async function runAuto() {
  const baseUrl = getBaseUrl();
  console.log(`[INFO] Avvio server per test su ${baseUrl}`);

  const serverProcess = spawn(
    process.execPath,
    ["-r", "dotenv/config", "src/server.js"],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    },
  );

  serverProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[server] ${chunk}`);
  });
  serverProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[server-err] ${chunk}`);
  });

  try {
    await waitForHealth(baseUrl);
    await run();
    console.log("Test API auth auto completato con successo.");
  } finally {
    await stopProcess(serverProcess);
  }
}

runAuto().catch((error) => {
  console.error("Test API auth auto fallito:", error.message);
  process.exit(1);
});
