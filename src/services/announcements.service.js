// Gestisce la business logic

const mongoose = require("mongoose");

const Annuncio = require('../models/Announcements');
const PublicEntity = require("../models/PublicEntity");
const User = require("../models/User");

const ANNOUNCEMENT_COUNTER_ID = "annunci.idAnnuncio";
const ANNOUNCEMENT_COUNTER_COLLECTION = "counters";
const ANNOUNCEMENT_CODE_BLOCK_SIZE = 10000;
const MIN_DISTANCE_SAME_TOPIC_METERS = 25;

// permette creare l’oggetto annuncio con i relativi attributi
exports.creaAnnuncio = async function (datiAnnuncio) {
    await verificaDistanzaMinimaStessoTopic(datiAnnuncio);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const nuovoCodice = await generaProssimoIdAnnuncio();
        const annuncio = new Annuncio({
            ...datiAnnuncio,
            idAnnuncio: nuovoCodice
        });

        try {
            return await annuncio.save();
        } catch (error) {
            if (error?.code !== 11000 || !error?.keyPattern?.idAnnuncio || attempt === 2) {
                throw error;
            }
        }
    }

}

async function verificaDistanzaMinimaStessoTopic(datiAnnuncio) {
    const latitudine = Number(datiAnnuncio?.coordinate?.latitudine);
    const longitudine = Number(datiAnnuncio?.coordinate?.longitudine);

    if (!datiAnnuncio?.topic || !Number.isFinite(latitudine) || !Number.isFinite(longitudine)) {
        return;
    }

    const latDelta = MIN_DISTANCE_SAME_TOPIC_METERS / 111320;
    const cosLat = Math.cos(toRadians(latitudine));
    const lngDelta = MIN_DISTANCE_SAME_TOPIC_METERS / (111320 * Math.max(Math.abs(cosLat), 0.000001));

    const annunciVicini = await Annuncio.find({
        stato: "Attivo",
        topic: datiAnnuncio.topic,
        "coordinate.latitudine": {
            $gte: latitudine - latDelta,
            $lte: latitudine + latDelta,
        },
        "coordinate.longitudine": {
            $gte: longitudine - lngDelta,
            $lte: longitudine + lngDelta,
        },
    })
        .select("idAnnuncio coordinate")
        .lean();

    const duplicatoVicino = annunciVicini.find((annuncio) =>
        calcolaDistanzaMetri(
            { latitudine, longitudine },
            annuncio.coordinate,
        ) <= MIN_DISTANCE_SAME_TOPIC_METERS
    );

    if (duplicatoVicino) {
        throw new Error(`Esiste gia' una segnalazione "${datiAnnuncio.topic}" entro ${MIN_DISTANCE_SAME_TOPIC_METERS} metri.`);
    }
}

function toRadians(value) {
    return Number(value) * Math.PI / 180;
}

function calcolaDistanzaMetri(a, b) {
    const lat1 = Number(a?.latitudine);
    const lon1 = Number(a?.longitudine);
    const lat2 = Number(b?.latitudine);
    const lon2 = Number(b?.longitudine);

    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
        return Number.POSITIVE_INFINITY;
    }

    const earthRadiusMeters = 6371000;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const haversine =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(deltaLon / 2) ** 2;

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

async function generaProssimoIdAnnuncio() {
    await inizializzaContatoreAnnunci();

    const counter = await mongoose.connection.collection(ANNOUNCEMENT_COUNTER_COLLECTION).findOneAndUpdate(
        { _id: ANNOUNCEMENT_COUNTER_ID },
        { $inc: { seq: 1 } },
        { returnDocument: "after" },
    );

    const updatedCounter = counter.value || counter;
    return sequenzaACodice(updatedCounter.seq);
}

async function inizializzaContatoreAnnunci() {
    const collection = mongoose.connection.collection(ANNOUNCEMENT_COUNTER_COLLECTION);
    const existingCounter = await collection.findOne({ _id: ANNOUNCEMENT_COUNTER_ID });

    if (existingCounter) {
        return;
    }

    const ultimoAnnuncio = await Annuncio.findOne().sort({ idAnnuncio: -1 }).select("idAnnuncio").lean();
    const ultimaSequenza = ultimoAnnuncio ? codiceASequenza(ultimoAnnuncio.idAnnuncio) : 0;

    await collection.updateOne(
        { _id: ANNOUNCEMENT_COUNTER_ID },
        { $setOnInsert: { seq: ultimaSequenza } },
        { upsert: true },
    );
}

exports.listaAnnunciAttivi = async function () {
    const annunci = await Annuncio.find({
        stato: "Attivo",
        "coordinate.latitudine": { $type: "number" },
        "coordinate.longitudine": { $type: "number" }
    })
        .sort({ dataOraPubblicazione: -1 })
        .select("idAnnuncio idUser nomeAutore descrizione topic gravita posizione coordinate dataOraPubblicazione")
        .lean();

    return arricchisciAutoriAnnunci(annunci);
};

function creaNomeAutore(utente) {
    if (!utente) {
        return "";
    }

    const profilo = utente.profilo || {};

    if (profilo.nomeUtentePubblico) {
        return profilo.nomeUtentePubblico;
    }

    if (profilo.nome || profilo.cognome) {
        return [profilo.nome, profilo.cognome].filter(Boolean).join(" ");
    }

    if (profilo.denominazione) {
        return profilo.denominazione;
    }

    return "";
}

async function arricchisciAutoriAnnunci(annunci) {
    const codiciFiscali = [...new Set(annunci.map((annuncio) => annuncio.idUser).filter(Boolean))];

    if (codiciFiscali.length === 0) {
        return annunci;
    }

    const [utenti, enti] = await Promise.all([
        User.find({ codiceFiscale: { $in: codiciFiscali } })
            .select("codiceFiscale profilo.nome profilo.cognome profilo.nomeUtentePubblico")
            .lean(),
        PublicEntity.find({ codiceFiscale: { $in: codiciFiscali } })
            .select("codiceFiscale profilo.denominazione")
            .lean(),
    ]);

    const autoriByCodiceFiscale = new Map();

    utenti.forEach((utente) => {
        const nomeAutore = creaNomeAutore(utente);
        if (nomeAutore) {
            autoriByCodiceFiscale.set(utente.codiceFiscale, nomeAutore);
        }
    });

    enti.forEach((ente) => {
        const nomeAutore = creaNomeAutore(ente);
        if (nomeAutore && !autoriByCodiceFiscale.has(ente.codiceFiscale)) {
            autoriByCodiceFiscale.set(ente.codiceFiscale, nomeAutore);
        }
    });

    function isNomeAutorePlaceholder(nomeAutore) {
        return !nomeAutore || nomeAutore === "Utente eliminato";
    }

    const annunciDaAggiornare = annunci
        .filter((annuncio) =>
            autoriByCodiceFiscale.has(annuncio.idUser) &&
            (
                isNomeAutorePlaceholder(annuncio.nomeAutore) ||
                annuncio.nomeAutore !== autoriByCodiceFiscale.get(annuncio.idUser)
            )
        )
        .map((annuncio) => ({
            updateOne: {
                filter: { _id: annuncio._id },
                update: { $set: { nomeAutore: autoriByCodiceFiscale.get(annuncio.idUser) } },
            },
        }));

    if (annunciDaAggiornare.length > 0) {
        await Annuncio.bulkWrite(annunciDaAggiornare, { ordered: false });
    }

    return annunci.map((annuncio) => ({
        ...annuncio,
        nomeAutore: autoriByCodiceFiscale.get(annuncio.idUser) || annuncio.nomeAutore || "Utente eliminato",
    }));
}




// permette di segnare se l’annuncio passa da attivo ad archiviato
exports.aggiornaStato = async function(nuovoStato) {
    if(!STATI_ANNUNCIO.includes(nuovoStato)) {
        throw new Error("Stato non valido");
    }
    annuncio.stato = nuovoStato;
    return await this.save();
}

// permette di bloccare la fase di creazione eliminando le modifiche fatte fino a quel punto sull’annuncio
exports.annullaPubblicazione = async function() {
    // deve prendere automaticamente una stringa di valori per creare l'id
    annuncio.idAnnuncio = ""; 
   

    annuncio.descrizione = "";
    annuncio.dataOraPubblicazione = new Date();
    annuncio.topic = "Incidente stradale";
    annuncio.gravita = "Bassa";


    annuncio.interazioneConsentita = "";
    annuncio.stato = 'Eliminato';
    annuncio.visibilita = 'Nessuna'; 
    return await this.save();

};

// permette di calcolare dove andrà a posizionarsi rispetto ad altri annunci sulla schermata di visualizzazione
exports.calcolaPriorita = function() {
    let punteggioPriorita = 0;
    
    if (this.ufficiale) punteggioPriorita += 50;
    
    if (this.gravita === 'Alta') punteggioPriorita += 30;
    else if (this.gravita === 'Media') punteggioPriorita += 15;
    
    return punteggioPriorita;
};

// funzione non segnata in nessun deliverable, ma puo essere utile per gestire l'idAnnuncio
// al momento non c'è nulla che controlla l'idAnnuncio
function codiceASequenza(codice) {
    if (!/^[a-z]{2}[0-9]{4}$/.test(codice || "")) {
        return 0;
    }

    const prefixIndex =
        (codice.charCodeAt(0) - 97) * 26 +
        (codice.charCodeAt(1) - 97);
    const number = parseInt(codice.substring(2), 10);

    return prefixIndex * ANNOUNCEMENT_CODE_BLOCK_SIZE + number;
}

function sequenzaACodice(sequence) {
    const prefixIndex = Math.floor(sequence / ANNOUNCEMENT_CODE_BLOCK_SIZE);
    const number = sequence % ANNOUNCEMENT_CODE_BLOCK_SIZE;
    const firstCharIndex = Math.floor(prefixIndex / 26);
    const secondCharIndex = prefixIndex % 26;

    if (firstCharIndex > 25) {
        throw new Error("Spazio idAnnuncio esaurito");
    }

    const prefix = String.fromCharCode(97 + firstCharIndex, 97 + secondCharIndex);
    return `${prefix}${String(number).padStart(4, "0")}`;
}
/*
    idAnnuncio: { 
    descrizione: {
    dataOraPubblicazione: {
    stato: { // ?? 
    ufficiale: { // ??
    topic: {
    gravita: {
    visibilita: { // ?? 
    interazioneConsentita: { // ??
    tempoVitaResiduo: { 
    punteggioFeedback: 
  */
