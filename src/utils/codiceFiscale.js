const CF16_REGEX = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
const CF11_REGEX = /^[0-9]{11}$/;
const MONTH_CODES = Object.freeze({
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  H: 6,
  L: 7,
  M: 8,
  P: 9,
  R: 10,
  S: 11,
  T: 12,
});
const OMOCODIA_VALUES = Object.freeze({
  L: "0",
  M: "1",
  N: "2",
  P: "3",
  Q: "4",
  R: "5",
  S: "6",
  T: "7",
  U: "8",
  V: "9",
});

const ODD_VALUES = Object.freeze({
  0: 1,
  1: 0,
  2: 5,
  3: 7,
  4: 9,
  5: 13,
  6: 15,
  7: 17,
  8: 19,
  9: 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 12,
  T: 14,
  U: 16,
  V: 10,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23,
});

const EVEN_VALUES = Object.freeze({
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
});

function normalizzaCodiceFiscale(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizzaSesso(value) {
  const sesso = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (["m", "maschio", "uomo"].includes(sesso)) {
    return "M";
  }

  if (["f", "femmina", "donna"].includes(sesso)) {
    return "F";
  }

  return "";
}

function decodificaCifraOmocodia(value) {
  return OMOCODIA_VALUES[value] || value;
}

function decodificaParteNumerica(value) {
  return value.split("").map(decodificaCifraOmocodia).join("");
}

function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getCenturyYear(twoDigitYear, referenceDate = new Date()) {
  const currentYear = referenceDate.getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const candidateCurrentCentury = currentCentury + twoDigitYear;

  if (candidateCurrentCentury > currentYear) {
    return candidateCurrentCentury - 100;
  }

  return candidateCurrentCentury;
}

function parseCf16Anagrafica(codiceFiscale) {
  const yearPart = decodificaParteNumerica(codiceFiscale.slice(6, 8));
  const month = MONTH_CODES[codiceFiscale[8]];
  const dayGenderPart = decodificaParteNumerica(codiceFiscale.slice(9, 11));
  const birthplaceCode = `${codiceFiscale[11]}${decodificaParteNumerica(codiceFiscale.slice(12, 15))}`;

  if (!/^[0-9]{2}$/.test(yearPart) || !month || !/^[0-9]{2}$/.test(dayGenderPart)) {
    return null;
  }

  const dayGender = Number(dayGenderPart);
  const sesso = dayGender > 40 ? "F" : "M";
  const day = sesso === "F" ? dayGender - 40 : dayGender;
  const annoDueCifre = Number(yearPart);
  const year = getCenturyYear(annoDueCifre);

  if (day < 1 || day > 31 || !isRealDate(year, month, day)) {
    return null;
  }

  if (!/^[A-Z][0-9]{3}$/.test(birthplaceCode)) {
    return null;
  }

  return {
    anno: year,
    annoDueCifre,
    mese: month,
    giorno: day,
    sesso,
    codiceCatastale: birthplaceCode,
  };
}

function calcolaCheckCharCf16(cf16Parziale) {
  let sum = 0;

  for (let i = 0; i < cf16Parziale.length; i += 1) {
    const c = cf16Parziale[i];
    const isOddPosition = (i + 1) % 2 === 1;
    sum += isOddPosition ? ODD_VALUES[c] : EVEN_VALUES[c];
  }

  return String.fromCharCode((sum % 26) + "A".charCodeAt(0));
}

function isValidCf16(codiceFiscale) {
  if (!CF16_REGEX.test(codiceFiscale)) {
    return false;
  }

  const partial = codiceFiscale.slice(0, 15);
  const checkChar = codiceFiscale[15];
  return calcolaCheckCharCf16(partial) === checkChar;
}

function isValidCodiceFiscalePersonaFisica(value, datiAnagrafici = {}) {
  const codiceFiscale = normalizzaCodiceFiscale(value);

  if (!isValidCf16(codiceFiscale)) {
    return false;
  }

  const datiCf = parseCf16Anagrafica(codiceFiscale);
  if (!datiCf) {
    return false;
  }

  if (datiAnagrafici.dataNascita) {
    const dataNascita = new Date(datiAnagrafici.dataNascita);

    if (
      Number.isNaN(dataNascita.getTime()) ||
      dataNascita.getUTCFullYear() % 100 !== datiCf.annoDueCifre ||
      dataNascita.getUTCMonth() + 1 !== datiCf.mese ||
      dataNascita.getUTCDate() !== datiCf.giorno
    ) {
      return false;
    }
  }

  const sesso = normalizzaSesso(datiAnagrafici.sesso);
  if (sesso && sesso !== datiCf.sesso) {
    return false;
  }

  return true;
}

function isValidCf11(codiceFiscale) {
  if (!CF11_REGEX.test(codiceFiscale)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    let digit = Number(codiceFiscale[i]);
    if ((i + 1) % 2 === 0) {
      sum += digit;
    } else {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
      sum += digit;
    }
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(codiceFiscale[10]);
}

function isValidCodiceFiscale(value) {
  const codiceFiscale = normalizzaCodiceFiscale(value);

  if (codiceFiscale.length === 16) {
    return isValidCf16(codiceFiscale);
  }

  if (codiceFiscale.length === 11) {
    return isValidCf11(codiceFiscale);
  }

  return false;
}

module.exports = {
  isValidCf11,
  isValidCf16,
  isValidCodiceFiscale,
  isValidCodiceFiscalePersonaFisica,
  normalizzaCodiceFiscale,
};
