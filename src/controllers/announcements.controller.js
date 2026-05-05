// unione tra il protocollo di comunicazione e la logica applicativa 

const annuncioService = require('../services/announcements.service');

exports.crea = async (req, res) => {
    try {

        const {descrizione, topic, gravita, ufficiale, tempoVitaResiduo, interazioneConsentita } = req.body;

        // crea una singola variabile oggetto
        const datiNuovoAnnuncio = {
            descrizione,
            topic,
            gravita,
            ufficiale,
            tempoVitaResiduo,
            interazioneConsentita
        };

        // passa l'oggetto al service
        const risultato = await annuncioService.creaAnnuncio(datiNuovoAnnuncio);

        // Risposta al client
        res.status(201).json({
            success: true,
            data: annuncioCreato
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            messaggio: error.message
        });
    }
};