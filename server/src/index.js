import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  geocodeAddress,
  reverseGeocode,
  getDrivingRoute,
  autocompleteAddress,
} from "./orsClient.js";
import { buildCheckpoints, decimateRoute } from "./routePlanner.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ALTERNATIVE_ROUTE_COUNT = 1; // primary + 1 alternate, kept low to bound reverse-geocode latency

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/autocomplete", async (req, res) => {
  const text = req.query.text;
  if (!text || String(text).trim().length < 3) {
    return res.json({ results: [] });
  }
  const { focusLat, focusLon, country } = req.query;
  const focusPoint =
    focusLat && focusLon ? { lat: Number(focusLat), lon: Number(focusLon) } : undefined;
  try {
    const results = await autocompleteAddress(String(text), focusPoint, country || undefined);
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message || "Autocomplete failed" });
  }
});

app.post("/api/reverse-geocode", async (req, res) => {
  const { lat, lon } = req.body ?? {};
  if (typeof lat !== "number" || typeof lon !== "number") {
    return res.status(400).json({ error: "lat and lon (numbers) are required" });
  }
  try {
    const { name, countryCode } = await reverseGeocode(lat, lon);
    res.json({ name: name ?? null, countryCode: countryCode ?? null });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message || "Reverse geocoding failed" });
  }
});

async function nameCheckpoints(checkpoints, start, end) {
  return Promise.all(
    checkpoints.map(async (cp) => {
      if (cp.isStart) return { ...cp, name: start.label };
      if (cp.isEnd) return { ...cp, name: end.label };
      const { name } = await reverseGeocode(cp.lat, cp.lon);
      const milesIn = Math.round(cp.distanceMeters / 1609.34);
      return { ...cp, name: name ?? `En route (mile ${milesIn})` };
    })
  );
}

function isValidLocation(loc) {
  return loc && typeof loc.lat === "number" && typeof loc.lon === "number";
}

/**
 * Prefers the coordinates the user actually picked from the (country-filtered)
 * autocomplete dropdown over re-geocoding the plain text. Re-geocoding free text
 * can resolve to a completely different match than what was shown and selected
 * (e.g. an ambiguous name matching a same-named place on another continent).
 */
async function resolveEndpoint(address, providedLocation) {
  if (isValidLocation(providedLocation)) {
    return {
      lat: providedLocation.lat,
      lon: providedLocation.lon,
      label: providedLocation.label || address,
      countryCode: null,
    };
  }
  return geocodeAddress(address);
}

app.post("/api/trip", async (req, res) => {
  const { startAddress, endAddress, startLocation, endLocation } = req.body ?? {};

  if (!startAddress || !endAddress) {
    return res.status(400).json({ error: "startAddress and endAddress are required" });
  }

  try {
    const [start, end] = await Promise.all([
      resolveEndpoint(startAddress, startLocation),
      resolveEndpoint(endAddress, endLocation),
    ]);

    const { features: routeFeatures, alternativesAvailable, notices } = await getDrivingRoute(start, end, {
      alternativeCount: ALTERNATIVE_ROUTE_COUNT,
    });

    const routes = await Promise.all(
      routeFeatures.map(async (routeFeature) => {
        const { checkpoints, totalDuration, totalDistance } = buildCheckpoints(routeFeature);
        const named = await nameCheckpoints(checkpoints, start, end);
        return {
          totalDurationSeconds: Math.round(totalDuration),
          totalDistanceMeters: Math.round(totalDistance),
          checkpoints: named,
          routePath: decimateRoute(routeFeature),
        };
      })
    );

    routes.sort((a, b) => a.totalDurationSeconds - b.totalDurationSeconds);
    routes.forEach((route, i) => {
      route.id = i;
      route.isRecommended = i === 0;
    });

    res.json({ start, end, routes, alternativesAvailable, notices });
  } catch (err) {
    console.error(err);
    res
      .status(502)
      .json({ error: err.message || "Couldn't plan that route — check your addresses and try again.", severity: err.userFacing ? "user" : "system" });
  }
});

app.listen(PORT, () => {
  console.log(`Roadtrip weather server listening on http://localhost:${PORT}`);
});
