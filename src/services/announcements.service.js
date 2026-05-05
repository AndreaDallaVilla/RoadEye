// Gestisce la business logic

const Annuncio = require('../models/Announcements');

// permette creare l’oggetto annuncio con i relativi attributi
exports.creaAnnuncio = async function (datiAnnuncio) {
    // si ordina per idAnnuncio in modo descrescente che sarebeb il -1 per riuscire a prendere l'id più alto
    const ultimoAnnuncio = await Annuncio.findOne().sort({ idAnnuncio: -1 });

    
    // Se il database è vuoto, partiamo da 'aa0000'
    const ultimoCodice = ultimoAnnuncio ? ultimoAnnuncio.idAnnuncio : "aa0000";
    const nuovoCodice = incrementaCodice(ultimoCodice);

    const annuncio = new Annuncio({
        ...datiAnnuncio,
        idAnnuncio: nuovoCodice
    });

    return await annuncio.save();

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
function incrementaCodice(codice) {

    // regex per estrarre le prime due lettere e le ultime quattro cifre
    let prefix = codice.substring(0, 2);
    let number = parseInt(codice.substring(2), 10);

    // si incrementa il numero
    number++;

    // se si supera 9999 bisogna aggiornare la parte alfanumerica
    if (number > 9999) {
        number = 0; // si resetta il numero
        
        // si incrementa la parte alfabetica
        let charCode1 = prefix.charCodeAt(0);
        let charCode2 = prefix.charCodeAt(1);

        charCode2++; // si incrementa l'ultima lettera (es. 'r' -> 's')

        if (charCode2 > 122) { // 122 è 'z' in ASCII
            charCode2 = 97;    // Torna ad 'a'
            charCode1++;       // Incrementa la prima lettera
        }
        
        prefix = String.fromCharCode(charCode1, charCode2);
    }

    // si formatta il numero per avere sempre 4 cifre (es. 1 -> 0001)
    let numberStr = number.toString().padStart(4, '0');

    return prefix + numberStr; // si uniscono le due parti 
}
// Test
console.log(incrementaCodice("er1234")); // er1235
console.log(incrementaCodice("er9999")); // es0000
console.log(incrementaCodice("ez9999")); // fa0000




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