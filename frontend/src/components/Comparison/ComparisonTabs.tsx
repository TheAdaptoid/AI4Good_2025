import { useState } from 'react';
import type { HorizonScore } from '../../types';
import './ComparisonTabs.css';

interface ComparisonTabsProps {
  activeTab: 'location1' | 'location2';
  onTabChange: (tab: 'location1' | 'location2') => void;
  location1: HorizonScore | null;
  location2: HorizonScore | null;
  onSearch: (query: string, tab: 'location1' | 'location2') => void;
  onClear: (tab: 'location1' | 'location2') => void;
  isLoading: boolean;
  error: string | null;
  mapsLoaded?: boolean;
}

export function ComparisonTabs({
  activeTab,
  onTabChange,
  location1,
  location2,
  onSearch,
  onClear,
  isLoading,
  error,
  mapsLoaded = false
}: ComparisonTabsProps) {
  const [searchQuery1, setSearchQuery1] = useState('');
  const [searchQuery2, setSearchQuery2] = useState('');

  const handleSubmit = (e: React.FormEvent, tab: 'location1' | 'location2') => {
    e.preventDefault();
    const query = tab === 'location1' ? searchQuery1 : searchQuery2;
    if (query.trim()) {
      onSearch(query.trim(), tab);
    }
  };

  const handleClear = (tab: 'location1' | 'location2') => {
    if (tab === 'location1') {
      setSearchQuery1('');
    } else {
      setSearchQuery2('');
    }
    onClear(tab);
  };

  return (
    <div className="comparison-tabs">
      {/* Tab Buttons */}
      <div className="tab-buttons">
        <button
          className={`tab-button ${activeTab === 'location1' ? 'active' : ''}`}
          onClick={() => onTabChange('location1')}
        >
          Location 1
          {location1 && (
            <span className="tab-badge">{location1.zipCode}</span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'location2' ? 'active' : ''}`}
          onClick={() => onTabChange('location2')}
        >
          Location 2
          {location2 && (
            <span className="tab-badge">{location2.zipCode}</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'location1' && (
          <div className="tab-panel">
            {location1 ? (
              <div className="location-display">
                <div className="location-info">
                  <h4>{location1.address}</h4>
                  <div className="location-score">
                    Score: <strong>{location1.score}</strong> ({location1.scoreCategory})
                  </div>
                </div>
                <button
                  className="clear-button"
                  onClick={() => handleClear('location1')}
                >
                  Clear
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => handleSubmit(e, 'location1')} className="comparison-search-form">
                <input
                  type="text"
                  value={searchQuery1}
                  onChange={(e) => setSearchQuery1(e.target.value)}
                  placeholder="Enter zip code or address"
                  className="comparison-search-input"
                  disabled={isLoading || !mapsLoaded}
                />
                <button
                  type="submit"
                  className="comparison-search-button"
                  disabled={isLoading || !mapsLoaded || !searchQuery1.trim()}
                >
                  {isLoading ? '...' : 'Search'}
                </button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'location2' && (
          <div className="tab-panel">
            {location2 ? (
              <div className="location-display">
                <div className="location-info">
                  <h4>{location2.address}</h4>
                  <div className="location-score">
                    Score: <strong>{location2.score}</strong> ({location2.scoreCategory})
                  </div>
                </div>
                <button
                  className="clear-button"
                  onClick={() => handleClear('location2')}
                >
                  Clear
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => handleSubmit(e, 'location2')} className="comparison-search-form">
                <input
                  type="text"
                  value={searchQuery2}
                  onChange={(e) => setSearchQuery2(e.target.value)}
                  placeholder="Enter zip code or address"
                  className="comparison-search-input"
                  disabled={isLoading || !mapsLoaded}
                />
                <button
                  type="submit"
                  className="comparison-search-button"
                  disabled={isLoading || !mapsLoaded || !searchQuery2.trim()}
                >
                  {isLoading ? '...' : 'Search'}
                </button>
              </form>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}
      </div>
    </div>
  );
}
