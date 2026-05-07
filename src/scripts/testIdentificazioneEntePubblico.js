const assert = require("assert");
const {
  identificaEntePubblico,
  normalizzaCodiceFiscale,
  normalizzaCodiceIpa,
  normalizzaCodiceUnivoco,
} = require("../utils/identificazioneEntePubblico");

function testNormalizzazioni() {
  assert.strictEqual(
    normalizzaCodiceFiscale(" abcd1234ef "),
    "ABCD1234EF",
    "Normalizzazione codice fiscale non corretta",
  );
  assert.strictEqual(
    normalizzaCodiceIpa(" c 1378 "),
    "C_1378",
    "Normalizzazione codice IPA non corretta",
  );
  assert.strictEqual(
    normalizzaCodiceUnivoco(" ke 9b1b "),
    "KE9B1B",
    "Normalizzazione codice univoco non corretta",
  );
}

function testIdentificazioneComune() {
  const match = identificaEntePubblico({
    codiceFiscale: "00355870221",
    codiceIpa: "c 1378",
    codiceUnivoco: "qualunque",
  });

  assert.ok(match, "Match atteso per regola Comune");
  assert.strictEqual(match.identificatore, "comune", "Identificatore non corretto");
  assert.strictEqual(match.categoria, "Comune", "Categoria non corretta");
  assert.strictEqual(match.denominazione, "Comune", "Denominazione non corretta");
}

function testIdentificazioneCentraleOperativa() {
  const match = identificaEntePubblico({
    codiceFiscale: "00355870221",
    codiceIpa: "p tn",
    codiceUnivoco: "00efwv",
  });

  assert.ok(match, "Match atteso per regola Centrale Operativa");
  assert.strictEqual(
    match.identificatore,
    "Centrale_Operativa",
    "Identificatore non corretto",
  );
  assert.strictEqual(
    match.categoria,
    "CentraleOperativa",
    "Categoria non corretta",
  );
  assert.strictEqual(
    match.denominazione,
    "Centrale Operativa",
    "Denominazione non corretta",
  );
}

function testNessunMatch() {
  const match = identificaEntePubblico({
    codiceFiscale: "ZZZZZZZZZZZZ",
    codiceIpa: "XXXX",
    codiceUnivoco: "YYYY",
  });

  assert.strictEqual(match, null, "Nessun match atteso con codici non validi");
}

function run() {
  testNormalizzazioni();
  testIdentificazioneComune();
  testIdentificazioneCentraleOperativa();
  testNessunMatch();
  console.log("Tutti i test su identificazioneEntePubblico.js sono passati.");
}

run();
