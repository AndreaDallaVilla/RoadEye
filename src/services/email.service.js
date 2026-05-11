const nodemailer = require("nodemailer");

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

async function sendMail({ to, subject, text }) {
  const configuredProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (!configuredProvider || configuredProvider === "console") {
    console.log(`[email:console] To: ${to}`);
    console.log(`[email:console] Subject: ${subject}`);
    console.log(`[email:console] ${text}`);
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
    "Provider email non supportato. Usa EMAIL_PROVIDER=console oppure EMAIL_PROVIDER=smtp.",
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
