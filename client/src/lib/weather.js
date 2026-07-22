const WEATHER_CODES = {
  0: { label: "Clear sky", icon: "☀️", nightIcon: "🌙" },
  1: { label: "Mainly clear", icon: "🌤️", nightIcon: "🌙" },
  2: { label: "Partly cloudy", icon: "⛅", nightIcon: "☁️" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Freezing fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Dense drizzle", icon: "🌦️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "🌨️" },
  77: { label: "Snow grains", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌧️" },
  81: { label: "Rain showers", icon: "🌧️" },
  82: { label: "Violent rain showers", icon: "🌧️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm w/ hail", icon: "⛈️" },
  99: { label: "Thunderstorm w/ hail", icon: "⛈️" },
};

const WINTER_CODES = new Set([56, 57, 66, 67, 71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);

const PRECIP_PROBABILITY_HAZARD_THRESHOLD = 70;
const WIND_MPH_HAZARD_THRESHOLD = 25;

function conditionFor(weatherCode, isDay = true) {
  const entry = WEATHER_CODES[weatherCode] ?? { label: "Unknown", icon: "❓" };
  if (!isDay && entry.nightIcon) {
    return { label: entry.label, icon: entry.nightIcon };
  }
  return { label: entry.label, icon: entry.icon };
}

function isHazardous({ weatherCode, precipitationProbability, windSpeedMph }) {
  return (
    precipitationProbability > PRECIP_PROBABILITY_HAZARD_THRESHOLD ||
    windSpeedMph > WIND_MPH_HAZARD_THRESHOLD ||
    WINTER_CODES.has(weatherCode) ||
    STORM_CODES.has(weatherCode)
  );
}

function hazardReasons({ weatherCode, precipitationProbability, windSpeedMph }) {
  const reasons = [];
  if (precipitationProbability > PRECIP_PROBABILITY_HAZARD_THRESHOLD) {
    reasons.push(`${precipitationProbability}% chance of precipitation`);
  }
  if (windSpeedMph > WIND_MPH_HAZARD_THRESHOLD) {
    reasons.push(`${Math.round(windSpeedMph)} mph wind`);
  }
  if (STORM_CODES.has(weatherCode)) {
    reasons.push("severe storm");
  } else if (WINTER_CODES.has(weatherCode)) {
    reasons.push("winter weather");
  }
  return reasons;
}

/**
 * Open-Meteo (with timezone=auto) returns each hour as a local wall-clock
 * string for that location, with no UTC marker. Parsing "<string>Z" reads
 * those digits as if they were UTC, which is off by exactly the location's
 * UTC offset — subtracting it back out gives the true UTC instant.
 */
function localTimeToEpochMs(localTimeStr, utcOffsetSeconds) {
  return Date.parse(`${localTimeStr}Z`) - utcOffsetSeconds * 1000;
}

function closestHourIndex(hourlyTimesLocal, utcOffsetSeconds, targetEpochMs) {
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < hourlyTimesLocal.length; i++) {
    const diff = Math.abs(localTimeToEpochMs(hourlyTimesLocal[i], utcOffsetSeconds) - targetEpochMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

const HOURLY_WINDOW_RADIUS = 2;

/**
 * Slices a +/-2hr window of already-fetched hourly data around the
 * checkpoint's matched hour, for the "trend around your ETA" strip in the
 * full-forecast detail view. No extra API calls — Open-Meteo already
 * returned the full day's hours in the batched request.
 */
function buildHourlyWindow(forecast, targetIdx) {
  const { time, temperature_2m, weathercode, is_day } = forecast.hourly;
  const offset = forecast.utc_offset_seconds;
  const start = Math.max(0, targetIdx - HOURLY_WINDOW_RADIUS);
  const end = Math.min(time.length - 1, targetIdx + HOURLY_WINDOW_RADIUS);

  const window = [];
  for (let i = start; i <= end; i++) {
    window.push({
      time: new Date(localTimeToEpochMs(time[i], offset)),
      temperatureF: temperature_2m[i],
      condition: conditionFor(weathercode[i], is_day[i] === 1),
      isTarget: i === targetIdx,
    });
  }
  return window;
}

const CARD_TREND_RADIUS_HOURS = 6;
const CARD_TREND_STEP_HOURS = 2;

/**
 * A coarser +/-6hr trend (7 points, 2hr apart) for the compact strip shown
 * directly on each checkpoint card, so the ~12hr picture is visible without
 * opening the full-forecast detail view. Same already-fetched data as
 * buildHourlyWindow, just wider and sparser to stay uncluttered at card size.
 */
function buildCardTrend(forecast, targetIdx) {
  const { time, temperature_2m, weathercode, is_day } = forecast.hourly;
  const utcOffsetSeconds = forecast.utc_offset_seconds;
  const points = [];
  for (let hourOffset = -CARD_TREND_RADIUS_HOURS; hourOffset <= CARD_TREND_RADIUS_HOURS; hourOffset += CARD_TREND_STEP_HOURS) {
    const i = targetIdx + hourOffset;
    if (i < 0 || i >= time.length) continue;
    points.push({
      time: new Date(localTimeToEpochMs(time[i], utcOffsetSeconds)),
      temperatureF: temperature_2m[i],
      condition: conditionFor(weathercode[i], is_day[i] === 1),
      isTarget: hourOffset === 0,
    });
  }
  return points;
}

/**
 * Fetches hourly forecasts for every checkpoint in one batched Open-Meteo
 * call (comma-separated lat/lon), then matches each checkpoint's ETA to the
 * nearest forecast hour. Requests `timezone=auto` so Open-Meteo resolves each
 * location's own IANA timezone — matching is still done as absolute UTC
 * instants (converting local-time strings back via each location's own UTC
 * offset), but the resolved zone is attached to the checkpoint so the UI can
 * *display* times in the place's own local time instead of the viewer's
 * browser timezone.
 */
export async function fetchCheckpointWeather(checkpoints, departureDate) {
  const latitudes = checkpoints.map((cp) => cp.lat).join(",");
  const longitudes = checkpoints.map((cp) => cp.lon).join(",");

  const params = new URLSearchParams({
    latitude: latitudes,
    longitude: longitudes,
    hourly: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weathercode,windspeed_10m,is_day",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    forecast_days: "10",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to fetch weather forecast");
  }
  const data = await res.json();

  // Open-Meteo returns a single object (not an array) when only one location is requested.
  const results = Array.isArray(data) ? data : [data];

  return checkpoints.map((cp, i) => {
    const forecast = results[i];
    const utcOffsetSeconds = forecast.utc_offset_seconds;
    const targetEpochMs = departureDate.getTime() + cp.etaSeconds * 1000;
    const idx = closestHourIndex(forecast.hourly.time, utcOffsetSeconds, targetEpochMs);

    const weatherCode = forecast.hourly.weathercode[idx];
    const precipitationProbability = forecast.hourly.precipitation_probability[idx];
    const windSpeedMph = forecast.hourly.windspeed_10m[idx];
    const temperatureF = forecast.hourly.temperature_2m[idx];
    const feelsLikeF = forecast.hourly.apparent_temperature[idx];
    const humidity = forecast.hourly.relative_humidity_2m[idx];
    const isDay = forecast.hourly.is_day[idx] === 1;
    const condition = conditionFor(weatherCode, isDay);
    const hazardInputs = { weatherCode, precipitationProbability, windSpeedMph };

    return {
      ...cp,
      etaDate: new Date(targetEpochMs),
      timezone: forecast.timezone,
      timezoneAbbreviation: forecast.timezone_abbreviation,
      utcOffsetSeconds,
      forecastTimeLocal: forecast.hourly.time[idx],
      temperatureF,
      feelsLikeF,
      humidity,
      precipitationProbability,
      windSpeedMph,
      condition,
      hazard: isHazardous(hazardInputs),
      hazardReasons: hazardReasons(hazardInputs),
      hourlyWindow: buildHourlyWindow(forecast, idx),
      cardTrend: buildCardTrend(forecast, idx),
    };
  });
}
