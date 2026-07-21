export default function HazardsPanel({ checkpoints, onSelect }) {
  const hazardous = checkpoints.filter((cp) => cp.hazard);

  return (
    <div className="hazards-panel">
      {hazardous.map((cp) => (
        <button key={cp.id ?? cp.etaSeconds} type="button" className="hazard-card" onClick={() => onSelect(cp)}>
          <span className="hazard-stripe" />
          <span className="hazard-card-body">
            <strong>{cp.name}</strong>
            <span>{cp.hazardReasons.join(", ")}</span>
          </span>
        </button>
      ))}
      {hazardous.length === 0 && (
        <p className="hazard-empty-note">No hazards flagged along this route — nothing crosses the wind, precipitation, or winter-weather thresholds.</p>
      )}
    </div>
  );
}
