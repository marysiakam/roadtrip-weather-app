import { useRef, useState } from "react";

function formatEta(date, timeZone) {
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function formatHour(date, timeZone) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", timeZone });
}

export default function Timeline({ checkpoints, onSelect, onDelete }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    setActiveIndex(Math.round(track.scrollLeft / track.clientWidth));
  }

  return (
    <div className="timeline-wrapper">
      <div className="timeline" ref={trackRef} onScroll={handleScroll}>
        {checkpoints.map((cp, i) => {
          const isEndpoint = cp.isStart || cp.isEnd;
          const prev = checkpoints[i - 1];
          const crossesTimezone = prev && prev.utcOffsetSeconds !== cp.utcOffsetSeconds;
          return (
            <div key={cp.id ?? cp.etaSeconds} className="checkpoint-slot">
              {crossesTimezone && (
                <div className="timezone-divider">
                  Entering {cp.timezoneAbbreviation ?? cp.timezone} time
                </div>
              )}
              <div
                className={`checkpoint${cp.hazard ? " hazard" : ""}${cp.isCustom ? " custom" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(cp)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(cp);
                }}
              >
                {cp.hazard && <span className="checkpoint-badge">⚠️ Hazard</span>}
                {cp.isCustom && <span className="checkpoint-custom-badge">Your stop</span>}
                {!isEndpoint && onDelete && (
                  <button
                    type="button"
                    className="checkpoint-remove"
                    aria-label={`Remove ${cp.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(cp);
                    }}
                  >
                    ×
                  </button>
                )}
                <div className="checkpoint-icon">{cp.condition.icon}</div>
                <div className="checkpoint-name">{cp.name}</div>
                <div className="checkpoint-eta">Est. arrival {formatEta(cp.etaDate, cp.timezone)}</div>
                <div className="checkpoint-temp">{Math.round(cp.temperatureF)}°F</div>
                <div className="checkpoint-condition">{cp.condition.label}</div>
                <div className="checkpoint-wind">💨 {Math.round(cp.windSpeedMph)} mph</div>

                {cp.cardTrend && cp.cardTrend.length > 0 && (
                  <div className="checkpoint-trend">
                    {cp.cardTrend.map((h) => (
                      <div key={h.time.toISOString()} className={`trend-hour${h.isTarget ? " now" : ""}`}>
                        <span className="trend-hour-label">
                          {h.isTarget ? (cp.isStart ? "ETD" : "ETA") : formatHour(h.time, cp.timezone)}
                        </span>
                        <span className="trend-hour-icon">{h.condition.icon}</span>
                        <span className="trend-hour-temp">{Math.round(h.temperatureF)}°</span>
                      </div>
                    ))}
                  </div>
                )}

                <span className="checkpoint-tap-hint">
                  Full forecast
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                    <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="timeline-dots">
        {checkpoints.map((cp, i) => (
          <span key={cp.id ?? cp.etaSeconds} className={`timeline-dot${i === activeIndex ? " on" : ""}`} />
        ))}
      </div>
    </div>
  );
}
