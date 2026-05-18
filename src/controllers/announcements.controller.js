// unione tra il protocollo di comunicazione e la logica applicativa 

const annuncioService = require('../services/announcements.service');

function creaNomeAutoreSnapshot(utente) {
    const profilo = utente?.profilo || {};

    return (
        profilo.nomeUtentePubblico ||
        [profilo.nome, profilo.cognome].filter(Boolean).join(" ") ||
        profilo.denominazione ||
        "Utente RoadEye"
    );
}

exports.crea = async (req, res) => {
    try {

        const {
            descrizione,
            topic,
            gravita,
            ufficiale,
            tempoVitaResiduo,
            interazioneConsentita,
            posizione,
            coordinate
        } = req.body;

        // crea una singola variabile oggetto
        const datiNuovoAnnuncio = {
            idUser: req.user.codiceFiscale,
            nomeAutore: creaNomeAutoreSnapshot(req.user),
            descrizione,
            topic,
            gravita,
            ufficiale: Boolean(ufficiale),
            posizione,
            coordinate,
            tempoVitaResiduo: tempoVitaResiduo ?? 24,
            interazioneConsentita: interazioneConsentita || "Utenti Registrati",
            dataOraPubblicazione: new Date()
        };

        // passa l'oggetto al service
        const annuncioCreato = await annuncioService.creaAnnuncio(datiNuovoAnnuncio);

        // Risposta al client
        res.status(201).json({
            success: true,
            data: annuncioCreato
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.listaAttivi = async (_req, res) => {
    try {
        const annunci = await annuncioService.listaAnnunciAttivi();

        res.status(200).json({
            success: true,
            data: annunci
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
