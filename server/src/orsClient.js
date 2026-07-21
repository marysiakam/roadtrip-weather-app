import { UserFacingError } from "./errors.js";

const ORS_BASE = "https://api.openrouteservice.org";

function requireApiKey() {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    throw new Error(
      "ORS_API_KEY is not set. Add it to server/.env (see server/.env.example)."
    );
  }
  return key;
}

async function orsFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${ORS_BASE}${path}`, {
    method,
    headers: {
      Authorization: requireApiKey(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const err = new Error(json?.error?.message || `ORS request failed (${res.status}): ${text || res.statusText}`);
    err.orsCode = json?.error?.code;
    throw err;
  }
  return json;
}

export async function geocodeAddress(text) {
  const params = new URLSearchParams({ text, size: "1" });
  const data = await orsFetch(`/geocode/search?${params.toString()}`);
  const feature = data.features?.[0];
  if (!feature) {
    throw new UserFacingError(`We couldn't find "${text}" — check the spelling, or try a nearby town instead.`);
  }
  const [lon, lat] = feature.geometry.coordinates;
  return { lat, lon, label: feature.properties.label, countryCode: feature.properties.country_a ?? null };
}

/**
 * `focus.point` only nudges ranking — it's not strong enough to move a
 * locally-relevant match (e.g. "Las Vegas, NV") above a globally prominent
 * same-prefix name on another continent (e.g. "Las Palmas, Spain"). Hard-
 * filtering to the start address's country with `boundary.country` is what
 * actually keeps destination suggestions relevant for a road trip.
 */
export async function autocompleteAddress(text, focusPoint, countryCode) {
  const params = new URLSearchParams({ text, size: "5" });
  if (focusPoint) {
    params.set("focus.point.lat", String(focusPoint.lat));
    params.set("focus.point.lon", String(focusPoint.lon));
  }
  if (countryCode) {
    params.set("boundary.country", countryCode);
  }
  const data = await orsFetch(`/geocode/autocomplete?${params.toString()}`);
  return (data.features ?? []).map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    return { lat, lon, label: feature.properties.label, countryCode: feature.properties.country_a ?? null };
  });
}

async function reverseGeocodeLayers(lat, lon, layers, radiusKm) {
  const params = new URLSearchParams({
    "point.lat": String(lat),
    "point.lon": String(lon),
    size: "1",
    layers,
    "boundary.circle.radius": String(radiusKm),
  });
  const data = await orsFetch(`/geocode/reverse?${params.toString()}`);
  const props = data.features?.[0]?.properties;
  if (!props) return null;
  return { name: props.label, countryCode: props.country_a ?? null };
}

/**
 * Finds a human-readable place name (and country) for a point along the
 * route. A plain Pelias reverse lookup often returns the state ("Wyoming,
 * USA") on remote highway stretches, because the state polygon is a
 * zero-distance match while the nearest real town is 60+ miles away. So we
 * search town-level layers first with a wide radius, and only fall back to
 * the state/country label if truly nothing is nearby.
 */
export async function reverseGeocode(lat, lon) {
  try {
    const town = await reverseGeocodeLayers(
      lat,
      lon,
      "locality,localadmin,neighbourhood,borough,county",
      100
    );
    if (town) return town;

    return (
      (await reverseGeocodeLayers(lat, lon, "region,macroregion,country", 100)) ?? {
        name: null,
        countryCode: null,
      }
    );
  } catch {
    return { name: null, countryCode: null };
  }
}

function unreachableByRoadMessage(start, end) {
  return `"${start.label}" and "${end.label}" aren't connected by road (e.g. separated by an ocean) — try two addresses reachable by car.`;
}

function pointNotRoutableMessage(label) {
  return `Couldn't find a road near "${label ?? "that address"}" — try a more specific address (a nearby town, visitor center, or parking area) instead of a park or landmark name.`;
}

/** Pulls the "lat, lon" ORS reports out of its 2010 error message text. */
function extractFailedCoordinate(message) {
  const match = message.match(/coordinate\s+(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
}

function isNear(a, b, toleranceDeg = 0.05) {
  return Math.abs(a.lat - b.lat) < toleranceDeg && Math.abs(a.lon - b.lon) < toleranceDeg;
}

const EARTH_RADIUS_MILES = 3958.8;

function haversineMiles(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

const SNAP_NOTICE_THRESHOLD_MILES = 0.5;

/**
 * Compares the geocoded start/end against where the route actually begins
 * and ends. When ORS had to reach beyond a normal distance to find a road
 * (see EXPANDED_SNAP_RADIUS_METERS below), this surfaces that as a visible
 * notice instead of silently routing to a spot the user didn't ask for.
 */
function buildSnapNotices(routeFeature, start, end) {
  const coords = routeFeature.geometry.coordinates;
  const [routeStartLon, routeStartLat] = coords[0];
  const [routeEndLon, routeEndLat] = coords[coords.length - 1];

  const notices = [];
  const startDistMiles = haversineMiles(start.lat, start.lon, routeStartLat, routeStartLon);
  const endDistMiles = haversineMiles(end.lat, end.lon, routeEndLat, routeEndLon);

  if (startDistMiles > SNAP_NOTICE_THRESHOLD_MILES) {
    notices.push(`Routed to the nearest accessible road, ~${startDistMiles.toFixed(1)} mi from ${start.label}.`);
  }
  if (endDistMiles > SNAP_NOTICE_THRESHOLD_MILES) {
    notices.push(`Routed to the nearest accessible road, ~${endDistMiles.toFixed(1)} mi from ${end.label}.`);
  }
  return notices;
}

async function requestRoute(start, end, alternativeCount, radiusMeters) {
  return orsFetch("/v2/directions/driving-car/geojson", {
    method: "POST",
    body: {
      coordinates: [
        [start.lon, start.lat],
        [end.lon, end.lat],
      ],
      ...(radiusMeters != null ? { radiuses: [radiusMeters, radiusMeters] } : {}),
      ...(alternativeCount > 0
        ? {
            alternative_routes: {
              target_count: alternativeCount + 1,
              share_factor: 0.6,
              weight_factor: 1.4,
            },
          }
        : {}),
    },
  });
}

/**
 * Fetches the primary driving route plus up to `alternativeCount` alternates
 * (ORS honors target_count as a target, not a guarantee — it may return
 * fewer if the roads don't meaningfully diverge). Returns the raw feature
 * list in ORS's preference order; the first is its recommended route.
 *
 * ORS's public alternative-routes algorithm refuses routes longer than
 * ~100km, which rules out basically every real road trip. When that limit
 * is hit, we transparently retry without alternatives instead of failing
 * the whole request — `alternativesAvailable: false` on the result lets
 * callers know only one route came back.
 */
const EXPANDED_SNAP_RADIUS_METERS = 10000;

export async function getDrivingRoute(start, end, { alternativeCount = 1 } = {}) {
  let alternativesAvailable = alternativeCount > 0;

  async function attempt(count, radiusMeters, hasRetriedRadius) {
    try {
      return await requestRoute(start, end, count, radiusMeters);
    } catch (err) {
      if (/exceed the server configuration limits/i.test(err.message)) {
        if (count > 0) {
          alternativesAvailable = false;
          return attempt(0, radiusMeters, hasRetriedRadius);
        }
        // Still over the limit with alternatives already stripped — the route
        // itself is too long for ORS to compute at all (e.g. it'd have to cross
        // an ocean), not just too long for the alternative-routes algorithm.
        throw new UserFacingError(unreachableByRoadMessage(start, end));
      }
      if (err.orsCode === 2010) {
        // Code 2010 means ORS couldn't snap ONE specific coordinate to a road
        // within its default ~350m search — common for park/summit/campground
        // names that geocode to a point deep in wilderness. Retry once with a
        // much wider search radius before giving up; if that still fails, the
        // point really is that remote.
        if (!hasRetriedRadius) {
          return attempt(count, EXPANDED_SNAP_RADIUS_METERS, true);
        }
        const failedCoord = extractFailedCoordinate(err.message);
        let label = null;
        if (failedCoord) {
          if (isNear(failedCoord, start)) label = start.label;
          else if (isNear(failedCoord, end)) label = end.label;
        }
        throw new UserFacingError(pointNotRoutableMessage(label ?? end.label));
      }
      if (/route could not be found/i.test(err.message)) {
        throw new UserFacingError(unreachableByRoadMessage(start, end));
      }
      throw err;
    }
  }

  const data = await attempt(alternativeCount, undefined, false);
  const features = data.features ?? [];
  if (features.length === 0) {
    throw new UserFacingError(unreachableByRoadMessage(start, end));
  }
  const notices = buildSnapNotices(features[0], start, end);
  return { features, alternativesAvailable: alternativesAvailable && features.length > 1, notices };
}
