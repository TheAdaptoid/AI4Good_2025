import { useState } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  mapsLoaded?: boolean;
}

export function SearchBar({ onSearch, isLoading = false, mapsLoaded = false }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if maps are loaded before searching
    if (!mapsLoaded) {
      if (import.meta.env.DEV) {
        console.warn('Maps not loaded yet. Please wait before searching.');
      }
      alert('Please wait for the map to load before searching.');
      return;
    }
    
    const trimmedQuery = query.trim();
    
    if (trimmedQuery) {
      if (import.meta.env.DEV) {
        console.log('Triggering search for:', trimmedQuery);
      }
      onSearch(trimmedQuery);
    } else {
      if (import.meta.env.DEV) {
        console.warn('No search query provided');
      }
      // Silently ignore empty searches
    }
  };

  return (
    <div className="search-bar-container">
      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter address or zip code"
          className="search-input"
          disabled={isLoading || !mapsLoaded}
          onKeyDown={(e) => {
            // Trigger search on Enter key
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
        />
        <button 
          type="submit"
          className="search-button"
          disabled={isLoading || !mapsLoaded || !query.trim()}
          title={!mapsLoaded ? 'Please wait for the map to load' : !query.trim() ? 'Please enter an address or zip code' : undefined}
        >
          {isLoading ? '...' : 'Search'}
        </button>
      </form>
    </div>
  );
}
