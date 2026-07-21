export default function SegmentedControl({ options, activeId, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={opt.id === activeId}
          className={opt.id === activeId ? "active" : ""}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
          {opt.badge != null && <span className="segmented-badge">·{opt.badge}</span>}
        </button>
      ))}
    </div>
  );
}
