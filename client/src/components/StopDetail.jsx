function formatEta(date) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHour(date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric" });
}

export default function StopDetail({ checkpoint, isOpen, onClose }) {
  if (!checkpoint) return null;
  const cp = checkpoint;

  return (
    <div className={`detail-overlay${isOpen ? " open" : ""}`} aria-hidden={!isOpen}>
      <div className="detail-topbar">
        <button className="detail-close" onClick={onClose} aria-label="Back to timeline">
          ⌄
        </button>
        <span className="detail-eyebrow">Full forecast</span>
        <span style={{ width: 30 }} />
      </div>

      <div className="detail-hero">
        <div className="detail-icon">{cp.condition.icon}</div>
        <div className="detail-temp">{Math.round(cp.temperatureF)}°</div>
        <div className="detail-cond">{cp.condition.label}</div>
        <div className="detail-name">{cp.name}</div>
        <div className="detail-eta">Est. arrival {formatEta(cp.etaDate)}</div>
      </div>

      {cp.hazard && (
        <div className="detail-hazard">
          <span className="hazard-stripe" />
          <div>
            <strong>Flagged as hazardous</strong>
            <span>{cp.hazardReasons.join(", ")}</span>
          </div>
        </div>
      )}

      <div className="detail-hourly">
        {cp.hourlyWindow.map((h) => (
          <div key={h.time.toISOString()} className={`hour-col${h.isTarget ? " now" : ""}`}>
            <span className="hour-label">{h.isTarget ? "Now" : formatHour(h.time)}</span>
            <span className="hour-icon">{h.condition.icon}</span>
            <span className="hour-temp">{Math.round(h.temperatureF)}°</span>
          </div>
        ))}
      </div>

      <div className="detail-metrics">
        <div className="stat">
          <div className="k">Feels like</div>
          <div className="v">{Math.round(cp.feelsLikeF)}°</div>
        </div>
        <div className="stat">
          <div className="k">Wind</div>
          <div className="v">{Math.round(cp.windSpeedMph)} mph</div>
        </div>
        <div className="stat">
          <div className="k">Precip chance</div>
          <div className="v">{Math.round(cp.precipitationProbability)}%</div>
        </div>
        <div className="stat">
          <div className="k">Humidity</div>
          <div className="v">{Math.round(cp.humidity)}%</div>
        </div>
      </div>
    </div>
  );
}
