(function () { 
  const TOKEN_KEY = "roadeye.token";
  const SEVERITY_TOPICS = ["Incidente stradale", "Pericolo bordo strada"]; // topic che hanno bisogno di avere la gravità
  const TOPIC_MARKER_COLORS = { // tutti i topic con i relativi per la gestione della parte grafica 
    "Incidente stradale": "#d93025",
    "Cantiere stradale": "#f9ab00",
    Evento: "#1a73e8",
    "Ferimento animali": "#8e24aa",
    "Pericolo bordo strada": "#e8710a",
    Autovelox: "#188038",
  };
  const OTP_RESEND_COOLDOWN_SECONDS = 60;


  const map = document.querySelector("gmp-map");
  const marker = document.querySelector("gmp-advanced-marker");
  const mapSearchInput = document.querySelector("#map-search");
  const status = document.querySelector("#maps-status");
  const drawer = document.querySelector("#drawer");
  const drawerUser = document.querySelector("#drawer-user");
  const headerAuthButton = document.querySelector("#header-auth-button");
  const authMessage = document.querySelector("#auth-message");
  const homeMapHost = document.querySelector("#home-map-host");
  const reportMapHost = document.querySelector("#report-map-host");
  const sharedMapPanel = document.querySelector("#shared-map-panel");
  const reportTopicStep = document.querySelector("#report-topic-step"); // scegliere il tipo di problema
  const reportForm = document.querySelector("#report-form"); // modulo intero
  const reportPosition = document.querySelector("#report-position"); 
  const reportLatitude = document.querySelector("#report-latitude"); // campo per salvare le coordinate
  const reportLongitude = document.querySelector("#report-longitude"); // campo per salvare le coordinate
  const reportCategory = document.querySelector("#report-category");  // scegliere il tipo di problema
  const birthPlace = document.querySelector("#birth-place");
  const severityDialog = document.querySelector("#severity-dialog");
  const severityRange = document.querySelector("#severity-range"); // gestione della gravità
  const severityLabel = document.querySelector("#severity-label"); // gestione della gravità
  const headerSectionTitle = document.querySelector("#header-section-title"); // cambiare il titolo in alto nella pagina dinamicamente

  const viewTitles = { // visione di titoli 
    home: "Home",
    report: "Nuova segnalazione",
    auth: "Accedi",
  };

  const authTitles = { // sezione accedi
    "forgot-password": "Recupera password",
    login: "Accedi",
    register: "Registrati",
    "reset-password": "Nuova password",
  };

  // variabili per la gestione degli annunci 
  let selectedPlace = null;
  let selectedLocation = null;
  let allowedBounds = null;
  let currentView = "home";
  let currentReportStep = "topic";
  let publicEntities = [];
  let pendingReportForm = null;
  let pendingRegistrationPayload = null;
  const otpCooldownTimers = new Map();
  let announcementMarkers = [];
  let selectionInfoWindow = null;
  let mapSearchAutocomplete = null;
  let reportPositionAutocomplete = null;
  let birthPlaceAutocomplete = null;
  const severityValues = ["Bassa", "Media", "Alta", "Altissima"];

  function setStatus(message, state) { // gestisce i messaggi di errore o successo per l'app
    const shouldShow = state === "error" && message;
    status.textContent = shouldShow ? message : "";
    status.hidden = !shouldShow;
    status.classList.remove("ready", "error");

    if (shouldShow) {
      status.classList.add(state);
    }
  }

  function setAuthMessage(message, state) { // gestisce i messaggi di errore o successo per l'accesso utente
    authMessage.textContent = message || "";
    authMessage.classList.remove("ok", "error");

    if (state) {
      authMessage.classList.add(state);
    }
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function formatCoordinates(location) {
    const normalizedLocation = getPlainLocation(location);

    if (!normalizedLocation) {
      return "";
    }

    return `${normalizedLocation.lat.toFixed(5)}, ${normalizedLocation.lng.toFixed(5)}`;
  }

  function getPlainLocation(location) { // gestisce le coordinate 
    if (!location) {
      return null;
    }

    const jsonLocation = typeof location.toJSON === "function" ? location.toJSON() : null;
    const lat =
      typeof location.lat === "function"
        ? location.lat()
        : location.lat ?? location.latitude ?? location.latitudine ?? jsonLocation?.lat ?? jsonLocation?.latitude;
    const lng =
      typeof location.lng === "function"
        ? location.lng()
        : location.lng ?? location.longitude ?? location.longitudine ?? jsonLocation?.lng ?? jsonLocation?.longitude;

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return null;
    }

    return {
      lat: Number(lat),
      lng: Number(lng),
    };
  }

  function fitMapToViewport(viewport) {
    if (!viewport || !map?.innerMap || typeof google === "undefined") {
      return false;
    }

    try {
      if (typeof viewport.getNorthEast === "function" && typeof viewport.getSouthWest === "function") {
        map.innerMap.fitBounds(viewport);
        return true;
      }

      const bounds = new google.maps.LatLngBounds(
        { lat: viewport.south, lng: viewport.west },
        { lat: viewport.north, lng: viewport.east },
      );

      if (!bounds.isEmpty()) {
        map.innerMap.fitBounds(bounds);
        return true;
      }
    } catch (_error) {
      return false;
    }

    return false;
  }

  function moveMapToLocation(location, viewport, options = {}) {
    const normalizedLocation = getPlainLocation(location);

    if (!normalizedLocation || !map?.innerMap) {
      return false;
    }

    if (!options.ignoreViewport && fitMapToViewport(viewport)) {
      if (options.maxZoom && map.innerMap.getZoom() > options.maxZoom) {
        map.innerMap.setZoom(options.maxZoom);
      }

      return true;
    }

    if (options.exactZoom) {
      map.innerMap.setZoom(options.exactZoom);
      map.innerMap.setCenter(normalizedLocation);
      google.maps.event.addListenerOnce(map.innerMap, "idle", () => {
        map.innerMap.setCenter(normalizedLocation);
      });
      return true;
    }

    map.innerMap.setZoom(17);
    map.innerMap.setCenter(normalizedLocation);

    if (options.maxZoom && map.innerMap.getZoom() > options.maxZoom) {
      map.innerMap.setZoom(options.maxZoom);
    }

    return true;
  }

  function setSelectedLocation(location, address) {
    const normalizedLocation = getPlainLocation(location);

    selectedLocation = normalizedLocation;
    reportLatitude.value = normalizedLocation ? String(normalizedLocation.lat) : "";
    reportLongitude.value = normalizedLocation ? String(normalizedLocation.lng) : "";
    reportPosition.value = address || (normalizedLocation ? formatCoordinates(normalizedLocation) : "");
  }

  function isReportLocationSelectionActive() {
    return currentView === "report" && currentReportStep === "details";
  }

  function updateSelectionMarkerVisibility() { // gestione dei marker 
    if (!marker) {
      return;
    }

    if (isReportLocationSelectionActive() && selectedLocation) {
      marker.position = selectedLocation;
      return;
    }

    marker.position = null;
    selectionInfoWindow?.close();
  }

  function shouldShowAnnouncementMarkers() {
    return currentView === "home";
  }

  function updateAnnouncementMarkersVisibility() {
    if (!map?.innerMap) {
      return;
    }

    const markerMap = shouldShowAnnouncementMarkers() ? map.innerMap : null;

    announcementMarkers.forEach((announcementMarker) => {
      announcementMarker.map = markerMap;
    });
  }

  function getAddressFromGeocodeResult(result) {
    return result?.indirizzoFormattato || "";
  }

  async function reverseGeocodeLocation(location) {
    const normalizedLocation = getPlainLocation(location);

    if (!normalizedLocation) {
      return "";
    }

    const params = new URLSearchParams({
      latitudine: String(normalizedLocation.lat),
      longitudine: String(normalizedLocation.lng),
    });
    const payload = await requestJson(`/api/maps/reverse-geocode?${params.toString()}`);
    return getAddressFromGeocodeResult(payload.risultati?.[0]);
  }

  async function geocodeAddress(address) { // gestione delle coordinate 
    const params = new URLSearchParams({ indirizzo: address });
    const payload = await requestJson(`/api/maps/geocode?${params.toString()}`);
    const result = payload.risultati?.[0];

    if (!result?.coordinate) {
      return null;
    }

    return {
      address: getAddressFromGeocodeResult(result),
      location: {
        lat: result.coordinate.latitudine,
        lng: result.coordinate.longitudine,
      },
    };
  }

  async function geocodeTrentinoAddress(address) {
    const normalizedAddress = typeof address === "string" ? address.trim() : "";

    if (!normalizedAddress) {
      return null;
    }

    const addressWithoutProvinceAbbreviation = normalizedAddress
      .replace(/,\s*tn\b/i, "")
      .trim();
    const searchAddress = /trentino|provincia autonoma di trento/i.test(addressWithoutProvinceAbbreviation)
      ? addressWithoutProvinceAbbreviation
      : `${addressWithoutProvinceAbbreviation}, Provincia autonoma di Trento, Italia`;
    const params = new URLSearchParams({
      area: "trentino",
      indirizzo: searchAddress,
    });
    const payload = await requestJson(`/api/maps/geocode?${params.toString()}`);
    const resultsInsideBounds = (payload.risultati || []).filter((candidate) =>
      candidate.coordinate && isInsideBounds({
        lat: candidate.coordinate.latitudine,
        lng: candidate.coordinate.longitudine,
      }),
    );
    const result =
      resultsInsideBounds.find((candidate) =>
        candidate.tipi?.some((type) => ["locality", "administrative_area_level_3"].includes(type)),
      ) || resultsInsideBounds[0];

    if (!result?.coordinate) {
      return null;
    }

    return {
      address: getAddressFromGeocodeResult(result),
      location: {
        lat: result.coordinate.latitudine,
        lng: result.coordinate.longitudine,
      },
      viewport: result.viewport,
    };
  }

  async function resolvePlaceSelection(place, typedText = "") {
    const searchText = [
      typedText,
      place?.name,
      place?.formatted_address,
    ].find((value) => typeof value === "string" && value.trim())?.trim() || "";
    const geocoded = await geocodeTrentinoAddress(searchText).catch(() => null);

    if (geocoded) {
      return geocoded;
    }

    if (typedText) {
      return null;
    }

    const location = getPlainLocation(place?.location || place?.geometry?.location);

    if (!location) {
      return null;
    }

    return {
      address: searchText || formatCoordinates(location),
      location,
      viewport: place?.viewport || place?.geometry?.viewport,
    };
  }

  async function searchMapLocation(place, typedText) {
    setStatus("Ricerca localita...", "ready");

    const resolvedPlace = await resolvePlaceSelection(place, typedText);

    if (!resolvedPlace || !isInsideBounds(resolvedPlace.location)) {
      setStatus("Luogo non trovato", "error");
      return;
    }

    mapSearchInput.value = resolvedPlace.address || typedText || "";
    moveMapToLocation(resolvedPlace.location, null, { exactZoom: 13, ignoreViewport: true });
    setStatus("Mappa aggiornata", "ready");
    selectionInfoWindow?.close();
  }

  function handleReportPlaceSelection(place, infowindow) {
    const location = place.geometry?.location;

    if (!location) {
      selectedPlace = null;
      selectedLocation = null;
      reportLatitude.value = "";
      reportLongitude.value = "";
      setStatus("Luogo non trovato", "error");
      updateSelectionMarkerVisibility();
      return;
    }

    if (!isInsideBounds(location)) {
      selectedPlace = null;
      selectedLocation = null;
      reportPosition.value = "Seleziona un luogo in Provincia di Trento";
      reportLatitude.value = "";
      reportLongitude.value = "";
      setStatus("Fuori area Trentino", "error");
      updateSelectionMarkerVisibility();
      return;
    }

    selectedPlace = place;
    setSelectedLocation(location, place.formatted_address || place.name || formatCoordinates(location));

    moveMapToLocation(location, place.geometry.viewport);

    marker.position = getPlainLocation(location);
    setStatus("Luogo selezionato", "ready");

    infowindow.setContent(
      `<strong>${place.name || "Luogo selezionato"}</strong><br><span>${reportPosition.value}</span>`,
    );
    infowindow.open(map.innerMap, marker);
  }

  async function setupReportPositionAutocomplete(config, infowindow) {
    if (!reportPosition || reportPositionAutocomplete || typeof google === "undefined") {
      return;
    }

    if (!google.maps.places && google.maps.importLibrary) {
      await google.maps.importLibrary("places");
    }

    if (!google.maps.places?.Autocomplete) {
      return;
    }

    const bounds = new google.maps.LatLngBounds(
      { lat: config.bounds.south, lng: config.bounds.west },
      { lat: config.bounds.north, lng: config.bounds.east },
    );

    reportPositionAutocomplete = new google.maps.places.Autocomplete(reportPosition, {
      bounds,
      componentRestrictions: { country: "it" },
      fields: ["formatted_address", "geometry", "name"],
      strictBounds: true,
    });

    reportPositionAutocomplete.addListener("place_changed", () => {
      if (!isReportLocationSelectionActive()) {
        return;
      }

      handleReportPlaceSelection(reportPositionAutocomplete.getPlace(), infowindow);
    });
  }

  async function setupMapSearchAutocomplete(config) {
    if (!mapSearchInput || mapSearchAutocomplete || typeof google === "undefined") {
      return;
    }

    if (!google.maps.places && google.maps.importLibrary) {
      await google.maps.importLibrary("places");
    }

    if (!google.maps.places?.Autocomplete) {
      return;
    }

    const bounds = new google.maps.LatLngBounds(
      { lat: config.bounds.south, lng: config.bounds.west },
      { lat: config.bounds.north, lng: config.bounds.east },
    );

    mapSearchAutocomplete = new google.maps.places.Autocomplete(mapSearchInput, {
      bounds,
      componentRestrictions: { country: "it" },
      fields: ["formatted_address", "geometry", "name", "types"],
      strictBounds: false,
    });

    mapSearchAutocomplete.addListener("place_changed", () => {
      searchMapLocation(mapSearchAutocomplete.getPlace(), mapSearchInput.value);
    });

    mapSearchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      searchMapLocation(null, mapSearchInput.value);
    });
  }

  function startOtpCooldown(button, defaultLabel, seconds = OTP_RESEND_COOLDOWN_SECONDS) {
    if (!button) {
      return;
    }

    const existingTimer = otpCooldownTimers.get(button);
    if (existingTimer) {
      window.clearInterval(existingTimer);
    }

    let remainingSeconds = seconds;
    button.disabled = true;
    button.textContent = `${defaultLabel} (${remainingSeconds}s)`;

    const timer = window.setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        window.clearInterval(timer);
        otpCooldownTimers.delete(button);
        button.disabled = false;
        button.textContent = defaultLabel;
        return;
      }

      button.textContent = `${defaultLabel} (${remainingSeconds}s)`;
    }, 1000);

    otpCooldownTimers.set(button, timer);
  }

  async function setupBirthPlaceAutocomplete() {
    if (!birthPlace || birthPlaceAutocomplete || typeof google === "undefined") {
      return;
    }

    if (!google.maps.places && google.maps.importLibrary) {
      await google.maps.importLibrary("places");
    }

    if (!google.maps.places?.Autocomplete) {
      return;
    }

    birthPlaceAutocomplete = new google.maps.places.Autocomplete(birthPlace, {
      componentRestrictions: { country: "it" },
      fields: ["address_components", "formatted_address", "name"],
      types: ["(cities)"],
    });

    birthPlaceAutocomplete.addListener("place_changed", () => {
      const place = birthPlaceAutocomplete.getPlace();
      const locality = place.address_components?.find((component) =>
        component.types.includes("locality"),
      );
      const administrativeArea = place.address_components?.find((component) =>
        component.types.includes("administrative_area_level_3"),
      );

      birthPlace.value =
        locality?.long_name ||
        administrativeArea?.long_name ||
        place.name ||
        place.formatted_address ||
        birthPlace.value;
    });
  }

  function createApiLoader(config) { // gestione dell'api 
    const loader = document.createElement("gmpx-api-loader");
    loader.setAttribute("key", config.apiKey);
    loader.setAttribute("solution-channel", "GMP_GE_mapsandplacesautocomplete_v2");
    loader.setAttribute("language", config.language);
    loader.setAttribute("region", config.region);
    document.body.prepend(loader);
  }

  function isInsideBounds(location) {
    if (!allowedBounds) {
      return true;
    }

    const normalizedLocation = getPlainLocation(location);

    if (!normalizedLocation) {
      return false;
    }

    return (
      normalizedLocation.lat >= allowedBounds.south &&
      normalizedLocation.lat <= allowedBounds.north &&
      normalizedLocation.lng >= allowedBounds.west &&
      normalizedLocation.lng <= allowedBounds.east
    );
  }

  function showView(viewName) {
    if (viewName === "report" && !getToken()) {
      window.alert("Devi effettuare l'accesso per creare un annuncio.");
      drawer.classList.remove("open");
      showAuth("login");
      return;
    }

    if (viewName === currentView) {
      drawer.classList.remove("open");
      return;
    }

    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });

    document.querySelector(`#${viewName}-screen`).classList.add("active");
    currentView = viewName;
    headerSectionTitle.textContent = viewTitles[viewName] || "Home";

    if (viewName === "report") {
      showReportStep("topic");
    } else if (viewName === "home") {
      moveMapPanel("home");
    }

    drawer.classList.remove("open");
  }

  function showReportStep(stepName) {
    const isTopicStep = stepName === "topic";

    currentReportStep = stepName;
    reportTopicStep.classList.toggle("active", isTopicStep);
    reportForm.classList.toggle("active", !isTopicStep);
    moveMapPanel(isTopicStep ? "home" : "report");
  }

  function moveMapPanel(target) {
    const host = target === "report" ? reportMapHost : homeMapHost;

    if (!host || !sharedMapPanel) {
      return;
    }

    if (sharedMapPanel.parentElement !== host) {
      host.append(sharedMapPanel);
    }

    sharedMapPanel.classList.toggle("in-report", target === "report");
    updateSelectionMarkerVisibility();
    updateAnnouncementMarkersVisibility();

    window.setTimeout(() => {
      if (map?.innerMap && typeof google !== "undefined") {
        google.maps.event.trigger(map.innerMap, "resize");
      }
    }, 0);
  }

  function getSelectedSeverity() { // gestione della gravità
    return severityValues[Number(severityRange.value) - 1] || "Media";
  }

  function updateSeveritySlider() { // gestione dello slider della gravità
    const value = Number(severityRange.value);
    const max = Number(severityRange.max);
    const progress = ((value - 1) / (max - 1)) * 100;
    const hue = 120 - progress * 1.2;
    const color = `hsl(${hue}, 78%, 38%)`;

    severityLabel.textContent = getSelectedSeverity();
    severityRange.style.setProperty("--severity-color", color);
    severityRange.style.setProperty("--severity-progress", `${progress}%`);
  }

  function buildAnnouncementPayload(form, gravita) { // creazione dell'annuncio 
    const data = formToObject(form);
    const latitudine = Number(data.latitudine);
    const longitudine = Number(data.longitudine);
    const hasCoordinates = Number.isFinite(latitudine) && Number.isFinite(longitudine);

    return {
      descrizione: data.descrizione || "",
      topic: data.topic,
      posizione: data.posizione,
      ...(hasCoordinates ? {
        coordinate: {
          latitudine,
          longitudine,
        },
      } : {}),
      ...(gravita ? { gravita } : {}),
      tempoVitaResiduo: 24,
      interazioneConsentita: "Utenti Registrati",
    };
  }

  async function publishAnnouncement(form, gravita) { // pubblicazione dell'annuncio 
    if (!reportLatitude.value || !reportLongitude.value) {
      const typedAddress = reportPosition.value.trim();
      const geocoded = typedAddress ? await geocodeAddress(typedAddress) : null;

      if (!geocoded || !isInsideBounds(geocoded.location)) {
        window.alert("Seleziona una posizione valida in Provincia di Trento.");
        return;
      }

      setSelectedLocation(geocoded.location, geocoded.address || typedAddress);
    }

    const payload = buildAnnouncementPayload(form, gravita);

    await requestJson("/api/announcements", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    form.reset();
    selectedPlace = null;
    selectedLocation = null;
    updateSelectionMarkerVisibility();
    reportCategory.value = "";
    document.querySelectorAll("[data-category]").forEach((item) => item.classList.remove("selected"));
    showReportStep("topic");
    await loadActiveAnnouncements();
    await aggiornaListaTestualeAnnunci();
    window.alert("Annuncio pubblicato.");
    showView("home");
  }

  function showAuth(panelName) { // gestione pagina di autenticazione
    showView("auth");
    setAuthMessage("");

    document.querySelectorAll(".auth-panel").forEach((panel) => {
      panel.classList.remove("active");
    });
    document.querySelectorAll(".auth-tabs button").forEach((button) => {
      button.classList.remove("active");
    });

    document.querySelector(`#${panelName}-form`).classList.add("active");
    document.querySelector(`#${panelName}-tab`)?.classList.add("active");
    headerSectionTitle.textContent = authTitles[panelName] || viewTitles.auth;
  }

  function initPasswordToggles() { // gestione della password
    document.querySelectorAll(".password-toggle").forEach((button) => {
      const field = button.closest(".password-field");
      const input = field ? field.querySelector("input") : null;

      if (!input) {
        return;
      }

      button.addEventListener("click", () => {
        const shouldShowPassword = input.type === "password";

        input.type = shouldShowPassword ? "text" : "password";
        button.setAttribute("aria-pressed", String(shouldShowPassword));
        button.setAttribute("aria-label", shouldShowPassword ? "Nascondi password" : "Mostra password");
        input.focus();
      });
    });
  }

  function getPasswordStrength(password) { // gestione della forza della password 
    const checks = [
      password.length >= 10,
      /[0-9]/.test(password),
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/.test(password),
    ];
    const score = checks.filter(Boolean).length;

    if (!password) {
      return {
        isValid: false,
        state: "",
        label: "Inserisci una password",
      };
    }

    if (score <= 2) {
      return {
        isValid: false,
        state: "is-weak",
        label: "Password debole",
      };
    }

    if (score <= 4) {
      return {
        isValid: false,
        state: score === 3 ? "is-fair" : "is-good",
        label: score === 3 ? "Password media" : "Quasi forte",
      };
    }

    return {
      isValid: true,
      state: "is-strong",
      label: "Password forte",
    };
  }

  function updatePasswordStrength(input, indicator) { // gestione della forza della password (etichetta)
    const strength = getPasswordStrength(input.value);
    const text = indicator.querySelector(".strength-text");

    indicator.classList.remove("is-weak", "is-fair", "is-good", "is-strong");

    if (strength.state) {
      indicator.classList.add(strength.state);
    }

    text.textContent = strength.label;
    return strength;
  }

  function initPasswordStrengthIndicator() { // gestione della forza della password 
    document.querySelectorAll("[data-password-strength]").forEach((indicator) => {
      const label = indicator.closest("label");
      const passwordInput = label ? label.querySelector('input[name="password"]') : null;

      if (!passwordInput) {
        return;
      }

      updatePasswordStrength(passwordInput, indicator);
      passwordInput.addEventListener("input", () => updatePasswordStrength(passwordInput, indicator));
    });
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...(options?.headers || {}),
      },
      ...options,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "Operazione non riuscita");
    }

    return payload;
  }

  function formToObject(form) {
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
      if (typeof value === "string" && value.trim() !== "") {
        data[key] = value.trim();
      }
    });

    form.querySelectorAll("input[type='checkbox']").forEach((input) => {
      data[input.name] = input.checked;
    });

    return data;
  }

  function validatePhoneFields(form) { // gestione dei campi inerenti al telefono
    const countryInput = form.querySelector('select[name="nazioneTelefono"]');
    const phoneInput = form.querySelector('input[name="numeroTelefono"]');

    if (!countryInput || !phoneInput) {
      return true;
    }

    const countryCode = countryInput.value;
    const phoneValue = phoneInput.value.trim();

    countryInput.setCustomValidity("");
    phoneInput.setCustomValidity("");

    if (!countryCode && !phoneValue) {
      return true;
    }

    if (!countryCode) {
      countryInput.setCustomValidity("Seleziona la nazione del prefisso.");
      countryInput.reportValidity();
      return false;
    }

    if (!/^\+?[\d\s().-]{4,20}$/.test(phoneValue)) {
      phoneInput.setCustomValidity("Inserisci un numero di telefono valido.");
      phoneInput.reportValidity();
      return false;
    }

    return true;
  }

  async function loadPhoneCountries() { // gestione del paese di provenienza per la gestione del numero di telefono
    const select = document.querySelector('select[name="nazioneTelefono"]');

    if (!select) {
      return;
    }

    try {
      const payload = await requestJson("/api/auth/phone-countries?locale=it");
      const countries = payload.nazioni || [];

      select.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Nazione";
      select.append(placeholder);

      countries.forEach((country) => {
        const option = document.createElement("option");
        option.value = country.codice;
        option.dataset.prefix = country.prefisso;
        option.textContent = `${country.bandiera} ${country.nome} ${country.prefisso}`;
        select.append(option);
      });

      select.value = "";
    } catch (_error) {
      select.innerHTML = '<option value="">Nazioni non disponibili</option>';
    }
  }

  function toggleRegisterVerificationStep(enabled) { // gestione della registrazione dell'utente
    const registerForm = document.querySelector("#register-form");
    const row = document.querySelector("#email-verification-row");
    const input = row ? row.querySelector("input") : null;
    const submit = registerForm ? registerForm.querySelector('button[type="submit"]') : null;

    if (!row || !input || !submit) {
      return;
    }

    row.hidden = !enabled;
    input.required = enabled;
    submit.textContent = enabled ? "Crea account" : "Salva";
    if (enabled) {
      input.focus();
    } else {
      input.value = "";
      pendingRegistrationPayload = null;
    }
  }

  async function requestRegisterEmailVerification() { // gestione della verifica dell'email 
    const emailInput = document.querySelector("#register-email");
    const sendButton = document.querySelector("#send-email-verification");
    const email = emailInput?.value.trim();

    if (!emailInput || !email) {
      setAuthMessage("Inserisci prima l'email da verificare", "error");
      emailInput?.focus();
      return;
    }

    if (!emailInput.checkValidity()) {
      setAuthMessage("Inserisci un'email valida", "error");
      emailInput.focus();
      return;
    }

    toggleRegisterVerificationStep(true);
    if (sendButton) {
      sendButton.disabled = true;
      sendButton.textContent = "Invio...";
    }
    setAuthMessage("Invio codice di verifica...");

    try {
      const payload = await requestJson("/api/auth/email-verification/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      pendingRegistrationPayload = null;
      startOtpCooldown(sendButton, "Verifica");
      setAuthMessage(payload.message || "Codice inviato", "ok");
    } catch (error) {
      toggleRegisterVerificationStep(false);
      setAuthMessage(error.message, "error");
    } finally {
      if (sendButton && !otpCooldownTimers.has(sendButton)) {
        sendButton.disabled = false;
        sendButton.textContent = "Verifica";
      }
    }
  }

  function updateAuthState(user) { // gestione dell'utente 
    if (!user) {
      drawerUser.textContent = "Ciao, visitatore";
      headerAuthButton.textContent = "Accedi";
      headerAuthButton.classList.remove("is-logged-in");
      headerAuthButton.setAttribute("aria-label", "Accedi");
      return;
    }

    const profile = user.profilo || {};
    const fullName = [profile.nome, profile.cognome].filter(Boolean).join(" ");
    drawerUser.textContent = `Ciao, ${profile.nomeUtentePubblico || fullName || profile.denominazione || user.email}`;
    headerAuthButton.textContent = "Esci";
    headerAuthButton.classList.add("is-logged-in");
    headerAuthButton.setAttribute("aria-label", "Esci");
  }

  async function refreshCurrentUser() {
    if (!getToken()) {
      updateAuthState(null);
      return;
    }

    try {
      const payload = await requestJson("/api/auth/me");
      updateAuthState(payload.utente);
    } catch (_error) {
      setToken(null);
      updateAuthState(null);
    }
  }

  function updatePublicEntityUniqueCodeRequirement() { // gestione dell'ente pubblico
    const select = document.querySelector("#public-entity-select");
    const row = document.querySelector("#entity-unique-code-row");
    const input = row ? row.querySelector("input") : null;
    const selectedEntity = publicEntities.find((entity) => entity.id === select.value);
    const isRequired = Boolean(selectedEntity?.richiedeCodiceUnivoco);

    if (!input || !row) {
      return;
    }

    input.required = isRequired;
    row.hidden = !selectedEntity || !isRequired;

    if (!isRequired) {
      input.value = "";
    }
  }

  async function loadPublicEntities() {
    const select = document.querySelector("#public-entity-select");

    if (!select) {
      return;
    }

    try {
      const payload = await requestJson("/api/auth/public-entities");
      publicEntities = payload.enti || [];

      select.innerHTML = "";

      if (publicEntities.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Nessun ente disponibile";
        select.append(option);
        select.disabled = true;
        updatePublicEntityUniqueCodeRequirement();
        return;
      }

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Seleziona ente";
      select.append(placeholder);

      publicEntities.forEach((entity) => {
        const option = document.createElement("option");
        option.value = entity.id;
        option.textContent = entity.denominazione || "Ente senza denominazione";
        select.append(option);
      });

      select.disabled = false;
      updatePublicEntityUniqueCodeRequirement();
    } catch (error) {
      select.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Enti non disponibili";
      select.append(option);
      select.disabled = true;
      setAuthMessage(error.message, "error");
    }
  }

  function showLoginMode(mode) { // gestione del login
    document.querySelectorAll("[data-login-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.loginMode === mode);
    });

    document.querySelectorAll("[data-login-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.loginPanel === mode);
    });

    setAuthMessage("");

    if (mode === "entity") {
      loadPublicEntities();
    }
  }

  function bindNavigation() {
    document.querySelector("#menu-toggle").addEventListener("click", () => drawer.classList.add("open"));
    document.querySelector("#menu-close").addEventListener("click", () => drawer.classList.remove("open"));
    headerAuthButton.addEventListener("click", () => {
      if (getToken()) {
        logout();
        return;
      }

      showAuth("login");
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.view));
    });

    document.querySelectorAll("[data-open-auth]").forEach((button) => {
      button.addEventListener("click", () => showAuth(button.dataset.openAuth));
    });

    document.querySelectorAll("[data-auth-panel]").forEach((button) => {
      button.addEventListener("click", () => showAuth(button.dataset.authPanel));
    });

    document.querySelectorAll("[data-login-mode]").forEach((button) => {
      button.addEventListener("click", () => showLoginMode(button.dataset.loginMode));
    });
  }

  async function logout() {
    try {
      await requestJson("/api/auth/logout", { method: "POST" });
    } catch (_error) {
      // Anche se il token e' gia' scaduto, lato client va comunque rimosso.
    }

    setToken(null);
    updateAuthState(null);
    drawer.classList.remove("open");
    showView("home");
  }

  function bindForms() {
    document.querySelector("#public-entity-select").addEventListener("change", updatePublicEntityUniqueCodeRequirement);
    document.querySelector("#send-email-verification").addEventListener("click", requestRegisterEmailVerification);

    document.querySelector("#register-email").addEventListener("input", () => {
      toggleRegisterVerificationStep(false);
      setAuthMessage("");
    });

    reportPosition.addEventListener("input", () => {
      selectedPlace = null;
      selectedLocation = null;
      reportLatitude.value = "";
      reportLongitude.value = "";
    });

    document.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-category]").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        reportCategory.value = button.dataset.category;
        showReportStep("details");
      });
    });

    document.querySelector("#report-topics-back-home").addEventListener("click", () => showView("home"));

    document.querySelector("#report-back-to-topics").addEventListener("click", () => showReportStep("topic"));

    severityRange.addEventListener("input", updateSeveritySlider);
    updateSeveritySlider();

    document.querySelector("#confirm-severity").addEventListener("click", async () => {
      if (!pendingReportForm) {
        return;
      }

      try {
        await publishAnnouncement(pendingReportForm, getSelectedSeverity());
        pendingReportForm = null;
        severityDialog.close();
      } catch (error) {
        window.alert(error.message);
      }
    });

    severityDialog.addEventListener("close", () => {
      pendingReportForm = null;
    });

    document.querySelector("#report-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const topic = reportCategory.value;

      if (!topic) {
        showReportStep("topic");
        return;
      }

      if (SEVERITY_TOPICS.includes(topic)) {
        pendingReportForm = event.currentTarget;
        severityRange.value = "2";
        updateSeveritySlider();
        severityDialog.showModal();
        return;
      }

      try {
        await publishAnnouncement(event.currentTarget);
      } catch (error) {
        window.alert(error.message);
      }
    });

    document.querySelector("#user-login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      setAuthMessage("Accesso in corso...");

      try {
        const payload = await requestJson("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(formToObject(form)),
        });

        setToken(payload.tokenAccesso);
        updateAuthState(payload.utente);
        setAuthMessage("Accesso effettuato", "ok");
        showView("home");
      } catch (error) {
        setAuthMessage(error.message, "error");
      }
    });

    document.querySelector("#entity-login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      setAuthMessage("Accesso in corso...");

      try {
        const payload = await requestJson("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(formToObject(form)),
        });

        setToken(payload.tokenAccesso);
        updateAuthState(payload.utente);
        setAuthMessage("Accesso effettuato", "ok");
        showView("home");
      } catch (error) {
        setAuthMessage(error.message, "error");
      }
    });

    document.querySelector("#register-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const passwordInput = form.querySelector('input[name="password"]');
      const indicator = form.querySelector("[data-password-strength]");
      const strength = updatePasswordStrength(passwordInput, indicator);
      const formPayload = formToObject(form);

      if (!validatePhoneFields(event.currentTarget)) {
        return;
      }

      if (!strength.isValid) {
        setAuthMessage("La password deve avere almeno 10 caratteri, maiuscole, minuscole, numeri e simboli.", "error");
        passwordInput.focus();
        return;
      }

      if (!formPayload.codiceVerificaEmail) {
        setAuthMessage("Verifica l'email e inserisci il codice ricevuto prima di creare l'account", "error");
        document.querySelector("#send-email-verification").focus();
        return;
      }

      const payload = formPayload;

      setAuthMessage("Creazione account...");

      try {
        const responsePayload = await requestJson("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setToken(responsePayload.tokenAccesso);
        updateAuthState(responsePayload.utente);
        toggleRegisterVerificationStep(false);
        form.reset();
        setAuthMessage("Registrazione completata", "ok");
        showView("home");
      } catch (error) {
        setAuthMessage(error.message, "error");
      }
    });

    document.querySelector("#forgot-password-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submitButton = form.querySelector('button[type="submit"]');
      setAuthMessage("Invio codice di reset...");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Invio...";
      }

      try {
        const payload = formToObject(form);
        const responsePayload = await requestJson("/api/auth/password-reset/request", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const resetForm = document.querySelector("#reset-password-form");
        resetForm.querySelector('input[name="email"]').value = payload.email;
        startOtpCooldown(submitButton, "Invia codice");
        showAuth("reset-password");
        setAuthMessage(responsePayload.message || "Codice inviato", "ok");
      } catch (error) {
        setAuthMessage(error.message, "error");
      } finally {
        if (submitButton && !otpCooldownTimers.has(submitButton)) {
          submitButton.disabled = false;
          submitButton.textContent = "Invia codice";
        }
      }
    });

    document.querySelector("#reset-password-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const passwordInput = form.querySelector('input[name="password"]');
      const indicator = form.querySelector("[data-password-strength]");
      const strength = updatePasswordStrength(passwordInput, indicator);

      if (!strength.isValid) {
        setAuthMessage("La password deve avere almeno 10 caratteri, maiuscole, minuscole, numeri e simboli.", "error");
        passwordInput.focus();
        return;
      }

      setAuthMessage("Aggiornamento password...");

      try {
        const responsePayload = await requestJson("/api/auth/password-reset/confirm", {
          method: "POST",
          body: JSON.stringify(formToObject(form)),
        });
        form.reset();
        showAuth("login");
        setAuthMessage(responsePayload.message || "Password aggiornata", "ok");
      } catch (error) {
        setAuthMessage(error.message, "error");
      }
    });
  }

  async function initMap() { // gestione della mappa 
    try {
      const config = await requestJson("/api/maps/client-config");
      allowedBounds = config.bounds;
      createApiLoader(config);

      map.setAttribute("center", `${config.center.latitudine},${config.center.longitudine}`);
      map.setAttribute("zoom", String(config.zoom));
      map.setAttribute("map-id", config.mapId);

      await customElements.whenDefined("gmp-map");
      await customElements.whenDefined("gmp-advanced-marker");

      map.innerMap.setOptions({
        fullscreenControl: false,
        keyboardShortcuts: false,
        mapTypeControl: false,
        streetViewControl: false,
        clickableIcons: false,
        restriction: {
          latLngBounds: config.bounds,
          strictBounds: false,
        },
      });

      map.addEventListener("pointerdown", () => {
        const activeElement = document.activeElement;

        if (activeElement && activeElement !== document.body && typeof activeElement.blur === "function") {
          activeElement.blur();
        }
      });

      map.innerMap.fitBounds(config.bounds);

      const infowindow = new google.maps.InfoWindow();
      selectionInfoWindow = infowindow;
      await setupMapSearchAutocomplete(config);
      await setupReportPositionAutocomplete(config, infowindow);
      await setupBirthPlaceAutocomplete();

      map.innerMap.addListener("click", async (event) => {
        const location = event.latLng;

        if (!location) {
          return;
        }

        if (!isReportLocationSelectionActive()) {
          selectionInfoWindow?.close();
          return;
        }

        if (!isInsideBounds(location)) {
          selectedPlace = null;
          selectedLocation = null;
          reportPosition.value = "Seleziona un luogo in Provincia di Trento";
          reportLatitude.value = "";
          reportLongitude.value = "";
          setStatus("Fuori area Trentino", "error");
          infowindow.close();
          updateSelectionMarkerVisibility();
          return;
        }

        marker.position = location;
        setStatus("Ricerca indirizzo...", "ready");

        try {
          const address = await reverseGeocodeLocation(location);
          selectedPlace = { location };
          setSelectedLocation(location, address || formatCoordinates(location));
          setStatus("Luogo selezionato", "ready");

          infowindow.setContent(
            `<strong>Luogo selezionato</strong><br><span>${reportPosition.value}</span>`,
          );
          infowindow.open(map.innerMap, marker);
        } catch (error) {
          setSelectedLocation(location, formatCoordinates(location));
          setStatus(error.message, "error");
        }
      });

      await loadActiveAnnouncements();
      setStatus("Mappa pronta", "ready");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function clearAnnouncementMarkers() { // elimina il marker
    announcementMarkers.forEach((announcementMarker) => {
      announcementMarker.map = null;
    });
    announcementMarkers = [];
  }

  function createAnnouncementMarker(announcement) { // crea il marker
    const position = {
      lat: announcement.coordinate.latitudine,
      lng: announcement.coordinate.longitudine,
    };
    const color = TOPIC_MARKER_COLORS[announcement.topic] || "#141414";
    const pin = new google.maps.marker.PinElement({
      background: color,
      borderColor: "#141414",
      glyphColor: "#ffffff",
      glyph: announcement.topic?.charAt(0) || "",
    });
    const title = `${announcement.topic}${announcement.posizione ? ` - ${announcement.posizione}` : ""}`;
    const markerElement = new google.maps.marker.AdvancedMarkerElement({
      map: shouldShowAnnouncementMarkers() ? map.innerMap : null,
      position,
      title,
      content: pin.element,
    });
    const content = [
      `<strong>${announcement.topic}</strong>`,
      announcement.posizione ? `<span>${announcement.posizione}</span>` : "",
      announcement.descrizione ? `<span>${announcement.descrizione}</span>` : "",
    ].filter(Boolean).join("<br>");
    const infoWindow = new google.maps.InfoWindow({ content });

    markerElement.addListener("click", () => {
      infoWindow.open(map.innerMap, markerElement);
    });

    return markerElement;
  }

  async function loadActiveAnnouncements() {
    if (!map?.innerMap || typeof google === "undefined" || !google.maps?.marker?.AdvancedMarkerElement) {
      return;
    }

    const payload = await requestJson("/api/announcements/active");
    clearAnnouncementMarkers();

    announcementMarkers = (payload.data || [])
      .filter((announcement) => announcement.coordinate?.latitudine && announcement.coordinate?.longitudine)
      .map(createAnnouncementMarker);
    updateAnnouncementMarkersVisibility();
  }

  // inserimento degli annunci nella loro sezione 
  function sezioneAnnunci(announcement) {
    const container = document.querySelector('.lista-annunci');
    if (!container) return;

    const content = [
      `<strong>${announcement.topic}</strong>`,
      announcement.nomeAutore ? `<span>${announcement.nomeAutore}</span>` : "",
      announcement.posizione ? `<span>${announcement.posizione}</span>` : "",
      announcement.gravita ? `<span>${announcement.gravita}</span>` : "",
      announcement.descrizione ? `<span>${announcement.descrizione}</span>` : "",
    ].filter(Boolean).join("<br>");

    const div = document.createElement('div');
    div.className = 'annuncio-news';

    const color = (typeof TOPIC_MARKER_COLORS !== 'undefined') ? TOPIC_MARKER_COLORS[announcement.topic] : "#141414";
    div.style.borderLeft = `5px solid ${color}`;
    div.innerHTML = content;

    container.appendChild(div);
  }

  // 2. Questa funzione si occupa solo di SCARICARE i dati e pulire la lista
  async function aggiornaListaTestualeAnnunci() {
    const container = document.querySelector('.lista-annunci');
    if (!container) return;

    try {
      const response = await fetch('/api/announcements/active');
      if (!response.ok) throw new Error(`Errore server: ${response.status}`);

      const payload = await response.json();
      const annunciArray = payload.data || [];

      container.innerHTML = ''; // Svuota la lista prima di riempirla

      if (annunciArray.length === 0) {
        container.innerHTML = '<p>Nessun annuncio attivo al momento.</p>';
        return;
      }

      // CHIAMATA ALLA FUNZIONE SOPRA
      annunciArray.forEach(announcement => sezioneAnnunci(announcement));

    } catch (error) {
      console.error("Errore:", error);
      container.innerHTML = '<p style="color: red;">Impossibile caricare le notizie.</p>';
    }
  }


  document.addEventListener("DOMContentLoaded", () => {
    bindNavigation();
    bindForms();
    initPasswordToggles();
    initPasswordStrengthIndicator();
    loadPhoneCountries();
    refreshCurrentUser();
    initMap();
    aggiornaListaTestualeAnnunci();
  });
})();
