(function () {
  function setStatusMessage(element, message, state) {
    if (!element) {
      return;
    }

    const shouldShow = state === "error" && message;
    element.textContent = shouldShow ? message : "";
    element.hidden = !shouldShow;
    element.classList.remove("ready", "error");

    if (shouldShow) {
      element.classList.add(state);
    }
  }

  function setFormMessage(element, message, state) {
    if (!element) {
      return;
    }

    element.textContent = message || "";
    element.classList.remove("ok", "error");

    if (state) {
      element.classList.add(state);
    }
  }

  function createToastController(appToast) {
    let appToastTimer = null;

    function showAppToast(message, duration = 2000) {
      if (!appToast) {
        return Promise.resolve();
      }

      if (appToastTimer) {
        window.clearTimeout(appToastTimer);
      }

      appToast.replaceChildren();
      const dialog = document.createElement("div");
      const text = document.createElement("p");
      dialog.className = "toast-dialog";
      text.textContent = message;
      dialog.append(text);
      appToast.append(dialog);
      appToast.hidden = false;
      appToast.classList.add("visible");

      return new Promise((resolve) => {
        appToastTimer = window.setTimeout(() => {
          appToast.classList.remove("visible");
          appToast.hidden = true;
          appToastTimer = null;
          resolve();
        }, duration);
      });
    }

    return {
      showAppToast,
    };
  }

  window.RoadEyeUi = {
    createToastController,
    setFormMessage,
    setStatusMessage,
  };
})();
