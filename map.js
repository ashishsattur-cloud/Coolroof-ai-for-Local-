/**
 * map.js
 * --------------------------------------------------------------
 * Encapsulates everything Leaflet-related:
 *   - base map creation
 *   - weather tile overlay management (add/remove by id)
 *   - the single "selected location" marker + popup
 *
 * Exposes a single factory `createWeatherMap(elementId)` that
 * returns an API for the rest of the app to use. This keeps
 * Leaflet entirely out of main.js.
 *
 * NOTE: api.js must be loaded before this file.
 * --------------------------------------------------------------
 */

/* Layer id (used by toggles + api.js) → OpenWeatherMap tile id */
var LAYER_TILES = {
  temp: "temp_new",
  clouds: "clouds_new",
  precipitation: "precipitation_new",
  wind: "wind_new",
};

function createWeatherMap(elementId) {
  // ----- Base map -----
  var map = L.map(elementId, {
    center: [20, 0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 12,
    worldCopyJump: true,
  });

  // Esri World Street Map — shows India's official borders correctly
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012",
    }
  ).addTo(map);

  // Track active overlays so we can toggle them on/off
  var activeOverlays = {};
  var selectedMarker = null;

  /** Add an OpenWeatherMap overlay if not already on the map. */
  function addOverlay(layerId) {
    if (activeOverlays[layerId]) return;
    var tileId = LAYER_TILES[layerId];
    if (!tileId) return;

    var overlay = L.tileLayer(buildTileUrl(tileId), {
      opacity: 0.65,
      attribution: "Weather data &copy; OpenWeatherMap",
    });
    overlay.addTo(map);
    activeOverlays[layerId] = overlay;
  }

  /** Remove an OpenWeatherMap overlay if currently shown. */
  function removeOverlay(layerId) {
    var overlay = activeOverlays[layerId];
    if (!overlay) return;
    map.removeLayer(overlay);
    delete activeOverlays[layerId];
  }

  /** Place / move the selection marker and pan to it. */
  function setSelection(lat, lon, popupHtml) {
    if (selectedMarker) {
      selectedMarker.setLatLng([lat, lon]);
    } else {
      selectedMarker = L.marker([lat, lon]).addTo(map);
    }
    if (popupHtml) {
      selectedMarker.bindPopup(popupHtml).openPopup();
    }
  }

  /** Smoothly fly the viewport to a coordinate. */
  function flyTo(lat, lon, zoom) {
    map.flyTo([lat, lon], zoom || 7, { duration: 1.2 });
  }

  /** Subscribe to map clicks; callback receives { lat, lon }. */
  function onMapClick(callback) {
    map.on("click", function(e) {
      callback({ lat: e.latlng.lat, lon: e.latlng.lng });
    });
  }

  return {
    addOverlay: addOverlay,
    removeOverlay: removeOverlay,
    setSelection: setSelection,
    flyTo: flyTo,
    onMapClick: onMapClick,
    raw: map,
  };
}
