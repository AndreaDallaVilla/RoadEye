const nodemailer = require("nodemailer");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function creaTransportSmtp() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Configura SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS per inviare email reali");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

function parseSender() {
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim();

  if (!from) {
    throw new Error("Configura EMAIL_FROM per inviare email reali");
  }

  const namedSender = from.match(/^(.*)<([^>]+)>$/);
  if (!namedSender) {
    return { email: from };
  }

  return {
    name: namedSender[1].trim() || undefined,
    email: namedSender[2].trim(),
  };
}

async function sendMailBrevo({ to, subject, text }) {
  const apiKey = process.env.BREVO_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Configura BREVO_API_KEY per inviare email con Brevo API");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: parseSender(),
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Invio email Brevo fallito (${response.status})`);
  }
}

async function sendMail({ to, subject, text }) {
  const configuredProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!configuredProvider || configuredProvider === "console") {
    console.log(`[email:console] To: ${to}`);
    console.log(`[email:console] Subject: ${subject}`);
    console.log(`[email:console] ${text}`);
    return;
  }

  if (configuredProvider === "brevo") {
    await sendMailBrevo({ to, subject, text });
    return;
  }

  if (configuredProvider === "smtp") {
    const transporter = creaTransportSmtp();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return;
  }

  throw new Error(
    "Provider email non supportato. Usa EMAIL_PROVIDER=console, EMAIL_PROVIDER=brevo oppure EMAIL_PROVIDER=smtp.",
  );
}

async function sendEmailVerificationCode(email, code) {
  await sendMail({
    to: email,
    subject: "Codice di verifica RoadEye",
    text: `Il tuo codice di verifica RoadEye e': ${code}. Il codice scade tra 15 minuti.`,
  });
}

async function sendPasswordResetCode(email, code) {
  await sendMail({
    to: email,
    subject: "Reset password RoadEye",
    text: `Il codice per reimpostare la password RoadEye e': ${code}. Il codice scade tra 15 minuti.`,
  });
}

module.exports = {
  sendEmailVerificationCode,
  sendPasswordResetCode,
};
