import { useEffect, useRef, useState } from "react";
import AddressInput from "./AddressInput";
import { reverseGeocode } from "../lib/tripApi";
import { SEATTLE_FALLBACK } from "../lib/constants";

const GEOLOCATION_TIMEOUT_MS = 8000;

function defaultDepartureLocalValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

export default function TripForm({ onSubmit, isLoading, onPreviewPin }) {
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [departureLocal, setDepartureLocal] = useState(defaultDepartureLocalValue());
  const [startLocation, setStartLocation] = useState(null);
  const [startCountry, setStartCountry] = useState(null);
  // Tracks the exact label a lat/lon was resolved for, so stale coordinates never
  // get submitted if the user keeps editing the text after picking a suggestion.
  const [startSelectedLabel, setStartSelectedLabel] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [endSelectedLabel, setEndSelectedLabel] = useState(null);
  const hasSetDefaultStart = useRef(false);
  const startAddressRef = useRef(startAddress);
  startAddressRef.current = startAddress;

  useEffect(() => {
    if (hasSetDefaultStart.current) return;
    hasSetDefaultStart.current = true;

    // Only fill in the default if the user hasn't already started typing their own
    // start address while geolocation/reverse-geocoding was still resolving.
    function applyIfStillEmpty(label, lat, lon, countryCode) {
      if (startAddressRef.current !== "") return;
      setStartAddress(label);
      setStartLocation({ lat, lon, label });
      setStartSelectedLabel(label);
      setStartCountry(countryCode ?? null);
      onPreviewPin?.("start", { lat, lon, label });
    }

    if (!navigator.geolocation) {
      applyIfStillEmpty(
        SEATTLE_FALLBACK.label,
        SEATTLE_FALLBACK.lat,
        SEATTLE_FALLBACK.lon,
        SEATTLE_FALLBACK.countryCode
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { name, countryCode } = await reverseGeocode(coords.latitude, coords.longitude).catch(() => ({
          name: null,
          countryCode: null,
        }));
        applyIfStillEmpty(
          name ?? SEATTLE_FALLBACK.label,
          coords.latitude,
          coords.longitude,
          countryCode ?? SEATTLE_FALLBACK.countryCode
        );
      },
      () =>
        applyIfStillEmpty(
          SEATTLE_FALLBACK.label,
          SEATTLE_FALLBACK.lat,
          SEATTLE_FALLBACK.lon,
          SEATTLE_FALLBACK.countryCode
        ),
      { timeout: GEOLOCATION_TIMEOUT_MS }
    );
  }, [onPreviewPin]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedStart = startAddress.trim();
    const trimmedEnd = endAddress.trim();
    if (!trimmedStart || !trimmedEnd || !departureLocal) return;

    onSubmit({
      startAddress: trimmedStart,
      endAddress: trimmedEnd,
      // Only trust the resolved lat/lon if the text hasn't changed since it was
      // picked — otherwise let the server geocode the (edited) text fresh.
      startLocation: startSelectedLabel === trimmedStart ? startLocation : null,
      endLocation: endSelectedLabel === trimmedEnd ? endLocation : null,
      departureDate: new Date(departureLocal),
    });
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <AddressInput
        id="start"
        label="Start address"
        placeholder="e.g. Denver, CO"
        value={startAddress}
        onChange={setStartAddress}
        onSelectLocation={(loc) => {
          setStartLocation({ lat: loc.lat, lon: loc.lon, label: loc.label });
          setStartSelectedLabel(loc.label);
          setStartCountry(loc.countryCode ?? null);
          onPreviewPin?.("start", loc);
        }}
      />

      <AddressInput
        id="end"
        label="Destination address"
        placeholder="e.g. Salt Lake City, UT"
        value={endAddress}
        onChange={setEndAddress}
        onSelectLocation={(loc) => {
          setEndLocation({ lat: loc.lat, lon: loc.lon, label: loc.label });
          setEndSelectedLabel(loc.label);
          onPreviewPin?.("end", loc);
        }}
        focusPoint={startLocation}
        countryCode={startCountry}
      />

      <div className="field">
        <label htmlFor="departure">Leaving at</label>
        <div className="departure-row">
          <input
            id="departure"
            type="datetime-local"
            value={departureLocal}
            onChange={(e) => setDepartureLocal(e.target.value)}
            required
          />
          <button type="button" className="leave-now-button" onClick={() => setDepartureLocal(defaultDepartureLocalValue())}>
            Leave now
          </button>
        </div>
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? "Planning route..." : "Get weather along route"}
      </button>
    </form>
  );
}
