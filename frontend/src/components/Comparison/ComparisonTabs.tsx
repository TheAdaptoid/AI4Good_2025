import { useCallback } from 'react';
import { SearchBar } from '../SearchBar/SearchBar';
import type { HorizonScore } from '../../types';
import './ComparisonTabs.css';

interface ComparisonTabsProps {
  activeTab: 'location1' | 'location2';
  onTabChange: (tab: 'location1' | 'location2') => void;
  location1: HorizonScore | null;
  location2: HorizonScore | null;
  onSearch: (queryOrZip: string, tab: 'location1' | 'location2', geocodeInfo?: { address: string; lat: number; lng: number }) => void;
  onClear: (tab: 'location1' | 'location2') => void;
  isLoading: boolean;
  error: string | null;
  mapsLoaded?: boolean;
  geocoder?: google.maps.Geocoder | null;
  filterType?: 'zip' | 'city' | 'county' | null; // Restrict search to specific type
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
  mapsLoaded = false,
  filterType = null
}: ComparisonTabsProps) {
  const handleSearch = useCallback((queryOrZip: string, geocodeInfo?: { address: string; lat: number; lng: number }) => {
    onSearch(queryOrZip, activeTab, geocodeInfo);
  }, [onSearch, activeTab]);

  const handleClearTab = useCallback((tab: 'location1' | 'location2') => {
    onClear(tab);
  }, [onClear]);

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
                  onClick={() => handleClearTab('location1')}
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="comparison-search-wrapper">
                <SearchBar
                  onSearch={handleSearch}
                  isLoading={isLoading}
                  mapsLoaded={mapsLoaded}
                  error={error}
                  filterType={filterType}
                />
              </div>
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
                  onClick={() => handleClearTab('location2')}
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="comparison-search-wrapper">
                <SearchBar
                  onSearch={handleSearch}
                  isLoading={isLoading}
                  mapsLoaded={mapsLoaded}
                  error={error}
                  filterType={filterType}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
