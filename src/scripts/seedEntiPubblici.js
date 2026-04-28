require("dotenv").config();

const mongoose = require("mongoose");
const connectToDatabase = require("../config/db");
const authService = require("../services/auth.service");
const PublicEntity = require("../models/PublicEntity");
const {
  REGOLE_IDENTIFICAZIONE_ENTI_PUBBLICI,
  TIPI_UTENTE,
} = require("../utils/constants");

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function ensureCodiceIpa(codiceIpa, identificativo) {
  const normalized = String(codiceIpa || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (/^[A-Z0-9_]{4,10}$/.test(normalized)) {
    return normalized;
  }

  const fallback = `${identificativo}`.replace(/[^A-Z0-9_]/g, "").slice(0, 10);
  return (fallback || "ENTE").padEnd(4, "0").slice(0, 10);
}

function ensureCodiceUnivoco(codiceUnivoco, identificativo) {
  const normalized = String(codiceUnivoco || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (/^[A-Z0-9]{4,10}$/.test(normalized)) {
    return normalized;
  }

  const fallback = `${identificativo}`.replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return (fallback || "ENT0").padEnd(4, "0").slice(0, 10);
}

async function seedEntiPubblici() {
  const defaultPassword = process.env.SEED_ENTI_DEFAULT_PASSWORD || "RoadEye2026$";

  await connectToDatabase();

  let created = 0;
  let alreadyExisting = 0;
  let failed = 0;

  for (const regola of REGOLE_IDENTIFICAZIONE_ENTI_PUBBLICI) {
    const identificativo = regola.identificativoIstituzionale || "ente_pubblico";
    const slug = toSlug(identificativo);
    const email = `${slug}@enti.roadeye.local`;
    const pec = `${slug}@pec.it`;
    const codiceFiscale = String(regola.codiceFiscale || "").trim().toUpperCase();
    const codiceIpa = ensureCodiceIpa(regola.codiceIpa, identificativo.toUpperCase());
    const codiceUnivoco = ensureCodiceUnivoco(
      regola.codiceUnivoco,
      identificativo.toUpperCase(),
    );

    const existing = await PublicEntity.findOne({ email });
    if (existing) {
      alreadyExisting += 1;
      continue;
    }

    try {
      await authService.registerUser({
        tipoUtente: TIPI_UTENTE.ENTE_PUBBLICO,
        email,
        codiceFiscale,
        password: defaultPassword,
        denominazione: regola.denominazione || identificativo,
        pec,
        codiceIpa,
        codiceUnivoco,
      });
      created += 1;
      console.log(`[CREATED] ${identificativo} -> ${email}`);
    } catch (error) {
      failed += 1;
      console.error(`[FAILED] ${identificativo}: ${error.message}`);
    }
  }

  console.log("");
  console.log("Seed enti pubblici completato.");
  console.log(`Creati: ${created}`);
  console.log(`Già esistenti: ${alreadyExisting}`);
  console.log(`Falliti: ${failed}`);
  console.log(
    `Password predefinita seed: ${process.env.SEED_ENTI_DEFAULT_PASSWORD || "RoadEye2026$"}`,
  );
}

seedEntiPubblici()
  .catch((error) => {
    console.error("Seed enti pubblici fallito:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
