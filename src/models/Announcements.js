// rappresenta la struttura dei dati e l'interfaccia con il database 

const mongoose = require("mongoose");

const STATI_ANNUNCIO = ["Attivo", "Archiviato", "Eliminato"];
const TOPIC = ["Incidente stradale","Cantiere stradale", "Evento", "Ferimento animali", "Pericolo bordo strada", "Autovelox"];
const GRAVITA = ["Bassa", "Media", "Alta", "Altissima"];;
const VISIBILITA_ANNUNCIO = ["Tutti", "Nessuno"]; 
const INTERAZIONE_CONSENTITA = ["Tutti", "Utenti Registrati", "Ente emittente", "Centrale operativa"];

const annuncioSchema = new mongoose.Schema({
    idAnnuncio: { 
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    idUser: {
        type: String,
        required: true,
        trim: true
    },
    descrizione: {
        type: String,
        required: false,
        maxlength: 1000
    },
    posizione: {
        type: String,
        required: false,
        trim: true
    },
    coordinate: {
        latitudine: {
            type: Number,
            required: false,
            min: -90,
            max: 90
        },
        longitudine: {
            type: Number,
            required: false,
            min: -180,
            max: 180
        }
    },
    dataOraPubblicazione: {
        type: Date,
        required: true
    },
    stato: {  
        type: String,
        enum: STATI_ANNUNCIO,
        default: "Attivo",
    },
    ufficiale: { 
        // 0: segnalazione fatta da utente 
        // 1: segnalazione fatta dalle forze dell'ordine
        type: Boolean,
        default: 0
    },
    topic: {
        type: String,
        enum: TOPIC,
        required: true
    },
    gravita: {
        type: String,
        enum: GRAVITA,
        required: function() {
            return ['Incidente stradale', 'Pericolo bordo strada'].includes(this.topic);
        }
    },
    visibilita: {  
        type: String, 
        enum: VISIBILITA_ANNUNCIO, 
        default: "Tutti"
    },
    interazioneConsentita: {
        type: String, 
        enum: INTERAZIONE_CONSENTITA, 
        required: true 
    },
    tempoVitaResiduo: { 
        type: Number, 
        required: true, 
        min: 0
    },
    punteggioFeedback: { 
        type: Number, 
        default: 0 
    }
}, {timestamps: true});

module.exports = mongoose.model("Annuncio", annuncioSchema, "annunci");
