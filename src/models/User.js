const mongoose = require("mongoose");

const {
  REGEX_CODICE_FISCALE,
  REGEX_CODICE_IPA,
  REGEX_CODICE_UNIVOCO,
  REGEX_EMAIL,
  REGEX_NOME_UTENTE_PUBBLICO,
  REGEX_PEC,
  STATI_ACCOUNT,
  TIPI_UTENTE,
  VALORI_CATEGORIE_ENTI_PUBBLICI,
  VALORI_SESSI,
  VALORI_STATI_ACCOUNT,
  VALORI_TIPI_UTENTE,
} = require("../utils/constants");
const {
  isValidCodiceFiscalePersonaFisica,
} = require("../utils/codiceFiscale");

const {
  identificaEntePubblico,
  normalizzaCodiceIpa,
  normalizzaCodiceUnivoco,
} = require("../utils/identificazioneEntePubblico");
const { PAESI_TELEFONO, PREFISSI_TELEFONO } = require("../utils/telefono");

function haAlmenoQuattordiciAnni(dataNascita) {
  if (!(dataNascita instanceof Date) || Number.isNaN(dataNascita.getTime())) {
    return false;
  }

  const oggi = new Date();
  const dataMinima = new Date(
    oggi.getFullYear() - 14,
    oggi.getMonth(),
    oggi.getDate(),
  );

  return dataNascita <= dataMinima;
}

// Ogni login crea una sessione lato server, cosi ogni token puo essere revocato singolarmente.
const schemaSessione = new mongoose.Schema(
  {
    hashToken: {
      type: String,
      required: true,
    },
    scadeIl: {
      type: Date,
      required: true,
    },
    creatoIl: {
      type: Date,
      default: Date.now,
    },
    ultimoUtilizzoIl: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const schemaUtente = new mongoose.Schema(
  {
    tipoUtente: {
      type: String,
      enum: VALORI_TIPI_UTENTE,
      required: true,
    },
    codiceFiscale: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    hashPassword: {
      type: String,
      required: true,
      select: false,
    },
    statoAccount: {
      type: String,
      enum: VALORI_STATI_ACCOUNT,
      default: STATI_ACCOUNT.ATTIVO,
    },
    impostazioni: {
      localizzazioneAttiva: {
        type: Boolean,
        default: false,
      },
      mfaAttiva: {
        type: Boolean,
        default: false,
      },
      notificheAttive: {
        type: Boolean,
        default: false,
      },
    },
    consensi: {
      trattamentoDati: {
        type: Boolean,
        default: false,
      },
      trattamentoDatiAccettatoIl: {
        type: Date,
      },
    },
    profilo: {
      nome: {
        type: String,
        trim: true,
      },
      cognome: {
        type: String,
        trim: true,
      },
      nomeUtentePubblico: {
        type: String,
        trim: true,
      },
      dataNascita: {
        type: Date,
      },
      luogoNascita: {
        type: String,
        trim: true,
      },
      sesso: {
        type: String,
        enum: VALORI_SESSI,
      },
      numeroTelefono: {
        type: String,
        trim: true,
      },
      nazioneTelefono: {
        type: String,
        enum: PAESI_TELEFONO,
      },
      prefissoTelefono: {
        type: String,
        enum: PREFISSI_TELEFONO,
      },
      denominazione: {
        type: String,
        trim: true,
      },
      pec: {
        type: String,
        trim: true,
        lowercase: true,
      },
      codiceIpa: {
        type: String,
        trim: true,
        uppercase: true,
      },
      codiceUnivoco: {
        type: String,
        trim: true,
        uppercase: true,
      },
      categoria: {
        type: String,
        enum: VALORI_CATEGORIE_ENTI_PUBBLICI,
      },
    },
    sessioni: {
      type: [schemaSessione],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    strict: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.hashPassword;
        delete ret.sessioni;
        delete ret.__v;
        return ret;
      },
    },
  },
);

schemaUtente.index({ email: 1 }, { unique: true });
schemaUtente.index(
  { codiceFiscale: 1 },
  {
    unique: true,
    partialFilterExpression: { tipoUtente: TIPI_UTENTE.UTENTE_REGISTRATO },
  },
);
schemaUtente.index(
  {
    tipoUtente: 1,
    codiceFiscale: 1,
    "profilo.codiceIpa": 1,
    "profilo.codiceUnivoco": 1,
  },
  {
    unique: true,
    partialFilterExpression: { tipoUtente: TIPI_UTENTE.ENTE_PUBBLICO },
  },
);
schemaUtente.index({ "profilo.nomeUtentePubblico": 1 }, { unique: true, sparse: true });

schemaUtente.pre("validate", function validaUtente(next) {
  if (!REGEX_EMAIL.test(this.email)) {
    this.invalidate("email", "Formato email non valido");
  }

  if (this.tipoUtente === TIPI_UTENTE.UTENTE_REGISTRATO) {
    if (!isValidCodiceFiscalePersonaFisica(this.codiceFiscale, {
      dataNascita: this.profilo?.dataNascita,
      sesso: this.profilo?.sesso,
    })) {
      this.invalidate(
        "codiceFiscale",
        "Codice fiscale non valido o non coerente con data di nascita e sesso",
      );
    }

    // Gli utenti registrati richiedono i dati personali previsti dal deliverable.
    if (!this.profilo?.nome) {
      this.invalidate("profilo.nome", "Il nome è obbligatorio");
    }

    if (!this.profilo?.cognome) {
      this.invalidate("profilo.cognome", "Il cognome è obbligatorio");
    }

    if (this.profilo?.nomeUtentePubblico && !REGEX_NOME_UTENTE_PUBBLICO.test(this.profilo.nomeUtentePubblico)) {
      this.invalidate(
        "profilo.nomeUtentePubblico",
        "Il nome utente pubblico deve contenere da 3 a 30 caratteri e usare solo lettere, numeri, '.', '_' o '-'",
      );
    }

    if (!this.profilo?.dataNascita) {
      this.invalidate("profilo.dataNascita", "La data di nascita è obbligatoria");
    } else if (!haAlmenoQuattordiciAnni(this.profilo.dataNascita)) {
      this.invalidate(
        "profilo.dataNascita",
        "L'utente deve avere almeno 14 anni",
      );
    }

    if (!this.profilo?.luogoNascita) {
      this.invalidate("profilo.luogoNascita", "Il luogo di nascita è obbligatorio");
    }
  }

  if (this.tipoUtente === TIPI_UTENTE.ENTE_PUBBLICO) {
    if (!REGEX_CODICE_FISCALE.test(this.codiceFiscale)) {
      this.invalidate("codiceFiscale", "Formato del codice fiscale non valido");
    }

    if (this.profilo?.codiceIpa) {
      this.profilo.codiceIpa = normalizzaCodiceIpa(this.profilo.codiceIpa);
    }

    if (this.profilo?.codiceUnivoco) {
      this.profilo.codiceUnivoco = normalizzaCodiceUnivoco(this.profilo.codiceUnivoco);
    }

    // Gli enti pubblici seguono un percorso di validazione diverso basato sugli identificativi istituzionali.
    if (!this.profilo?.denominazione) {
      this.invalidate(
        "profilo.denominazione",
        "La denominazione è obbligatoria per gli enti pubblici",
      );
    }

    if (!this.profilo?.pec) {
      this.invalidate("profilo.pec", "La PEC è obbligatoria per gli enti pubblici");
    } else if (!REGEX_PEC.test(this.profilo.pec)) {
      this.invalidate("profilo.pec", "Formato PEC non valido");
    }

    if (!this.profilo?.codiceIpa) {
      this.invalidate(
        "profilo.codiceIpa",
        "Il codice IPA è obbligatorio per gli enti pubblici",
      );
    } else if (!REGEX_CODICE_IPA.test(this.profilo.codiceIpa)) {
      this.invalidate("profilo.codiceIpa", "Formato del codice IPA non valido");
    }

    if (this.profilo?.codiceUnivoco && !REGEX_CODICE_UNIVOCO.test(this.profilo.codiceUnivoco)) {
      this.invalidate(
        "profilo.codiceUnivoco",
        "Formato del codice univoco non valido",
      );
    }

    const identificazioneEnte = identificaEntePubblico({
      codiceFiscale: this.codiceFiscale,
      codiceIpa: this.profilo?.codiceIpa,
      codiceUnivoco: this.profilo?.codiceUnivoco,
    });

    if (identificazioneEnte) {
      this.profilo.categoria = identificazioneEnte.categoria;
      this.profilo.denominazione =
        this.profilo.denominazione || identificazioneEnte.denominazione;
    }
  }

  next();
});

module.exports = mongoose.model("User", schemaUtente);
