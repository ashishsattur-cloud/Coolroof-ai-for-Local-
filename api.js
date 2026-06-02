/**
 * api.js
 * --------------------------------------------------------------
 * All network calls: OpenWeatherMap + Groq AI (cool roof).
 * No backend needed — everything runs directly in the browser.
 * --------------------------------------------------------------
 */

/* ============================================================
   ⚠️  INSERT YOUR OPENWEATHERMAP API KEY HERE
   Free key at: https://openweathermap.org/api
   ============================================================ */
var OPENWEATHER_API_KEY = "871c04fbd34261144997b2135cfedd50";

/* ============================================================
   ⚠️  INSERT YOUR GROQ API KEY HERE
   Free key at: https://console.groq.com
   ============================================================ */
var GROQ_API_KEY = "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";

var BASE_URL   = "https://api.openweathermap.org";
var TILE_URL   = "https://tile.openweathermap.org/map";
var GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
var GROQ_MODEL = "llama-3.3-70b-versatile";

/* ---------- Key checks ---------- */

function hasApiKey() {
  return (
    typeof OPENWEATHER_API_KEY === "string" &&
    OPENWEATHER_API_KEY.length > 0 &&
    !OPENWEATHER_API_KEY.startsWith("YOUR_")
  );
}

function hasGeminiKey() {
  return (
    typeof GROQ_API_KEY === "string" &&
    GROQ_API_KEY.length > 0 &&
    !GROQ_API_KEY.startsWith("YOUR_")
  );
}

/* ---------- OpenWeatherMap ---------- */

function buildTileUrl(layerId) {
  return TILE_URL + "/" + layerId + "/{z}/{x}/{y}.png?appid=" + OPENWEATHER_API_KEY;
}

async function fetchCurrentWeather(lat, lon) {
  if (!hasApiKey()) throw new Error("Missing OpenWeatherMap API key");
  var url =
    BASE_URL + "/data/2.5/weather?lat=" + lat + "&lon=" + lon +
    "&units=metric&appid=" + OPENWEATHER_API_KEY;
  var res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed (" + res.status + ")");
  return res.json();
}

async function geocode(query) {
  if (!hasApiKey()) throw new Error("Missing OpenWeatherMap API key");
  var url =
    BASE_URL + "/geo/1.0/direct?q=" + encodeURIComponent(query) +
    "&limit=5&appid=" + OPENWEATHER_API_KEY;
  var res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed (" + res.status + ")");
  return res.json();
}

/* ---------- Groq AI — Cool Roof + Interior Materials ---------- */

/**
 * @param {number} lat
 * @param {number} lon
 * @param {string} city
 * @param {object|null} weatherData  - { temp, humidity, description }
 * @param {object|null} userProfile  - { roofArea, roofType, budget, heatIndex, solar, country }
 * @returns {Promise<object>}        - parsed JSON: { recommendations: [...], interior_materials: [...] }
 */
async function fetchCoolRoofRecommendation(lat, lon, city, weatherData, userProfile) {
  if (!hasGeminiKey()) {
    throw new Error("Missing Groq API key — add it in js/api.js");
  }

  var locationName = city || ("coordinates " + lat.toFixed(4) + ", " + lon.toFixed(4));
  var country    = (userProfile && userProfile.country)   ? userProfile.country   : "India";
  var roofArea   = (userProfile && userProfile.roofArea)  ? userProfile.roofArea  : "1000";
  var roofType   = (userProfile && userProfile.roofType)  ? userProfile.roofType  : "flat";
  var budget     = (userProfile && userProfile.budget)    ? userProfile.budget    : "₹1,50,000";
  var heatIndex  = (userProfile && userProfile.heatIndex) ? userProfile.heatIndex : "Medium";
  var solar      = (userProfile && userProfile.solar)     ? userProfile.solar     : "5.5";
  var temp       = (weatherData && weatherData.temp !== undefined) ? weatherData.temp : "N/A";
  var humidity   = (weatherData && weatherData.humidity)  ? weatherData.humidity  : "N/A";
  var desc       = (weatherData && weatherData.description) ? weatherData.description : "N/A";

  var prompt =
    "You are a sustainable urban architecture expert specializing in rooftop cooling solutions and natural interior cooling.\n\n" +

    "USER PROFILE:\n" +
    "- Location: " + locationName + ", " + country + "\n" +
    "- Latitude / Longitude: " + lat.toFixed(4) + ", " + lon.toFixed(4) + "\n" +
    "- Roof Area: " + roofArea + " sq ft\n" +
    "- Roof Type: " + roofType + "\n" +
    "- Budget: " + budget + "\n" +
    "- Current Temperature: " + temp + "°C\n" +
    "- Current Humidity: " + humidity + "%\n" +
    "- Current Conditions: " + desc + "\n" +
    "- Heat Island Severity: " + heatIndex + " (High/Medium/Low)\n" +
    "- Solar Radiation: " + solar + " kWh/m²/day\n\n" +

    "CLIMATE CONTEXT:\n" +
    "Use your knowledge of the past 5 years of climate trends for " + locationName +
    " — including average summer temperatures, monsoon/rainfall patterns, " +
    "humidity levels, and urban heat island intensity — to inform and personalise your recommendations.\n\n" +

    "PART 1 — ROOFTOP SOLUTIONS:\n" +
    "Recommend exactly 3 rooftop cooling solutions best suited to this user's profile and location. " +
    "For each solution provide:\n" +
    "1. Solution name\n" +
    "2. Why it specifically suits this user (location, roof type, budget)\n" +
    "3. Estimated temperature reduction (°C)\n" +
    "4. Installation cost range (INR)\n" +
    "5. Annual electricity savings (INR)\n" +
    "6. CO₂ reduction (kg/year)\n" +
    "7. Payback period (years)\n\n" +

    "PART 2 — INTERIOR COOLING MATERIALS:\n" +
    "Recommend exactly 4 locally available interior materials or techniques that can naturally cool the indoor space at " + locationName + ". " +
    "Focus on materials that are easily sourced in this region. For each provide:\n" +
    "1. Material name\n" +
    "2. How it cools the interior and why it suits this climate\n" +
    "3. Where it is locally available (markets, suppliers, or natural sources in this region)\n" +
    "4. Approximate cost range (INR)\n\n" +

    "Respond ONLY with valid JSON — no markdown fences, no preamble, no extra text.\n" +
    "Use exactly this structure:\n" +
    "{\n" +
    "  \"recommendations\": [\n" +
    "    {\"name\":\"\",\"reason\":\"\",\"temp_reduction\":\"\",\"cost\":\"\",\"savings\":\"\",\"co2\":\"\",\"payback\":\"\"}\n" +
    "  ],\n" +
    "  \"interior_materials\": [\n" +
    "    {\"name\":\"\",\"description\":\"\",\"availability\":\"\",\"cost_range\":\"\"}\n" +
    "  ]\n" +
    "}";

  var res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + GROQ_API_KEY
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "You are a sustainable urban architecture expert specializing in rooftop cooling solutions and local interior cooling materials. " +
            "Always respond ONLY with valid JSON. No markdown, no backticks, no extra text whatsoever."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!res.ok) {
    var errJson = await res.json().catch(function() { return {}; });
    var msg = (errJson.error && errJson.error.message)
      ? errJson.error.message
      : "Groq request failed (" + res.status + ")";
    throw new Error(msg);
  }

  var json = await res.json();
  var text =
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content;

  if (!text) throw new Error("No response from AI");

  try {
    var clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    throw new Error("AI returned invalid JSON. Raw: " + text.slice(0, 200));
  }
}
