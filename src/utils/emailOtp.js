const crypto = require("crypto");

const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

function createOtpCode() {
  if (/^[0-9]{6}$/.test(process.env.AUTH_TEST_OTP_CODE || "")) {
    return process.env.AUTH_TEST_OTP_CODE;
  }

  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashOtpCode(email, purpose, code) {
  return crypto
    .createHash("sha256")
    .update(`${email}:${purpose}:${code}`)
    .digest("hex");
}

function getOtpExpiryDate() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

module.exports = {
  OTP_MAX_ATTEMPTS,
  createOtpCode,
  getOtpExpiryDate,
  hashOtpCode,
};
