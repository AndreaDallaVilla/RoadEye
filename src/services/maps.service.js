const createHttpError = require("../utils/httpError");

const GEOCODING_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ROADS_NEAREST_BASE_URL = "https://roads.googleapis.com/v1/nearestRoads";
const EMBED_BASE_URL = "https://www.google.com/maps/embed/v1";
const DEFAULT_LANGUAGE = process.env.GOOGLE_MAPS_LANGUAGE || "it";
const DEFAULT_REGION = process.env.GOOGLE_MAPS_REGION || "it";
const DEFAULT_MAP_ID = process.env.GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const TRENTINO_BOUNDS = Object.freeze({
  north: 46.62,
  south: 45.65,
  east: 11.98,
  west: 10.45,
});

function getGoogleMapsServerApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    throw createHttpError(
      503,
      "Google Maps API non configurata: imposta GOOGLE_MAPS_SERVER_API_KEY nel file .env",
    );
  }

  return apiKey;
}

function getGoogleMapsBrowserApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_BROWSER_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    throw createHttpError(
      503,
      "Google Maps API non configurata: imposta GOOGLE_MAPS_BROWSER_API_KEY nel file .env",
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
  const apiKey = getGoogleMapsServerApiKey();
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

  const params = { address: indirizzo };

  if (payload.area === "trentino") {
    params.bounds = `${TRENTINO_BOUNDS.south},${TRENTINO_BOUNDS.west}|${TRENTINO_BOUNDS.north},${TRENTINO_BOUNDS.east}`;
    params.components = "country:IT";
  }

  return chiamaGeocodingApi(params);
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

function calcolaDistanzaMetri(a, b) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(b.latitudine - a.latitudine);
  const deltaLng = toRadians(b.longitudine - a.longitudine);
  const lat1 = toRadians(a.latitudine);
  const lat2 = toRadians(b.latitudine);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

async function trovaStradaVicina(payload) {
  const latitudine = normalizzaNumero(
    payload.latitudine ?? payload.lat,
    "Latitudine",
  );
  const longitudine = normalizzaNumero(
    payload.longitudine ?? payload.lng ?? payload.lon,
    "Longitudine",
  );
  const distanzaMassimaMetri = payload.distanzaMassimaMetri
    ? normalizzaNumero(payload.distanzaMassimaMetri, "Distanza massima")
    : 35;

  assertCoordinate(latitudine, longitudine);

  const apiKey = getGoogleMapsServerApiKey();
  const url = new URL(ROADS_NEAREST_BASE_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("points", `${latitudine},${longitudine}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw createHttpError(502, "Google Roads API non raggiungibile");
  }

  const roadsPayload = await response.json();
  const snappedPoint = roadsPayload.snappedPoints?.[0];

  if (!snappedPoint?.location) {
    return {
      suStrada: false,
      messaggio: "Seleziona un punto su una strada.",
    };
  }

  const puntoOriginale = { latitudine, longitudine };
  const puntoStrada = {
    latitudine: snappedPoint.location.latitude,
    longitudine: snappedPoint.location.longitude,
  };
  const distanzaMetri = calcolaDistanzaMetri(puntoOriginale, puntoStrada);
  const suStrada = distanzaMetri <= distanzaMassimaMetri;

  return {
    suStrada,
    distanzaMetri,
    distanzaMassimaMetri,
    placeId: snappedPoint.placeId,
    coordinate: puntoStrada,
    messaggio: suStrada ? "Punto valido su strada." : "Seleziona un punto piu' vicino a una strada.",
  };
}

function creaEmbedUrl(payload) {
  const apiKey = getGoogleMapsServerApiKey();
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

function creaConfigurazioneClient() {
  return {
    apiKey: getGoogleMapsBrowserApiKey(),
    language: DEFAULT_LANGUAGE,
    region: DEFAULT_REGION,
    mapId: DEFAULT_MAP_ID,
    center: {
      latitudine: 46.0667,
      longitudine: 11.1211,
    },
    zoom: 10,
    bounds: TRENTINO_BOUNDS,
    areaLabel: "Provincia autonoma di Trento",
  };
}

module.exports = {
  creaConfigurazioneClient,
  creaEmbedUrl,
  geocodificaIndirizzo,
  geocodificaInversa,
  trovaStradaVicina,
};
