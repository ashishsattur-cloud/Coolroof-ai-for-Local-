/**
 * main.js
 * --------------------------------------------------------------
 * App entry point. Wires DOM events to the map + api modules.
 * Supports user profile form, structured JSON cool roof cards,
 * and locally available interior cooling materials.
 *
 * NOTE: api.js and map.js must be loaded before this file.
 * --------------------------------------------------------------
 */

// ---------- Boot the map ----------
var weatherMap = createWeatherMap("map");
weatherMap.addOverlay("temp");

// ---------- DOM references ----------
var layerCheckboxes  = document.querySelectorAll("input[data-layer]");
var searchForm       = document.getElementById("search-form");
var searchInput      = document.getElementById("search-input");
var searchResults    = document.getElementById("search-results");
var infoContent      = document.getElementById("info-content");
var apiKeyWarning    = document.getElementById("api-key-warning");
var coolRoofPanel    = document.getElementById("cool-roof-panel");
var coolRoofContent  = document.getElementById("cool-roof-content");
var analyseBtn       = document.getElementById("analyse-btn");

var profRoofArea   = document.getElementById("prof-roof-area");
var profRoofType   = document.getElementById("prof-roof-type");
var profBudget     = document.getElementById("prof-budget");
var profHeatIndex  = document.getElementById("prof-heat-index");
var profSolar      = document.getElementById("prof-solar");

// ---------- State ----------
var currentLat     = null;
var currentLon     = null;
var currentCity    = "";
var currentWeather = null;

// ---------- Key warnings ----------
if (!hasApiKey()) apiKeyWarning.hidden = false;

var geminiWarning = document.getElementById("gemini-key-warning");
if (geminiWarning && !hasGeminiKey()) geminiWarning.hidden = false;

// ---------- Layer toggles ----------
layerCheckboxes.forEach(function(cb) {
  cb.addEventListener("change", function() {
    cb.checked
      ? weatherMap.addOverlay(cb.dataset.layer)
      : weatherMap.removeOverlay(cb.dataset.layer);
  });
});

// ---------- Map click ----------
weatherMap.onMapClick(function(coords) {
  loadWeather(coords.lat, coords.lon, "");
});

// ---------- Coordinate parser ----------
function parseCoordinates(query) {
  var q = query.trim();
  var dec = q.match(/^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (dec) {
    var lat = parseFloat(dec[1]);
    var lon = parseFloat(dec[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat: lat, lon: lon };
    }
  }
  var card = q.match(/^(\d{1,3}(?:\.\d+)?)\s*([NS])[,\s]+(\d{1,3}(?:\.\d+)?)\s*([EW])$/i);
  if (card) {
    var lat = parseFloat(card[1]) * (/S/i.test(card[2]) ? -1 : 1);
    var lon = parseFloat(card[3]) * (/W/i.test(card[4]) ? -1 : 1);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat: lat, lon: lon };
    }
  }
  return null;
}

// ---------- Search ----------
searchForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  var query = searchInput.value.trim();
  if (!query) return;

  var coords = parseCoordinates(query);
  if (coords) {
    searchResults.hidden = true;
    weatherMap.flyTo(coords.lat, coords.lon, 10);
    await loadWeather(coords.lat, coords.lon, coords.lat.toFixed(4) + ", " + coords.lon.toFixed(4));
    return;
  }

  if (!hasApiKey()) {
    renderInfo('<p class="info-empty">Add an OpenWeatherMap API key to enable search.</p>');
    return;
  }

  try {
    var matches = await geocode(query);
    renderSearchResults(matches);
  } catch (err) {
    renderInfo('<p class="info-empty">Search failed: ' + err.message + "</p>");
  }
});

function renderSearchResults(matches) {
  if (!matches.length) {
    searchResults.hidden = true;
    renderInfo('<p class="info-empty">No results for that query.</p>');
    return;
  }
  searchResults.innerHTML = matches.map(function(m, i) {
    var sub = [m.state, m.country].filter(Boolean).join(", ");
    return (
      '<li data-index="' + i + '">' + m.name +
      (sub ? ' &middot; <span style="color:var(--text-dim)">' + sub + "</span>" : "") +
      "</li>"
    );
  }).join("");
  searchResults.hidden = false;

  searchResults.querySelectorAll("li").forEach(function(li) {
    li.addEventListener("click", async function() {
      var match = matches[Number(li.dataset.index)];
      searchResults.hidden = true;
      searchInput.value = match.name;
      weatherMap.flyTo(match.lat, match.lon, 8);
      await loadWeather(match.lat, match.lon, match.name);
    });
  });
}

// ---------- Weather ----------
async function loadWeather(lat, lon, cityName) {
  currentLat     = lat;
  currentLon     = lon;
  currentWeather = null;

  coolRoofPanel.hidden   = false;
  analyseBtn.disabled    = false;
  analyseBtn.textContent = "\uD83C\uDF3F Analyse Cool Roof";
  coolRoofContent.innerHTML =
    '<p class="info-empty">Click <strong>Analyse Cool Roof</strong> to get AI recommendations.</p>';

  if (!hasApiKey()) {
    renderInfo('<p class="info-empty">Add an API key in <code>api.js</code> to load live weather.</p>');
    currentCity = cityName;
    return;
  }

  renderInfo('<p class="info-empty">Loading\u2026</p>');

  try {
    var data = await fetchCurrentWeather(lat, lon);
    renderWeatherCard(data);
    weatherMap.setSelection(
      lat, lon,
      "<strong>" + (data.name || "Selected location") + "</strong><br />" +
      Math.round(data.main.temp) + "\u00b0C \u00b7 " + data.weather[0].description
    );
    currentWeather = {
      temp: Math.round(data.main.temp),
      humidity: data.main.humidity,
      description: data.weather[0].description
    };
    currentCity = data.name || cityName;
  } catch (err) {
    renderInfo('<p class="info-empty">Could not load weather: ' + err.message + "</p>");
    currentCity = cityName;
  }
}

// ---------- Analyse button ----------
analyseBtn.addEventListener("click", function() {
  if (currentLat === null) return;
  loadCoolRoof(currentLat, currentLon, currentCity, currentWeather);
});

function getUserProfile() {
  return {
    roofArea:  (profRoofArea  && profRoofArea.value.trim())  || "1000",
    roofType:  (profRoofType  && profRoofType.value)         || "flat",
    budget:    (profBudget    && profBudget.value.trim())    || "\u20b91,50,000",
    heatIndex: (profHeatIndex && profHeatIndex.value)        || "Medium",
    solar:     (profSolar     && profSolar.value.trim())     || "5.5",
    country:   "India"
  };
}

// ---------- Cool Roof AI ----------
async function loadCoolRoof(lat, lon, city, weatherData) {
  if (!hasGeminiKey()) {
    coolRoofContent.innerHTML =
      '<p class="cool-roof-error">' +
      'Add your free Groq API key in <code>api.js</code> to enable Cool Roof AI.<br/>' +
      '<a href="https://console.groq.com" target="_blank" rel="noopener">Get a free key here \u2192</a>' +
      '</p>';
    return;
  }

  analyseBtn.disabled    = true;
  analyseBtn.textContent = "Analysing\u2026";

  coolRoofContent.innerHTML =
    '<div class="cool-roof-loading">' +
      '<div class="cool-roof-spinner"></div>' +
      '<span>Analysing 5-year climate data for cool roof &amp; interior tips\u2026</span>' +
    '</div>';

  try {
    var profile = getUserProfile();
    var result  = await fetchCoolRoofRecommendation(lat, lon, city, weatherData, profile);
    renderCoolRoofCards(result);
  } catch (err) {
    coolRoofContent.innerHTML =
      '<p class="cool-roof-error">AI error: ' + err.message + "</p>";
  } finally {
    analyseBtn.disabled    = false;
    analyseBtn.textContent = "\uD83C\uDF3F Analyse Cool Roof";
  }
}

// ---------- Render recommendation cards + interior materials ----------
function renderCoolRoofCards(result) {
  var recs = result && result.recommendations;
  var interior = result && result.interior_materials;

  if (!recs || !recs.length) {
    coolRoofContent.innerHTML = '<p class="cool-roof-error">No recommendations returned. Please try again.</p>';
    return;
  }

  // ----- Rooftop cards -----
  var html = '<div class="section-heading">\uD83C\uDFE0 Rooftop Cooling Solutions</div>';
  html += '<div class="rec-cards">';

  recs.forEach(function(rec) {
    html +=
      '<div class="rec-card">' +
        '<div class="rec-card-title">' + esc(rec.name) + '</div>' +
        '<div class="rec-card-reason">' + esc(rec.reason) + '</div>' +
        '<div class="rec-stats">' +
          stat("\uD83C\uDF21\uFE0F Temp Reduction", rec.temp_reduction) +
          stat("\uD83D\uDCB0 Install Cost",         rec.cost) +
          stat("\u26A1 Annual Savings",             rec.savings) +
          stat("\uD83C\uDF3F CO\u2082 Reduction",  rec.co2) +
          stat("\uD83D\uDCC5 Payback Period",       rec.payback) +
        '</div>' +
      '</div>';
  });

  html += '</div>';

  // ----- Interior materials -----
  if (interior && interior.length) {
    html += '<div class="section-heading interior-heading">\uD83C\uDFE1 Locally Available Interior Cooling Materials</div>';
    html += '<div class="interior-cards">';

    interior.forEach(function(mat) {
      html +=
        '<div class="interior-card">' +
          '<div class="interior-card-title">' + esc(mat.name) + '</div>' +
          '<div class="interior-card-desc">' + esc(mat.description) + '</div>' +
          '<div class="interior-meta">' +
            '<div class="interior-meta-item">' +
              '<span class="interior-meta-label">\uD83D\uDDFA\uFE0F Where to Get</span>' +
              '<span class="interior-meta-value">' + esc(mat.availability) + '</span>' +
            '</div>' +
            '<div class="interior-meta-item">' +
              '<span class="interior-meta-label">\uD83D\uDCB5 Cost Range</span>' +
              '<span class="interior-meta-value">' + esc(mat.cost_range) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
  }

  coolRoofContent.innerHTML = html;
}

function stat(label, value) {
  return (
    '<div class="rec-stat">' +
      '<div class="rec-stat-label">' + label + '</div>' +
      '<div class="rec-stat-value">' + esc(value) + '</div>' +
    '</div>'
  );
}

function esc(val) {
  if (val === undefined || val === null) return "\u2014";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Weather card ----------
function renderWeatherCard(data) {
  var place = data.name
    ? data.name + (data.sys && data.sys.country ? ", " + data.sys.country : "")
    : data.coord.lat.toFixed(2) + ", " + data.coord.lon.toFixed(2);
  var icon = data.weather[0] && data.weather[0].icon
    ? '<img src="https://openweathermap.org/img/wn/' +
      data.weather[0].icon + '@2x.png" alt="" width="56" height="56" />'
    : "";

  renderInfo(
    '<div class="weather-card">' +
      '<div class="place">' + place + "</div>" +
      '<div class="conditions">' + icon +
        "<div>" +
          '<div class="temp">' + Math.round(data.main.temp) + "\u00b0C</div>" +
          '<div class="desc">' + data.weather[0].description + "</div>" +
        "</div>" +
      "</div>" +
      '<div class="meta">' +
        "<div>Feels like <strong>" + Math.round(data.main.feels_like) + "\u00b0C</strong></div>" +
        "<div>Humidity <strong>" + data.main.humidity + "%</strong></div>" +
        "<div>Wind <strong>" + data.wind.speed + " m/s</strong></div>" +
        "<div>Pressure <strong>" + data.main.pressure + " hPa</strong></div>" +
      "</div>" +
    "</div>"
  );
}

function renderInfo(html) { infoContent.innerHTML = html; }
