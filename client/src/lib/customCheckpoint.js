import { reverseGeocode } from "./tripApi";
import { fetchCheckpointWeather } from "./weather";

/**
 * Snaps an arbitrary lat/lon (e.g. a long-press on the map) to the nearest
 * point on the route's decimated path, reusing that point's precomputed
 * ETA/distance instead of running a fresh routing calculation.
 */
function projectToRoute(routePath, lat, lon) {
  let closest = routePath[0];
  let closestDist = Infinity;
  for (const point of routePath) {
    const d = (point.lat - lat) ** 2 + (point.lon - lon) ** 2;
    if (d < closestDist) {
      closestDist = d;
      closest = point;
    }
  }
  return closest;
}

let nextCustomId = 1;

export async function buildCustomCheckpoint(routePath, departureDate, lat, lon) {
  const projected = projectToRoute(routePath, lat, lon);
  const { name } = await reverseGeocode(projected.lat, projected.lon);
  const milesIn = Math.round(projected.distanceMeters / 1609.34);

  const checkpoint = {
    lat: projected.lat,
    lon: projected.lon,
    etaSeconds: projected.etaSeconds,
    distanceMeters: projected.distanceMeters,
    isStart: false,
    isEnd: false,
    isCustom: true,
    id: `custom-${nextCustomId++}`,
    name: name ?? `Custom stop (mile ${milesIn})`,
  };

  const [withWeather] = await fetchCheckpointWeather([checkpoint], departureDate);
  return withWeather;
}
