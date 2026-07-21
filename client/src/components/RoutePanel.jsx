function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatMiles(meters) {
  return `${Math.round(meters / 1609.34)} mi`;
}

function formatClockTime(date) {
  return date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function RoutePanel({ route, checkpointCount, arrivalDate, allRoutes, selectedRouteId, onSelectRoute, departureDate }) {
  return (
    <div className="route-panel">
      <div className="stat-grid">
        <div className="stat">
          <div className="k">Distance</div>
          <div className="v">{formatMiles(route.totalDistanceMeters)}</div>
        </div>
        <div className="stat">
          <div className="k">Drive time</div>
          <div className="v">{formatDuration(route.totalDurationSeconds)}</div>
        </div>
        <div className="stat">
          <div className="k">Arrival</div>
          <div className="v">{arrivalDate ? formatClockTime(arrivalDate) : "—"}</div>
        </div>
        <div className="stat">
          <div className="k">Stops</div>
          <div className="v">{checkpointCount}</div>
        </div>
      </div>

      {allRoutes.length > 1 ? (
        <div className="route-options">
          {allRoutes.map((r) => {
            const arrival = new Date(departureDate.getTime() + r.totalDurationSeconds * 1000);
            return (
              <button
                key={r.id}
                type="button"
                className={`route-option${r.id === selectedRouteId ? " selected" : ""}`}
                onClick={() => onSelectRoute(r.id)}
              >
                {r.isRecommended && <span className="route-option-badge">Fastest</span>}
                <div className="route-option-time">{formatDuration(r.totalDurationSeconds)}</div>
                <div className="route-option-detail">
                  {formatMiles(r.totalDistanceMeters)} · arrive {formatClockTime(arrival)}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="route-note">
          Only one route came back for this trip — OpenRouteService's free alternates only cover drives under
          roughly 60 miles, so most road trips get a single best route rather than a Google Maps–style picker.
        </p>
      )}
    </div>
  );
}
