import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PREVIEW_SINGLE_PIN_ZOOM = 10;

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [24, 24] });
    }
  }, [positions, map]);
  return null;
}

function RecenterOnPreview({ positions }) {
  const map = useMap();
  const key = positions.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], PREVIEW_SINGLE_PIN_ZOOM);
    } else if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [48, 48] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Active only while "add a stop" mode is armed — the next tap places a stop there. */
function MapClickToAdd({ onAdd }) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * A small round badge showing the checkpoint's weather emoji (or a hazard
 * warning, which takes priority) so the map reads as a weather-along-the-
 * route strip at a glance, not just a row of identical dots.
 */
function checkpointIcon(cp) {
  const isEndpoint = cp.isStart || cp.isEnd;
  const size = isEndpoint ? 34 : 28;
  const borderColor = cp.hazard ? "#ea580c" : cp.isCustom ? "#0ea5e9" : "#aa3bff";
  const emoji = cp.hazard ? "⚠️" : cp.condition?.icon ?? "📍";

  return L.divIcon({
    html: `<div class="checkpoint-marker-badge" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px;border-color:${borderColor};">${emoji}</div>`,
    className: "checkpoint-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * Wraps a single checkpoint Marker so its icon and event-handler objects stay
 * referentially stable across unrelated re-renders (e.g. the sheet dragging).
 * Leaflet's Marker keeps an imperative reference to its own DOM node while a
 * drag gesture is in progress; if react-leaflet swaps in a brand-new icon
 * object mid-drag (which it will if `icon={...}` is a fresh object every
 * render), Leaflet ends up dragging a detached node and throws trying to
 * read its transform. Memoizing avoids ever swapping the node during a drag.
 */
function CheckpointMarker({ cp, isEndpoint, onMoveCheckpoint }) {
  const isDraggable = !isEndpoint && !!onMoveCheckpoint;

  const icon = useMemo(
    () => checkpointIcon(cp),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cp.hazard, cp.isCustom, cp.isStart, cp.isEnd, cp.condition?.icon]
  );

  const eventHandlers = useMemo(() => {
    if (!isDraggable) return undefined;
    return {
      dragend: (e) => {
        const { lat, lng } = e.target.getLatLng();
        onMoveCheckpoint(cp, lat, lng);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraggable, onMoveCheckpoint, cp]);

  return (
    <Marker position={[cp.lat, cp.lon]} icon={icon} draggable={isDraggable} eventHandlers={eventHandlers}>
      <Popup>
        <strong>{cp.name}</strong>
        <br />
        {cp.condition.icon} {cp.condition.label}, {Math.round(cp.temperatureF)}°F
        {isDraggable && (
          <>
            <br />
            <em>Drag to move along the route</em>
          </>
        )}
      </Popup>
    </Marker>
  );
}

/**
 * Renders either the planned route (polyline + checkpoint markers) or, before
 * a trip exists, a live preview of the start/destination pins the user is
 * picking — so the map is always the thing on screen, never a blank box.
 */
export default function RouteMap({
  routePath,
  checkpoints,
  onAddCheckpoint,
  onMoveCheckpoint,
  isAddingStop = false,
  onToggleAddMode,
  previewMarkers = [],
  initialCenter,
  initialZoom = 4,
}) {
  const hasRoute = routePath && routePath.length > 0;

  const routePositions = hasRoute ? routePath.map((p) => [p.lat, p.lon]) : [];
  const previewPositions = previewMarkers.map((m) => [m.lat, m.lon]);

  const mapCenter = hasRoute
    ? routePositions[0]
    : previewPositions[0] ?? initialCenter ?? [39.8283, -98.5795];
  const mapZoom = hasRoute ? 6 : previewPositions.length > 0 ? PREVIEW_SINGLE_PIN_ZOOM : initialZoom;

  return (
    <div className="route-map">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasRoute && <Polyline positions={routePositions} pathOptions={{ color: "#aa3bff", weight: 4 }} />}

        {hasRoute &&
          checkpoints.map((cp) => (
            <CheckpointMarker
              key={cp.id ?? cp.etaSeconds}
              cp={cp}
              isEndpoint={cp.isStart || cp.isEnd}
              onMoveCheckpoint={onMoveCheckpoint}
            />
          ))}

        {!hasRoute &&
          previewMarkers.map((m, i) => (
            <CircleMarker
              key={`${m.lat},${m.lon}`}
              center={[m.lat, m.lon]}
              radius={8}
              pathOptions={{ color: "#fff", fillColor: "#aa3bff", fillOpacity: 0.9, weight: 2 }}
            >
              <Popup>{m.label ?? (i === 0 ? "Start" : "Destination")}</Popup>
            </CircleMarker>
          ))}

        {hasRoute && isAddingStop && onAddCheckpoint && <MapClickToAdd onAdd={onAddCheckpoint} />}
        {hasRoute && <FitBounds positions={routePositions} />}
        {!hasRoute && <RecenterOnPreview positions={previewPositions} />}
      </MapContainer>

      {hasRoute && isAddingStop && (
        <div className="map-add-instruction">
          <span>Tap the map where you'd like to stop</span>
          <button type="button" onClick={onToggleAddMode}>
            Cancel
          </button>
        </div>
      )}

      {hasRoute && onAddCheckpoint && (
        <button
          className={`map-add-stop${isAddingStop ? " armed" : ""}`}
          onClick={onToggleAddMode}
          aria-label={isAddingStop ? "Cancel adding a waypoint" : "Add waypoint"}
          aria-pressed={isAddingStop}
        >
          {isAddingStop ? "×" : "+"}
        </button>
      )}
    </div>
  );
}
