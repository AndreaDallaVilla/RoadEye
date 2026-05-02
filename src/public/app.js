(function () {
  const TOKEN_KEY = "roadeye.token";

  const map = document.querySelector("gmp-map");
  const marker = document.querySelector("gmp-advanced-marker");
  const placePicker = document.querySelector("gmpx-place-picker");
  const status = document.querySelector("#maps-status");
  const drawer = document.querySelector("#drawer");
  const drawerUser = document.querySelector("#drawer-user");
  const logoutButton = document.querySelector("#logout-button");
  const authMessage = document.querySelector("#auth-message");
  const reportPosition = document.querySelector("#report-position");
  const reportCategory = document.querySelector("#report-category");
  const headerSectionTitle = document.querySelector("#header-section-title");

  const viewTitles = {
    home: "Home",
    report: "Nuova segnalazione",
    auth: "Accedi",
  };

  const authTitles = {
    login: "Accedi",
    register: "Registrati",
  };

  let selectedPlace = null;
  let allowedBounds = null;

  function setStatus(message, state) {
    status.textContent = message;
    status.classList.remove("ready", "error");

    if (state) {
      status.classList.add(state);
    }
  }

  function setAuthMessage(message, state) {
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
    const lat = typeof location.lat === "function" ? location.lat() : location.lat;
    const lng = typeof location.lng === "function" ? location.lng() : location.lng;

    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }

  function createApiLoader(config) {
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

    const lat = typeof location.lat === "function" ? location.lat() : location.lat;
    const lng = typeof location.lng === "function" ? location.lng() : location.lng;

    return (
      lat >= allowedBounds.south &&
      lat <= allowedBounds.north &&
      lng >= allowedBounds.west &&
      lng <= allowedBounds.east
    );
  }

  function showView(viewName) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });

    document.querySelector(`#${viewName}-screen`).classList.add("active");
    headerSectionTitle.textContent = viewTitles[viewName] || "Home";
    drawer.classList.remove("open");
  }

  function showAuth(panelName) {
    showView("auth");
    setAuthMessage("");

    document.querySelectorAll(".auth-panel").forEach((panel) => {
      panel.classList.remove("active");
    });
    document.querySelectorAll(".auth-tabs button").forEach((button) => {
      button.classList.remove("active");
    });

    document.querySelector(`#${panelName}-form`).classList.add("active");
    document.querySelector(`#${panelName}-tab`).classList.add("active");
    headerSectionTitle.textContent = authTitles[panelName] || viewTitles.auth;
  }

  function initPasswordToggles() {
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

  function updateAuthState(user) {
    if (!user) {
      drawerUser.textContent = "Ciao, visitatore";
      logoutButton.hidden = true;
      return;
    }

    const profile = user.profilo || {};
    drawerUser.textContent = `Ciao, ${profile.nomeUtentePubblico || profile.nome || profile.denominazione || user.email}`;
    logoutButton.hidden = false;
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

  function bindNavigation() {
    document.querySelector("#menu-toggle").addEventListener("click", () => drawer.classList.add("open"));
    document.querySelector("#home-menu-button").addEventListener("click", () => drawer.classList.add("open"));
    document.querySelector("#menu-close").addEventListener("click", () => drawer.classList.remove("open"));

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.view));
    });

    document.querySelectorAll("[data-open-auth]").forEach((button) => {
      button.addEventListener("click", () => showAuth(button.dataset.openAuth));
    });

    document.querySelectorAll("[data-auth-panel]").forEach((button) => {
      button.addEventListener("click", () => showAuth(button.dataset.authPanel));
    });
  }

  function bindForms() {
    document.querySelector("#account-type").addEventListener("change", (event) => {
      const isEntity = event.target.value === "Ente Pubblico";
      document.querySelector(".registered-fields").hidden = isEntity;
      document.querySelector(".entity-fields").hidden = !isEntity;

      document.querySelectorAll("[data-registered-required]").forEach((input) => {
        input.required = !isEntity;
      });
      document.querySelectorAll("[data-entity-required]").forEach((input) => {
        input.required = isEntity;
      });
    });

    document.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-category]").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        reportCategory.value = button.dataset.category;
      });
    });

    document.querySelector("#report-form").addEventListener("submit", (event) => {
      event.preventDefault();
      window.alert("Segnalazione pronta. Il salvataggio verra' collegato al modulo report.");
    });

    document.querySelector("#login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      setAuthMessage("Accesso in corso...");

      try {
        const payload = await requestJson("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(formToObject(event.currentTarget)),
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
      setAuthMessage("Registrazione in corso...");

      try {
        const payload = await requestJson("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(formToObject(event.currentTarget)),
        });

        setToken(payload.tokenAccesso);
        updateAuthState(payload.utente);
        setAuthMessage("Registrazione completata", "ok");
        showView("home");
      } catch (error) {
        setAuthMessage(error.message, "error");
      }
    });

    logoutButton.addEventListener("click", async () => {
      try {
        await requestJson("/api/auth/logout", { method: "POST" });
      } catch (_error) {
        // Anche se il token e' gia' scaduto, lato client va comunque rimosso.
      }

      setToken(null);
      updateAuthState(null);
      drawer.classList.remove("open");
    });
  }

  async function initMap() {
    try {
      const config = await requestJson("/api/maps/client-config");
      allowedBounds = config.bounds;
      createApiLoader(config);

      map.setAttribute("center", `${config.center.latitudine},${config.center.longitudine}`);
      map.setAttribute("zoom", String(config.zoom));
      map.setAttribute("map-id", config.mapId);

      await customElements.whenDefined("gmp-map");
      await customElements.whenDefined("gmpx-place-picker");
      await customElements.whenDefined("gmp-advanced-marker");

      map.innerMap.setOptions({
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        restriction: {
          latLngBounds: config.bounds,
          strictBounds: false,
        },
      });

      map.innerMap.fitBounds(config.bounds);

      const infowindow = new google.maps.InfoWindow();

      placePicker.addEventListener("gmpx-placechange", () => {
        const place = placePicker.value;

        if (!place.location) {
          selectedPlace = null;
          reportPosition.value = "Luogo non trovato";
          setStatus("Luogo non trovato", "error");
          infowindow.close();
          marker.position = null;
          return;
        }

        if (!isInsideBounds(place.location)) {
          selectedPlace = null;
          reportPosition.value = "Seleziona un luogo in Provincia di Trento";
          setStatus("Fuori area Trentino", "error");
          infowindow.close();
          marker.position = null;
          map.innerMap.fitBounds(config.bounds);
          return;
        }

        selectedPlace = place;
        reportPosition.value = place.formattedAddress || place.displayName || formatCoordinates(place.location);

        if (place.viewport) {
          map.innerMap.fitBounds(place.viewport);
        } else {
          map.center = place.location;
          map.zoom = 17;
        }

        marker.position = place.location;
        setStatus("Luogo selezionato", "ready");

        infowindow.setContent(
          `<strong>${place.displayName || "Luogo selezionato"}</strong><br><span>${place.formattedAddress || ""}</span>`,
        );
        infowindow.open(map.innerMap, marker);
      });

      setStatus("Mappa pronta", "ready");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindNavigation();
    bindForms();
    initPasswordToggles();
    refreshCurrentUser();
    initMap();
  });
})();
