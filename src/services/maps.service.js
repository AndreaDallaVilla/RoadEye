const createHttpError = require("../utils/httpError");

const GEOCODING_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const EMBED_BASE_URL = "https://www.google.com/maps/embed/v1";
const DEFAULT_LANGUAGE = process.env.GOOGLE_MAPS_LANGUAGE || "it";
const DEFAULT_REGION = process.env.GOOGLE_MAPS_REGION || "it";

function getGoogleMapsApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    throw createHttpError(
      503,
      "Google Maps API non configurata: imposta GOOGLE_MAPS_API_KEY nel file .env",
    );
  }

  return apiKey;
}

function normalizzaTesto(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizzaNumero(value, nomeCampo) {
  const numero = Number(value);

  if (!Number.isFinite(numero)) {
    throw createHttpError(400, `${nomeCampo} non valido`);
  }

  return numero;
}

function assertCoordinate(latitudine, longitudine) {
  if (latitudine < -90 || latitudine > 90) {
    throw createHttpError(400, "Latitudine fuori intervallo");
  }

  if (longitudine < -180 || longitudine > 180) {
    throw createHttpError(400, "Longitudine fuori intervallo");
  }
}

function sanitizzaRisultatoGeocoding(result) {
  return {
    indirizzoFormattato: result.formatted_address,
    placeId: result.place_id,
    coordinate: {
      latitudine: result.geometry.location.lat,
      longitudine: result.geometry.location.lng,
    },
    tipoPosizione: result.geometry.location_type,
    viewport: result.geometry.viewport,
    tipi: result.types,
  };
}

async function chiamaGeocodingApi(params) {
  const apiKey = getGoogleMapsApiKey();
  const url = new URL(GEOCODING_BASE_URL);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", DEFAULT_LANGUAGE);
  url.searchParams.set("region", DEFAULT_REGION);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw createHttpError(502, "Google Maps API non raggiungibile");
  }

  const payload = await response.json();

  if (payload.status === "ZERO_RESULTS") {
    return {
      status: payload.status,
      risultati: [],
    };
  }

  if (payload.status !== "OK") {
    throw createHttpError(
      502,
      payload.error_message || `Google Maps API ha risposto con stato ${payload.status}`,
    );
  }

  return {
    status: payload.status,
    risultati: payload.results.map(sanitizzaRisultatoGeocoding),
  };
}

async function geocodificaIndirizzo(payload) {
  const indirizzo = normalizzaTesto(payload.indirizzo || payload.address);

  if (!indirizzo) {
    throw createHttpError(400, "Indirizzo obbligatorio");
  }

  return chiamaGeocodingApi({ address: indirizzo });
}

async function geocodificaInversa(payload) {
  const latitudine = normalizzaNumero(
    payload.latitudine ?? payload.lat,
    "Latitudine",
  );
  const longitudine = normalizzaNumero(
    payload.longitudine ?? payload.lng ?? payload.lon,
    "Longitudine",
  );

  assertCoordinate(latitudine, longitudine);

  return chiamaGeocodingApi({ latlng: `${latitudine},${longitudine}` });
}

function creaEmbedUrl(payload) {
  const apiKey = getGoogleMapsApiKey();
  const query = normalizzaTesto(payload.query || payload.indirizzo || payload.address);
  const placeId = normalizzaTesto(payload.placeId || payload.place_id);
  const latitudine = payload.latitudine ?? payload.lat;
  const longitudine = payload.longitudine ?? payload.lng ?? payload.lon;
  const zoom = payload.zoom ? normalizzaNumero(payload.zoom, "Zoom") : 15;

  const url = new URL(`${EMBED_BASE_URL}/place`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", DEFAULT_LANGUAGE);
  url.searchParams.set("region", DEFAULT_REGION);
  url.searchParams.set("zoom", String(Math.min(Math.max(zoom, 1), 21)));

  if (placeId) {
    url.searchParams.set("q", `place_id:${placeId}`);
    return { embedUrl: url.toString() };
  }

  if (query) {
    url.searchParams.set("q", query);
    return { embedUrl: url.toString() };
  }

  if (latitudine !== undefined && longitudine !== undefined) {
    const lat = normalizzaNumero(latitudine, "Latitudine");
    const lng = normalizzaNumero(longitudine, "Longitudine");
    assertCoordinate(lat, lng);
    url.searchParams.set("q", `${lat},${lng}`);
    return { embedUrl: url.toString() };
  }

  throw createHttpError(
    400,
    "Fornisci query, indirizzo, placeId oppure latitudine e longitudine",
  );
}

module.exports = {
  creaEmbedUrl,
  geocodificaIndirizzo,
  geocodificaInversa,
};
