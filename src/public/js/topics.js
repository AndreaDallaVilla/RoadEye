(function () {
  const TOPIC_MARKER_COLORS = {
    "Incidente stradale": "#d93025",
    "Cantiere stradale": "#fbbc04",
    Evento: "#7e3ff2",
    "Ferimento animali": "#188038",
    "Pericolo bordo strada": "#141414",
    Autovelox: "#1a9bd7",
  };

  const TOPIC_ICON_COLORS = {
    "Cantiere stradale": "#141414",
    "Pericolo bordo strada": "#ffffff",
  };

  const TOPIC_MARKER_ICONS = {
    Autovelox: "/assets/topic-autovelox.png",
    "Cantiere stradale": "/assets/topic-cantiere.png",
    "Incidente stradale": "/assets/topic-incidente.png",
    "Ferimento animali": "/assets/topic-animali.png",
    "Pericolo bordo strada": "/assets/topic-pericolo.png",
    Evento: "/assets/topic-evento.png",
  };

  function getTopicColor(topic) {
    return TOPIC_MARKER_COLORS[topic] || "#141414";
  }

  function getTopicIconColor(topic) {
    return TOPIC_ICON_COLORS[topic] || "#ffffff";
  }

  function createAnnouncementMarkerContent(topic, options = {}) {
    const markerContent = document.createElement("span");
    const icon = document.createElement("img");
    const color = getTopicColor(topic);
    const iconColor = getTopicIconColor(topic);

    markerContent.className = options.compact ? "announcement-topic-badge" : "map-announcement-marker";
    markerContent.style.setProperty("--marker-color", color);
    markerContent.style.setProperty("--marker-icon-color", iconColor);
    markerContent.setAttribute("aria-label", topic || "Annuncio");
    icon.src = TOPIC_MARKER_ICONS[topic] || TOPIC_MARKER_ICONS.Evento;
    icon.alt = "";
    icon.decoding = "async";
    markerContent.append(icon);

    return markerContent;
  }

  function updateCategoryTopicStyles() {
    document.querySelectorAll("[data-category]").forEach((button) => {
      const topic = button.dataset.category;
      const color = getTopicColor(topic);
      const iconSlot = button.querySelector(".topic-choice-icon");

      button.style.setProperty("--topic-color", color);
      if (!iconSlot) {
        return;
      }

      iconSlot.replaceChildren(createAnnouncementMarkerContent(topic, { compact: true }));
    });
  }

  window.RoadEyeTopics = {
    createAnnouncementMarkerContent,
    getTopicColor,
    updateCategoryTopicStyles,
  };
})();
