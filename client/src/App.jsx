import { useState } from "react";
import TripForm from "./components/TripForm";
import AddressInput from "./components/AddressInput";
import Timeline from "./components/Timeline";
import HazardsPanel from "./components/HazardsPanel";
import RoutePanel from "./components/RoutePanel";
import RouteMap from "./components/RouteMap";
import BottomSheet from "./components/BottomSheet";
import SegmentedControl from "./components/SegmentedControl";
import StopDetail from "./components/StopDetail";
import { planTrip } from "./lib/tripApi";
import { fetchCheckpointWeather } from "./lib/weather";
import { buildCustomCheckpoint } from "./lib/customCheckpoint";
import { SEATTLE_FALLBACK } from "./lib/constants";
import "./App.css";

const SEARCH_PEEK_HEIGHT = 96;
const RESULTS_PEEK_HEIGHT = 230;

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trip, setTrip] = useState(null);
  const [departureDate, setDepartureDate] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [checkpoints, setCheckpoints] = useState(null);

  // 'search' = planning a trip (map preview + form in the sheet); 'results' = trip loaded.
  const [mode, setMode] = useState("search");
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [previewPins, setPreviewPins] = useState({ start: null, end: null });

  const [activeTab, setActiveTab] = useState("timeline");
  const [detailCheckpoint, setDetailCheckpoint] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [routeNotices, setRouteNotices] = useState([]);

  const [isAddingStop, setIsAddingStop] = useState(false);
  const [showMapHint, setShowMapHint] = useState(false);
  const [isAddingStopByAddress, setIsAddingStopByAddress] = useState(false);
  const [addStopText, setAddStopText] = useState("");

  const selectedRoute = trip?.routes.find((r) => r.id === selectedRouteId) ?? null;

  async function loadWeatherForRoute(route, forDepartureDate) {
    const withWeather = await fetchCheckpointWeather(route.checkpoints, forDepartureDate);
    setCheckpoints(withWeather);
  }

  function handlePreviewPin(which, location) {
    setPreviewPins((prev) => ({ ...prev, [which]: location }));
  }

  async function handleSubmit({ startAddress, endAddress, startLocation, endLocation, departureDate: newDepartureDate }) {
    setIsLoading(true);
    setError(null);
    setTrip(null);
    setCheckpoints(null);

    try {
      const tripData = await planTrip({ startAddress, endAddress, startLocation, endLocation });
      const defaultRoute = tripData.routes.find((r) => r.isRecommended) ?? tripData.routes[0];
      await loadWeatherForRoute(defaultRoute, newDepartureDate);
      setTrip(tripData);
      setDepartureDate(newDepartureDate);
      setSelectedRouteId(defaultRoute.id);
      setRouteNotices(tripData.notices ?? []);
      setMode("results");
      setIsSheetExpanded(false);
      setActiveTab("timeline");
      setShowMapHint(true);
    } catch (err) {
      setError({ message: err.message || "Something went wrong", severity: err.severity || "system" });
    } finally {
      setIsLoading(false);
    }
  }

  function handleEditTrip() {
    if (trip) {
      setPreviewPins({
        start: { lat: trip.start.lat, lon: trip.start.lon, label: trip.start.label },
        end: { lat: trip.end.lat, lon: trip.end.lon, label: trip.end.label },
      });
    }
    setMode("search");
    setIsSheetExpanded(true);
  }

  async function handleSelectRoute(routeId) {
    const route = trip.routes.find((r) => r.id === routeId);
    if (!route || routeId === selectedRouteId) return;
    setSelectedRouteId(routeId);
    setIsLoading(true);
    try {
      await loadWeatherForRoute(route, departureDate);
    } catch (err) {
      setError({ message: err.message || "Something went wrong", severity: err.severity || "system" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddCheckpoint(lat, lon) {
    try {
      const custom = await buildCustomCheckpoint(selectedRoute.routePath, departureDate, lat, lon);
      setCheckpoints((prev) => [...prev, custom].sort((a, b) => a.etaSeconds - b.etaSeconds));
      setIsAddingStop(false);
      setShowMapHint(false);
    } catch (err) {
      setError({ message: err.message || "Couldn't add that checkpoint", severity: "user" });
    }
  }

  async function handleMoveCheckpoint(originalCp, lat, lon) {
    try {
      const moved = await buildCustomCheckpoint(selectedRoute.routePath, departureDate, lat, lon);
      const originalKey = originalCp.id ?? originalCp.etaSeconds;
      setCheckpoints((prev) =>
        [...prev.filter((cp) => (cp.id ?? cp.etaSeconds) !== originalKey), moved].sort(
          (a, b) => a.etaSeconds - b.etaSeconds
        )
      );
      setShowMapHint(false);
    } catch (err) {
      setError({ message: err.message || "Couldn't move that checkpoint", severity: "user" });
    }
  }

  function handleToggleAddMode() {
    setIsAddingStop((prev) => !prev);
  }

  function handleAddStopByAddress(loc) {
    handleAddCheckpoint(loc.lat, loc.lon);
    setIsAddingStopByAddress(false);
    setAddStopText("");
  }

  function handleDeleteCheckpoint(cpToRemove) {
    if (cpToRemove.isStart || cpToRemove.isEnd) return;
    const key = cpToRemove.id ?? cpToRemove.etaSeconds;
    setCheckpoints((prev) => prev.filter((cp) => (cp.id ?? cp.etaSeconds) !== key));
  }

  function openDetail(cp) {
    setDetailCheckpoint(cp);
    setIsDetailOpen(true);
  }

  function closeDetail() {
    setIsDetailOpen(false);
  }

  function dismissNotice(index) {
    setRouteNotices((prev) => prev.filter((_, i) => i !== index));
  }

  const arrivalDate =
    departureDate && selectedRoute
      ? new Date(departureDate.getTime() + selectedRoute.totalDurationSeconds * 1000)
      : null;
  const destinationTimezone = checkpoints?.find((cp) => cp.isEnd)?.timezone;

  const hazardCount = checkpoints ? checkpoints.filter((cp) => cp.hazard).length : 0;
  const hasResults = mode === "results" && trip && selectedRoute && checkpoints;
  const previewMarkers = [previewPins.start, previewPins.end].filter(Boolean);

  return (
    <div className="app-shell">
      <div className="map-hero">
        {hasResults && (
          <button className="hero-edit-chip" onClick={handleEditTrip}>
            Edit trip
          </button>
        )}
        <RouteMap
          routePath={hasResults ? selectedRoute.routePath : undefined}
          checkpoints={hasResults ? checkpoints : []}
          onAddCheckpoint={hasResults ? handleAddCheckpoint : undefined}
          onMoveCheckpoint={hasResults ? handleMoveCheckpoint : undefined}
          isAddingStop={isAddingStop}
          onToggleAddMode={handleToggleAddMode}
          previewMarkers={mode === "search" ? previewMarkers : []}
          initialCenter={[SEATTLE_FALLBACK.lat, SEATTLE_FALLBACK.lon]}
          initialZoom={11}
        />

        {hasResults && showMapHint && !isAddingStop && (
          <div className="map-hint-banner">
            <span>Drag any stop to move it · Tap + to add one</span>
            <button type="button" aria-label="Dismiss" onClick={() => setShowMapHint(false)}>
              ×
            </button>
          </div>
        )}
      </div>

      <BottomSheet
        isExpanded={isSheetExpanded}
        onExpandedChange={setIsSheetExpanded}
        peekHeight={mode === "search" ? SEARCH_PEEK_HEIGHT : RESULTS_PEEK_HEIGHT}
      >
        {mode === "results" ? (
          <div className="sheet-head">
            <div className="route-row">
              <h2>
                {trip.start.label} → {trip.end.label}
              </h2>
            </div>
            <p className="trip-sub">
              {Math.round(selectedRoute.totalDistanceMeters / 1609.34)} mi ·{" "}
              {Math.floor(selectedRoute.totalDurationSeconds / 3600)}h{" "}
              {Math.round((selectedRoute.totalDurationSeconds % 3600) / 60)}m drive
              {arrivalDate && (
                <>
                  {" "}
                  · arrive around{" "}
                  {arrivalDate.toLocaleString(undefined, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: destinationTimezone,
                  })}
                </>
              )}
            </p>

            <SegmentedControl
              activeId={activeTab}
              onChange={setActiveTab}
              options={[
                { id: "timeline", label: "Timeline" },
                { id: "hazards", label: "Hazards", badge: hazardCount > 0 ? hazardCount : null },
                { id: "route", label: "Route" },
              ]}
            />
          </div>
        ) : (
          <div className={`sheet-head search-head${isSheetExpanded ? " expanded" : ""}`}>
            <button type="button" className="search-pill" onClick={() => setIsSheetExpanded(true)}>
              <span className="pin-icon">📍</span>
              Where&rsquo;s the road trip? <strong>Tap to plan one</strong>
            </button>
            <div className="search-sheet-title">
              <h2>Roadtrip Weather Forecast</h2>
              <p>Weather and road conditions, timed to your drive</p>
            </div>
          </div>
        )}

        <div className="panels">
          {/* Kept mounted (just hidden) so field values and geolocation state survive
              toggling back and forth between planning and results. */}
          <div className="search-body" hidden={mode !== "search"}>
            <TripForm onSubmit={handleSubmit} isLoading={isLoading} onPreviewPin={handlePreviewPin} />
          </div>

          {hasResults && (
            <>
              <div className={`panel${activeTab === "timeline" ? " active" : ""}`}>
                <Timeline checkpoints={checkpoints} onSelect={openDetail} onDelete={handleDeleteCheckpoint} />
              </div>
              <div className={`panel${activeTab === "hazards" ? " active" : ""}`}>
                <HazardsPanel checkpoints={checkpoints} onSelect={openDetail} />
              </div>
              <div className={`panel${activeTab === "route" ? " active" : ""}`}>
                <RoutePanel
                  route={selectedRoute}
                  checkpointCount={checkpoints.length}
                  arrivalDate={arrivalDate}
                  allRoutes={trip.routes}
                  selectedRouteId={selectedRouteId}
                  onSelectRoute={handleSelectRoute}
                  departureDate={departureDate}
                  destinationTimezone={destinationTimezone}
                />
              </div>
            </>
          )}
        </div>

        {mode === "results" &&
          (isAddingStopByAddress ? (
            <div className="action-bar add-stop-by-address">
              <AddressInput
                id="add-stop"
                label="Add waypoint"
                placeholder="Search for a town or landmark along the way"
                value={addStopText}
                onChange={setAddStopText}
                onSelectLocation={handleAddStopByAddress}
                focusPoint={trip ? { lat: trip.start.lat, lon: trip.start.lon } : undefined}
                countryCode={trip?.start?.countryCode}
              />
              <button
                type="button"
                className="cta secondary"
                onClick={() => {
                  setIsAddingStopByAddress(false);
                  setAddStopText("");
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="action-bar">
              <button className="cta" onClick={handleEditTrip}>
                Edit trip
              </button>
              <button className="cta secondary" onClick={() => setIsAddingStopByAddress(true)}>
                + Add waypoint
              </button>
            </div>
          ))}
      </BottomSheet>

      <StopDetail checkpoint={detailCheckpoint} isOpen={isDetailOpen} onClose={closeDetail} />

      {hasResults && routeNotices.length > 0 && (
        <div className="route-notices" style={{ position: "absolute", top: 60, left: 16, right: 16, zIndex: 65 }}>
          {routeNotices.map((notice, i) => (
            <div key={notice} className="route-notice-banner">
              <span>{notice}</span>
              <button type="button" aria-label="Dismiss" onClick={() => dismissNotice(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          className={`error-banner severity-${error.severity}`}
          role="alert"
          style={{ position: "absolute", top: 60, left: 16, right: 16, zIndex: 70 }}
        >
          <span className="error-banner-icon">{error.severity === "system" ? "⚠" : "ⓘ"}</span>
          <span className="error-banner-message">{error.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
