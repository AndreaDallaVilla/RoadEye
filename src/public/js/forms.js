(function () {
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

  function validatePhoneFields(form) {
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

  window.RoadEyeForms = {
    formToObject,
    initPasswordStrengthIndicator,
    initPasswordToggles,
    updatePasswordStrength,
    validatePhoneFields,
  };
})();
