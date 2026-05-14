const crypto = require("crypto");
const { promisify } = require("util");

const createHttpError = require("./httpError");

const scrypt = promisify(crypto.scrypt);
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 16;

function validatePasswordStrength(password) {
  if (typeof password !== "string") {
    return {
      isValid: false,
      message: "La password è obbligatoria",
    };
  }

  if (password.length < 10) {
    return {
      isValid: false,
      message: "La password deve contenere almeno 10 caratteri",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: "La password deve contenere almeno un numero",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "La password deve contenere almeno una lettera maiuscola",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "La password deve contenere almeno una lettera minuscola",
    };
  }

  if (!/[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/.test(password)) {
    return {
      isValid: false,
      message: "La password deve contenere almeno un carattere speciale",
    };
  }

  return {
    isValid: true,
    message: null,
  };
}

function assertStrongPassword(password) {
  const validation = validatePasswordStrength(password);

  if (!validation.isValid) {
    throw createHttpError(400, validation.message);
  }
}

async function hashPassword(password) {
  // Salva il salt insieme alla chiave derivata per poter verificare la password in seguito.
  const salt = crypto.randomBytes(PASSWORD_SALT_LENGTH).toString("hex");
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH);

  return `${salt}:${derivedKey.toString("hex")}`; //valore salvato
}

async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) {
    return false;
  }

  const [salt, originalHash] = storedHash.split(":");

  if (!salt || !originalHash) {
    return false;
  }

  // Confronta buffer di dimensione fissa per ridurre il rischio di leak temporali.
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH);
  const originalBuffer = Buffer.from(originalHash, "hex");

  if (originalBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(originalBuffer, derivedKey); // Confronta due Buffer in modo costante nel tempo per evitare attacchi basati sul tempo di risposta che rivelerebbero byte corretti dell'hash
}

module.exports = {
  assertStrongPassword,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
};
