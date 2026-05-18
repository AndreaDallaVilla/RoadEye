(function () {
  function createApiClient(config) {
    const apiBaseUrl = config.apiBaseUrl;
    const tokenKey = config.tokenKey;
    const userKey = config.userKey;

    function getToken() {
      return localStorage.getItem(tokenKey);
    }

    function setToken(token) {
      if (token) {
        localStorage.setItem(tokenKey, token);
      } else {
        localStorage.removeItem(tokenKey);
      }
    }

    function getStoredUser() {
      try {
        return JSON.parse(localStorage.getItem(userKey));
      } catch (_error) {
        localStorage.removeItem(userKey);
        return null;
      }
    }

    function setStoredUser(user) {
      if (user) {
        localStorage.setItem(userKey, JSON.stringify(user));
        return;
      }

      localStorage.removeItem(userKey);
    }

    function getVersionedApiUrl(url) {
      return typeof url === "string" && url.startsWith("/api/")
        ? `${apiBaseUrl}${url.slice(4)}`
        : url;
    }

    async function requestJson(url, options) {
      const response = await fetch(getVersionedApiUrl(url), {
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          ...(options?.headers || {}),
        },
        ...options,
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }

      if (!response.ok) {
        const message = payload?.message || "Errore di comunicazione con il server";
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return payload;
    }

    return {
      getStoredUser,
      getToken,
      requestJson,
      setStoredUser,
      setToken,
    };
  }

  window.RoadEyeApi = {
    createApiClient,
  };
})();
