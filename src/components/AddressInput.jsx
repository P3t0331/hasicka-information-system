import React, { useState, useEffect, useRef } from 'react';

export default function AddressInput({ value, onChange, required }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const debounceTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    onChange(newVal);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (newVal.length > 2) {
      debounceTimer.current = setTimeout(() => {
        fetchSuggestions(newVal);
      }, 500); // Wait 500ms after typing stops
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const fetchSuggestions = async (query) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cz&addressdetails=1&limit=5`, {
        headers: {
          'Accept-Language': 'cs' // Prefer Czech results
        }
      });
      const data = await response.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
    }
  };

  const selectSuggestion = (suggestion) => {
    onChange(suggestion.display_name);
    setShowSuggestions(false);
  };

  return (
    <div className="input-group" style={{ position: 'relative' }} ref={wrapperRef}>
      <label className="input-label">Bydliště</label>
      <input 
        className="input-field" 
        type="text" 
        value={value} 
        onChange={handleInputChange} 
        required={required}
        autoComplete="off"
        placeholder="Začněte psát adresu..."
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          zIndex: 1000,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {suggestions.map((item) => (
            <li 
              key={item.place_id}
              onClick={() => selectSuggestion(item)}
              style={{
                padding: '0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
