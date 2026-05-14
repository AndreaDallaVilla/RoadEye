const fs = require("fs");
const path = require("path");

// Semplice audit log in file (produzione: usare database dedicato)
const AUDIT_LOG_FILE = path.join(__dirname, "../../security-audit.log");

function logSecurityEvent(event) {
  const timestamp = new Date().toISOString();
  const logEntry = JSON.stringify({
    timestamp,
    ...event,
  });

  // Log in file (append mode)
  fs.appendFile(AUDIT_LOG_FILE, logEntry + "\n", (err) => {
    if (err) {
      console.error("Errore durante il salvataggio dell'audit log:", err);
    }
  });

  // Log anche in console per development
  if (process.env.NODE_ENV !== "production") {
    console.log(`[SECURITY AUDIT] ${timestamp}`, event);
  }
}

const SECURITY_EVENTS = Object.freeze({
  LOGIN_ATTEMPT: "login_attempt",
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  ACCOUNT_LOCKED: "account_locked",
  ACCOUNT_UNLOCKED: "account_unlocked",
  PASSWORD_CHANGED: "password_changed",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",
  PASSWORD_RESET_COMPLETED: "password_reset_completed",
  EMAIL_VERIFICATION_REQUESTED: "email_verification_requested",
  EMAIL_VERIFIED: "email_verified",
  MFA_ENABLED: "mfa_enabled",
  MFA_DISABLED: "mfa_disabled",
  SESSION_CREATED: "session_created",
  SESSION_REVOKED: "session_revoked",
  UNAUTHORIZED_ACCESS_ATTEMPT: "unauthorized_access_attempt",
  SUSPICIOUS_ACTIVITY: "suspicious_activity",
});

module.exports = {
  logSecurityEvent,
  SECURITY_EVENTS,
};
