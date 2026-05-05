(function () {
  const TOKEN_KEY = "roadeye.token";

  const map = document.querySelector("gmp-map");
  const marker = document.querySelector("gmp-advanced-marker");
  const placePicker = document.querySelector("gmpx-place-picker");
  const status = document.querySelector("#maps-status");
  const drawer = document.querySelector("#drawer");
  const drawerUser = document.querySelector("#drawer-user");
  const headerAuthButton = document.querySelector("#header-auth-button");
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
  let currentView = "home";
  let publicEntities = [];

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

  function getPasswordStrength(password) {
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

  function updatePasswordStrength(input, indicator) {
    const strength = getPasswordStrength(input.value);
    const text = indicator.querySelector(".strength-text");

    indicator.classList.remove("is-weak", "is-fair", "is-good", "is-strong");

    if (strength.state) {
      indicator.classList.add(strength.state);
    }

    text.textContent = strength.label;
    return strength;
  }

  function initPasswordStrengthIndicator() {
    const registerForm = document.querySelector("#register-form");
    const passwordInput = registerForm.querySelector('input[name="password"]');
    const indicator = registerForm.querySelector("[data-password-strength]");

    if (!passwordInput || !indicator) {
      return;
    }

    updatePasswordStrength(passwordInput, indicator);
    passwordInput.addEventListener("input", () => updatePasswordStrength(passwordInput, indicator));
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

  function updatePublicEntityUniqueCodeRequirement() {
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

  function showLoginMode(mode) {
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

    document.querySelector("#user-login-form").addEventListener("submit", async (event) => {
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

    document.querySelector("#entity-login-form").addEventListener("submit", async (event) => {
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
      const passwordInput = event.currentTarget.querySelector('input[name="password"]');
      const indicator = event.currentTarget.querySelector("[data-password-strength]");
      const strength = updatePasswordStrength(passwordInput, indicator);

      if (!strength.isValid) {
        setAuthMessage("La password deve avere almeno 10 caratteri, maiuscole, minuscole, numeri e simboli.", "error");
        passwordInput.focus();
        return;
      }

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
        keyboardShortcuts: false,
        mapTypeControl: false,
        streetViewControl: false,
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

      map.innerMap.addListener("click", (event) => {
        const location = event.latLng;

        if (!location) {
          return;
        }

        if (!isInsideBounds(location)) {
          selectedPlace = null;
          reportPosition.value = "Seleziona un luogo in Provincia di Trento";
          setStatus("Fuori area Trentino", "error");
          infowindow.close();
          marker.position = null;
          return;
        }

        selectedPlace = { location };
        reportPosition.value = formatCoordinates(location);
        marker.position = location;
        setStatus("Luogo selezionato", "ready");

        infowindow.setContent(
          `<strong>Luogo selezionato</strong><br><span>${formatCoordinates(location)}</span>`,
        );
        infowindow.open(map.innerMap, marker);
      });

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
    initPasswordStrengthIndicator();
    refreshCurrentUser();
    initMap();
  });
})();
