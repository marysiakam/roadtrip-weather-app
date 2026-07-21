export async function planTrip({ startAddress, endAddress, startLocation, endLocation }) {
  const res = await fetch("/api/trip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startAddress, endAddress, startLocation, endLocation }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Couldn't plan that route — check your addresses and try again.");
    err.severity = data.severity || "system";
    throw err;
  }
  return data;
}

export async function autocompleteAddress(text, focusPoint, countryCode) {
  const params = new URLSearchParams({ text });
  if (focusPoint) {
    params.set("focusLat", String(focusPoint.lat));
    params.set("focusLon", String(focusPoint.lon));
  }
  if (countryCode) {
    params.set("country", countryCode);
  }
  try {
    const res = await fetch(`/api/autocomplete?${params.toString()}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("Autocomplete failed:", body.error || res.statusText);
      return [];
    }
    const data = await res.json();
    return data.results ?? [];
  } catch (err) {
    console.error("Autocomplete request failed:", err);
    return [];
  }
}

export async function reverseGeocode(lat, lon) {
  const res = await fetch("/api/reverse-geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) return { name: null, countryCode: null };
  const data = await res.json();
  return { name: data.name ?? null, countryCode: data.countryCode ?? null };
}
