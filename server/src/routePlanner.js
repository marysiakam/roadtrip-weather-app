const EARTH_RADIUS_M = 6371000;
const MIN_CHECKPOINTS = 4;
const MAX_CHECKPOINTS = 10;
const TARGET_INTERVAL_SECONDS = 60 * 60;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineMeters([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Builds cumulative-time and cumulative-distance arrays, one entry per
 * coordinate, by distributing each routing step's duration across its
 * constituent segments proportional to segment distance. This lets speed
 * vary step-to-step (highway vs. local road) instead of assuming a single
 * average speed for the whole trip.
 */
function buildCumulativeArrays(coordinates, steps) {
  const segDist = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    segDist.push(haversineMeters(coordinates[i], coordinates[i + 1]));
  }

  const cumTime = new Array(coordinates.length).fill(0);
  const cumDist = new Array(coordinates.length).fill(0);
  for (let i = 0; i < segDist.length; i++) {
    cumDist[i + 1] = cumDist[i] + segDist[i];
  }

  for (const step of steps) {
    const [wpStart, wpEnd] = step.way_points;
    if (wpEnd <= wpStart) continue;
    let stepDistSum = 0;
    for (let i = wpStart; i < wpEnd; i++) stepDistSum += segDist[i];

    for (let i = wpStart; i < wpEnd; i++) {
      const fraction = stepDistSum > 0 ? segDist[i] / stepDistSum : 1 / (wpEnd - wpStart);
      cumTime[i + 1] = cumTime[i] + step.duration * fraction;
    }
  }

  return { cumTime, cumDist };
}

/**
 * Shared per-route profile (coordinates + cumulative time/distance at each
 * coordinate) used by checkpoint generation, map-path decimation, and
 * projecting a manually-added checkpoint onto the route.
 */
export function computeRouteProfile(routeFeature) {
  const coordinates = routeFeature.geometry.coordinates;
  const segment = routeFeature.properties.segments[0];
  const steps = segment.steps ?? [];
  const { cumTime, cumDist } = buildCumulativeArrays(coordinates, steps);
  return { coordinates, cumTime, cumDist };
}

function interpolateAt({ coordinates, cumTime, cumDist }, targetSeconds) {
  let i = 0;
  while (i < cumTime.length - 2 && cumTime[i + 1] < targetSeconds) i++;

  const t0 = cumTime[i];
  const t1 = cumTime[i + 1];
  const fraction = t1 > t0 ? (targetSeconds - t0) / (t1 - t0) : 0;

  const [lon0, lat0] = coordinates[i];
  const [lon1, lat1] = coordinates[i + 1];
  return {
    lon: lerp(lon0, lon1, fraction),
    lat: lerp(lat0, lat1, fraction),
    distanceMeters: lerp(cumDist[i], cumDist[i + 1], fraction),
  };
}

/**
 * Generates checkpoints evenly spread across the whole drive, always
 * including start and destination. The checkpoint count is clamped so short
 * trips still get a handful of stops and long trips don't bunch every
 * checkpoint into the first few hours with one big jump to the destination.
 */
export function buildCheckpoints(routeFeature) {
  const profile = computeRouteProfile(routeFeature);
  const { coordinates, cumTime, cumDist } = profile;
  const totalDuration = cumTime[cumTime.length - 1];
  const totalDistance = cumDist[cumDist.length - 1];

  const roughCount = Math.round(totalDuration / TARGET_INTERVAL_SECONDS) + 1;
  const numCheckpoints = Math.min(MAX_CHECKPOINTS, Math.max(MIN_CHECKPOINTS, roughCount));
  const intervalSeconds = totalDuration / (numCheckpoints - 1);

  const checkpoints = [];
  for (let idx = 0; idx < numCheckpoints; idx++) {
    const isStart = idx === 0;
    const isEnd = idx === numCheckpoints - 1;
    const targetSeconds = isEnd ? totalDuration : idx * intervalSeconds;

    const { lat, lon, distanceMeters } = isStart
      ? { lat: coordinates[0][1], lon: coordinates[0][0], distanceMeters: 0 }
      : isEnd
        ? {
            lat: coordinates[coordinates.length - 1][1],
            lon: coordinates[coordinates.length - 1][0],
            distanceMeters: totalDistance,
          }
        : interpolateAt(profile, targetSeconds);

    checkpoints.push({
      lat,
      lon,
      etaSeconds: Math.round(targetSeconds),
      distanceMeters: Math.round(distanceMeters),
      isStart,
      isEnd,
    });
  }

  return { checkpoints, totalDuration, totalDistance };
}

const MAX_ROUTE_POINTS = 300;

/**
 * Thins the route geometry down for the map, annotating each remaining
 * point with its ETA/distance so the client can project a manually-added
 * checkpoint onto the nearest point without another routing round trip.
 */
export function decimateRoute(routeFeature) {
  const profile = computeRouteProfile(routeFeature);
  const { coordinates, cumTime, cumDist } = profile;

  const indices = [];
  if (coordinates.length <= MAX_ROUTE_POINTS) {
    for (let i = 0; i < coordinates.length; i++) indices.push(i);
  } else {
    const step = coordinates.length / MAX_ROUTE_POINTS;
    for (let i = 0; i < MAX_ROUTE_POINTS; i++) indices.push(Math.floor(i * step));
    indices.push(coordinates.length - 1);
  }

  return indices.map((i) => ({
    lat: coordinates[i][1],
    lon: coordinates[i][0],
    etaSeconds: Math.round(cumTime[i]),
    distanceMeters: Math.round(cumDist[i]),
  }));
}
