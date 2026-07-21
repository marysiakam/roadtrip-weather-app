import { useRef, useState } from "react";

const DRAG_THRESHOLD_PX = 6;
const FLIP_THRESHOLD_PX = 70;

const DEFAULT_EXPANDED_TOP_INSET = 96;

export default function BottomSheet({
  children,
  isExpanded,
  onExpandedChange,
  peekHeight,
  expandedTopInset = DEFAULT_EXPANDED_TOP_INSET,
}) {
  const [dragPx, setDragPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef(null);

  function onPointerDown(e) {
    dragInfo.current = { startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragInfo.current) return;
    const delta = e.clientY - dragInfo.current.startY;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX) {
      dragInfo.current.moved = true;
      setIsDragging(true);
    }
    if (dragInfo.current.moved) {
      const clamped = isExpanded ? Math.max(0, delta) : Math.min(0, delta);
      setDragPx(clamped);
    }
  }

  function endDrag() {
    if (!dragInfo.current) return;
    const { moved } = dragInfo.current;
    if (moved) {
      if (isExpanded && dragPx > FLIP_THRESHOLD_PX) onExpandedChange(false);
      else if (!isExpanded && dragPx < -FLIP_THRESHOLD_PX) onExpandedChange(true);
    } else {
      onExpandedChange(!isExpanded);
    }
    dragInfo.current = null;
    setIsDragging(false);
    setDragPx(0);
  }

  const base = isExpanded ? `${expandedTopInset}px` : `calc(100% - ${peekHeight}px)`;

  return (
    <div
      className={`bottom-sheet${isDragging ? " dragging" : ""}`}
      style={{ transform: `translateY(calc(${base} + ${dragPx}px))` }}
    >
      <div
        className="sheet-handle-row"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="button"
        tabIndex={0}
        aria-label={isExpanded ? "Collapse sheet" : "Expand sheet"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onExpandedChange(!isExpanded);
        }}
      >
        <span className="sheet-handle" />
      </div>
      {children}
    </div>
  );
}
