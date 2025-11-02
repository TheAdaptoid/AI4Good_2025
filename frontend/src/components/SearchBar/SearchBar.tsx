import { useState, useEffect, useRef, useCallback } from 'react';
import './SearchBar.css';
import { getAutocompleteSuggestions, AutocompleteOption, findLocationFromQuery } from '../../utils/localAutocomplete';

interface SearchBarProps {
  onSearch: (zipCode: string, geocodeInfo?: { address: string; lat: number; lng: number }) => void;
  isLoading?: boolean;
  mapsLoaded?: boolean;
  error?: string | null;
  onErrorClear?: () => void;
  filterType?: 'zip' | 'city' | 'county' | null; // Restrict autocomplete to specific type
  placeholder?: string; // Custom placeholder text
}

export function SearchBar({ 
  onSearch, 
  isLoading = false, 
  mapsLoaded = false,
  error = null,
  onErrorClear,
  filterType = null,
  placeholder
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AutocompleteOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AutocompleteOption | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // No longer using Autocomplete widget - using AutocompleteService instead
  const isSelectingSuggestionRef = useRef(false); // Flag to prevent clearing selection during programmatic selection

  // Helper function to get suggestion display label (needed by loadSuggestions)
  const getSuggestionLabel = useCallback((suggestion: AutocompleteOption) => {
    switch (suggestion.type) {
      case 'zip':
        return suggestion.zipCode || suggestion.display;
      case 'city':
        return suggestion.city || suggestion.display;
      case 'county':
        return suggestion.county || suggestion.display;
      case 'address':
        return suggestion.address || suggestion.display;
      default:
        return suggestion.display;
    }
  }, []);

  // Load autocomplete suggestions as user types (includes zip/city/county/address)
  const loadSuggestions = useCallback(async (searchQuery: string) => {
    // Don't load suggestions if we're programmatically selecting a suggestion
    if (isSelectingSuggestionRef.current) {
      return;
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      // Don't clear selectedSuggestion if query is empty - user might have just selected
      // Only clear if query was manually cleared
      if (!selectedSuggestion) {
        setSelectedSuggestion(null);
      }
      return;
    }

    try {
      const results = await getAutocompleteSuggestions(searchQuery, 8);
      setSuggestions(results);
      // Only show suggestions if query has changed from selected suggestion
      // This prevents suggestions from reappearing after selection
      const hasSelectedSuggestion = selectedSuggestion !== null;
      const queryMatchesSelection = hasSelectedSuggestion && 
        searchQuery.trim().toLowerCase() === getSuggestionLabel(selectedSuggestion).trim().toLowerCase();
      
      if (queryMatchesSelection) {
        // Query matches selected suggestion - keep suggestions hidden and selection preserved
        setShowSuggestions(false);
        setSuggestions([]); // Clear suggestions array
        // Don't clear selectedSuggestion - keep it selected
      } else {
        // Query doesn't match selection - show suggestions and clear selection
        setShowSuggestions(results.length > 0);
        setSelectedIndex(-1);
        // Clear selected suggestion when new suggestions load (user is typing something new)
        setSelectedSuggestion(null);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('Failed to load autocomplete suggestions:', err);
      }
      setSuggestions([]);
      setShowSuggestions(false);
      // Don't clear selectedSuggestion on error
    }
  }, [selectedSuggestion, getSuggestionLabel, filterType]);

  // No longer initializing Autocomplete widget - using AutocompleteService via localAutocomplete instead

  // Debounce autocomplete search for local suggestions
  // Skip if we're programmatically selecting a suggestion (don't reload suggestions)
  useEffect(() => {
    // Don't load suggestions if we're programmatically selecting a suggestion
    if (isSelectingSuggestionRef.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        // Double-check flag hasn't changed during debounce delay
        if (!isSelectingSuggestionRef.current) {
          loadSuggestions(query);
        }
      }, 200); // 200ms debounce
    } else {
      // Only clear suggestions if not selecting (to avoid clearing during selection)
      if (!isSelectingSuggestionRef.current) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, loadSuggestions]);

  // Clear error and selected suggestion when query changes manually
  useEffect(() => {
    if (localError || error) {
      setLocalError(null);
      if (onErrorClear) {
        onErrorClear();
      }
    }
    // If query changes and it doesn't match selected suggestion, clear selection
    // But don't clear if we're programmatically selecting a suggestion
    // Use case-insensitive comparison to handle case differences
    if (!isSelectingSuggestionRef.current && selectedSuggestion) {
      const suggestionLabel = getSuggestionLabel(selectedSuggestion);
      const queryTrimmed = query.trim();
      const labelTrimmed = suggestionLabel.trim();
      
      // Only clear if they're significantly different (case-insensitive comparison)
      if (queryTrimmed.toLowerCase() !== labelTrimmed.toLowerCase()) {
        setSelectedSuggestion(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedSuggestion]);

  // Show error from parent if provided
  useEffect(() => {
    if (error) {
      setLocalError(error);
    } else if (!error && localError && !query.trim()) {
      // Clear local error when parent error is cleared and query is empty
      setLocalError(null);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Hide suggestions
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // Clear any previous errors
    setLocalError(null);
    if (onErrorClear) {
      onErrorClear();
    }
    
    // Check if maps are loaded before searching
    if (!mapsLoaded) {
      const errorMsg = 'Please wait for the map to load before searching.';
      setLocalError(errorMsg);
      return;
    }
    
    // Only allow search if a suggestion is selected
    if (!selectedSuggestion) {
      setLocalError('Please select a location from the suggestions list.');
      return;
    }
    
    // Perform the search with the selected suggestion
    const suggestion = selectedSuggestion;
    
    // For city/county searches, pass the city/county name directly
    // The Dashboard will handle rendering all boundaries
    if (suggestion.type === 'city' || suggestion.type === 'county') {
      // Pass the city/county name directly - Dashboard will handle it
      onSearch(suggestion.value);
    } else if (suggestion.type === 'address') {
      // For addresses selected from Google autocomplete, always use zip code if available
      // This ensures we use the exact location from autocomplete, not a re-geocoded match
      if (suggestion.zipCode) {
        // Use zip code directly - this ensures accurate location matching
        onSearch(suggestion.zipCode);
      } else {
        // If no zip code, pass the full address string
        // Dashboard will geocode it, but this is less ideal
        onSearch(suggestion.address || suggestion.value);
      }
    } else {
      // For zip codes, use the zip code
      const location = await findLocationFromQuery(suggestion.value);
      if (location && location.zipCode) {
        // Use the zip code for the search
        onSearch(location.zipCode);
      } else if (suggestion.zipCode) {
        // Fallback to suggestion's zip code
        onSearch(suggestion.zipCode);
      } else {
        // Try searching with the suggestion value
        onSearch(suggestion.value);
      }
    }
  };

  // Handle suggestion selection - just fills the search bar, doesn't trigger search
  const handleSuggestionSelect = useCallback((suggestion: AutocompleteOption) => {
    // Set flag to prevent useEffect from clearing selection and reloading suggestions
    isSelectingSuggestionRef.current = true;
    
    // Clear any pending debounced suggestions
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    const displayName = getSuggestionLabel(suggestion);
    
    // Clear suggestions immediately to prevent them from reappearing
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // Set state updates - set selectedSuggestion first, then query
    // This ensures the selection is preserved
    setSelectedSuggestion(suggestion);
    setLocalError(null);
    if (onErrorClear) {
      onErrorClear();
    }
    
    // Set query last, after selectedSuggestion is set
    // Use a small delay to ensure selectedSuggestion state is updated first
    setTimeout(() => {
      setQuery(displayName);
      
      // Keep flag set longer to prevent useEffect from clearing/reloading during the query update
      // Keep it set long enough to prevent the debounced suggestions from triggering
      setTimeout(() => {
        isSelectingSuggestionRef.current = false;
      }, 500); // Increased to 500ms to cover debounce delay + some buffer
    }, 0);
    
    // Don't trigger search - user must click search button
  }, [onErrorClear]);

  // Handle keyboard navigation in suggestions
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // If Enter is pressed while suggestions are shown, select the highlighted suggestion
    if (e.key === 'Enter') {
      if (showSuggestions && suggestions.length > 0) {
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          // Just fill the search bar with the suggestion, don't trigger search
          handleSuggestionSelect(suggestions[selectedIndex]);
          return;
        }
      }
      // If Enter is pressed without a selection or after selecting, allow form submit
      // The form submit handler will check if a suggestion is selected
      return;
    }

    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        setSelectedSuggestion(null);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, handleSuggestionSelect]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const displayError = localError || error;

  const getSuggestionTypeLabel = (type: AutocompleteOption['type']) => {
    switch (type) {
      case 'zip':
        return 'ZIP';
      case 'city':
        return 'City';
      case 'county':
        return 'County';
      case 'address':
        return 'Address';
    }
  };

  return (
    <div className="search-bar-container">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={placeholder || (filterType 
              ? `Type to search ${filterType === 'zip' ? 'zip code' : filterType === 'city' ? 'city' : 'county'} in Florida`
              : "Type to search zip code, city, county, or address in Florida")}
            className={`search-input ${displayError ? 'error' : ''}`}
            disabled={isLoading || !mapsLoaded}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          {/* All suggestions (zip codes, cities, counties, addresses) in one dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div 
              ref={suggestionsRef} 
              className="autocomplete-suggestions"
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.type}-${suggestion.value}-${index}`}
                  className={`autocomplete-suggestion ${
                    index === selectedIndex ? 'selected' : ''
                  }`}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="suggestion-type">{getSuggestionTypeLabel(suggestion.type)}</span>
                  <span className="suggestion-value">{getSuggestionLabel(suggestion)}</span>
                  {suggestion.city && suggestion.type !== 'city' && suggestion.type !== 'county' && (
                    <span className="suggestion-meta">{suggestion.city}</span>
                  )}
                  {/* Don't show meta for counties - the value already shows the county name */}
                </div>
              ))}
            </div>
          )}
          {displayError && (
            <div className="search-error-message" role="alert">
              {displayError}
            </div>
          )}
        </div>
        <button 
          type="submit"
          className="search-button"
          disabled={isLoading || !mapsLoaded || !selectedSuggestion}
          title={!mapsLoaded ? 'Please wait for the map to load' : !selectedSuggestion ? 'Please select a location from the suggestions' : undefined}
        >
          {isLoading ? '...' : 'Search'}
        </button>
      </form>
    </div>
  );
}

