(function () {
  function getPlainLocation(location) {
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

  function formatCoordinates(location) {
    const normalizedLocation = getPlainLocation(location);

    if (!normalizedLocation) {
      return "";
    }

    return `${normalizedLocation.lat.toFixed(5)}, ${normalizedLocation.lng.toFixed(5)}`;
  }

  function isCodiceFiscale(value) {
    return /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i.test(String(value || "").trim());
  }

  function getPublicAuthorName(announcement) {
    const authorName = String(announcement?.nomeAutore || "").trim();

    if (!authorName || isCodiceFiscale(authorName)) {
      return "Utente eliminato";
    }

    return authorName;
  }

  function calculateDistanceMeters(firstLocation, secondLocation) {
    const first = getPlainLocation(firstLocation);
    const second = getPlainLocation(secondLocation);

    if (!first || !second) {
      return Number.POSITIVE_INFINITY;
    }

    const earthRadiusMeters = 6371000;
    const toRadians = (value) => Number(value) * Math.PI / 180;
    const deltaLat = toRadians(second.lat - first.lat);
    const deltaLng = toRadians(second.lng - first.lng);
    const haversine =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(deltaLng / 2) ** 2;

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  window.RoadEyeUtils = {
    calculateDistanceMeters,
    formatCoordinates,
    getPlainLocation,
    getPublicAuthorName,
    isCodiceFiscale,
  };
})();
