import { useEffect, useRef, useState } from "react";
import { autocompleteAddress } from "../lib/tripApi";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

export default function AddressInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  onSelectLocation,
  focusPoint,
  countryCode,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const skipNextFetchRef = useRef(false);
  const focusPointRef = useRef(focusPoint);
  focusPointRef.current = focusPoint;
  const countryCodeRef = useRef(countryCode);
  countryCodeRef.current = countryCode;

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (value.trim().length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await autocompleteAddress(value, focusPointRef.current, countryCodeRef.current);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSuggestion(suggestion) {
    skipNextFetchRef.current = true;
    onChange(suggestion.label);
    onSelectLocation?.(suggestion);
    setIsOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="field address-field" ref={containerRef}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(suggestions.length > 0)}
        autoComplete="off"
        required
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="address-suggestions">
          {suggestions.map((s) => (
            <li key={`${s.lat},${s.lon}`}>
              <button type="button" onClick={() => selectSuggestion(s)}>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
