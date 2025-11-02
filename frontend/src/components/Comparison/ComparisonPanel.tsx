import { useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { SearchBar } from '../SearchBar/SearchBar';
import { ComparisonView } from './ComparisonView';
import { ChatBox } from '../Chat/ChatBox';
import { api } from '../../services/api';
import type { HorizonScore } from '../../types';
import './ComparisonPanel.css';

interface ComparisonPanelProps {
  currentScore: HorizonScore | null;
  onLocationSelect?: (zipCode: string) => void;
  mapsLoaded?: boolean;
  currentViewType?: 'zip' | 'city' | 'county';
  geocoder?: google.maps.Geocoder | null;
}

export interface ComparisonPanelHandle {
  addLocation: (location: HorizonScore) => void;
}

export const ComparisonPanel = forwardRef<ComparisonPanelHandle, ComparisonPanelProps>(({ 
  currentScore, 
  mapsLoaded = false,
  currentViewType = 'zip',
  geocoder = null
}, ref) => {
  const [comparisonLocation, setComparisonLocation] = useState<HorizonScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Expose methods to parent component for right-click handling
  useImperativeHandle(ref, () => ({
    addLocation: (location: HorizonScore) => {
      setComparisonLocation(location);
    }
  }), []);

  // Use the same search handler as main map - but restricted to currentViewType
  const handleSearchLocation = useCallback(async (
    queryOrZip: string, 
    geocodeInfo?: { address: string; lat: number; lng: number }
  ) => {
    if (!queryOrZip.trim()) {
      setError(`Please enter a ${currentViewType === 'zip' ? 'zip code' : currentViewType === 'city' ? 'city' : 'county'}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Validate that the search matches the current view type
      const { findLocationFromQuery } = await import('../../utils/localAutocomplete');
      const { isZipCode, geocodeAddress, geocodeZipCode, reverseGeocode } = await import('../../utils/geocode');
      
      let geocodeResult;
      let finalZipCode: string | null = null;

      // Validate search type matches currentViewType
      if (currentViewType === 'zip') {
        // Only allow zip code searches
        if (!isZipCode(queryOrZip) && !geocodeInfo) {
          setError('Please enter a valid zip code. The comparison search is restricted to zip codes.');
          setIsLoading(false);
          return;
        }
      } else if (currentViewType === 'city') {
        // Only allow city searches
        if (isZipCode(queryOrZip) && !geocodeInfo) {
          setError('Please enter a city name. The comparison search is restricted to cities.');
          setIsLoading(false);
          return;
        }
        // Check if it's actually a city
        if (!geocodeInfo) {
          const location = await findLocationFromQuery(queryOrZip);
          if (location && location.type !== 'city') {
            setError('Please enter a valid city name. The comparison search is restricted to cities.');
            setIsLoading(false);
            return;
          }
        }
      } else if (currentViewType === 'county') {
        // Only allow county searches
        if (isZipCode(queryOrZip) && !geocodeInfo) {
          setError('Please enter a county name. The comparison search is restricted to counties.');
          setIsLoading(false);
          return;
        }
        // Check if it's actually a county
        if (!geocodeInfo) {
          const location = await findLocationFromQuery(queryOrZip);
          if (location && location.type !== 'county') {
            setError('Please enter a valid county name. The comparison search is restricted to counties.');
            setIsLoading(false);
            return;
          }
        }
      }

      if (geocodeInfo) {
        // Use provided geocode info (from autocomplete selection)
        geocodeResult = {
          formattedAddress: geocodeInfo.address,
          zipCode: '',
          latitude: geocodeInfo.lat,
          longitude: geocodeInfo.lng,
          country: 'US'
        };
        
        // Try reverse geocoding to get zip code
        if (geocoder && geocodeInfo.lat && geocodeInfo.lng) {
          try {
            const reverseResult = await reverseGeocode(geocodeInfo.lat, geocodeInfo.lng, geocoder);
            if (reverseResult && reverseResult.zipCode) {
              finalZipCode = reverseResult.zipCode;
              geocodeResult.zipCode = finalZipCode;
            }
          } catch (err) {
            // Continue without zip code
          }
        }
      } else {
        // Normal search path - constrained by currentViewType
        if (currentViewType === 'zip' && isZipCode(queryOrZip)) {
          finalZipCode = queryOrZip.trim();
          geocodeResult = await geocodeZipCode(finalZipCode, geocoder!);
        } else if (currentViewType === 'city' || currentViewType === 'county') {
          // For city/county searches, get all zip codes and aggregate scores
          const location = await findLocationFromQuery(queryOrZip);
          if (!location || location.type !== currentViewType) {
            setError(`Unable to find the ${currentViewType}. Please enter a valid ${currentViewType} name.`);
            setIsLoading(false);
            return;
          }
          
          // Get all zip codes for the city/county
          const { getZipCodesForCity, getZipCodesForCounty } = await import('../../utils/localAutocomplete');
          const { renderCityCountyBoundaries } = await import('../../utils/geojsonBoundaries');
          
          let allZipCodes: Set<string> | null = null;
          let locationName = queryOrZip;
          
          if (currentViewType === 'city' && location.city) {
            allZipCodes = await getZipCodesForCity(location.city);
            locationName = location.city;
          } else if (currentViewType === 'county') {
            // Try getZipCodesForCounty first
            if (location.county) {
              allZipCodes = await getZipCodesForCounty(location.county);
              locationName = location.county;
            }
            
            // Fallback: use renderCityCountyBoundaries to get zip codes (for counties)
            if (!allZipCodes || allZipCodes.size === 0) {
              const currentMap = (window as any).currentMap;
              if (currentMap) {
                try {
                  const result = await renderCityCountyBoundaries(currentMap, queryOrZip, () => '#9e9e9e');
                  if (result && result.zipCodes.length > 0) {
                    allZipCodes = new Set(result.zipCodes);
                    locationName = queryOrZip;
                    // Clean up boundaries immediately - we only wanted the zip codes
                    const { clearCityCountyBoundaries } = await import('../../utils/geojsonBoundaries');
                    clearCityCountyBoundaries(currentMap);
                  }
                } catch (err) {
                  // Continue with single zip code fallback
                }
              }
            } else if (location.county) {
              locationName = location.county;
            }
          }
          
          // If we couldn't get all zip codes, use the first zip code as fallback
          if (!allZipCodes || allZipCodes.size === 0) {
            if (location.zipCode) {
              finalZipCode = location.zipCode;
              geocodeResult = await geocodeZipCode(finalZipCode, geocoder!);
            } else {
              setError(`Unable to find zip codes for ${currentViewType} "${queryOrZip}".`);
              setIsLoading(false);
              return;
            }
          } else {
            // Get aggregated score for city/county (same as main dashboard)
            const zipCodesArray = Array.from(allZipCodes);
            const scoreMap = await api.getHorizonScoresForZipCodes(zipCodesArray);
            
            if (scoreMap.size === 0) {
              setError(`No scores available for ${currentViewType} "${queryOrZip}".`);
              setIsLoading(false);
              return;
            }
            
            // Calculate weighted average score (equal weights for now)
            let scoreSum = 0;
            let pcaSum = 0;
            let linSum = 0;
            let annSum = 0;
            let avgSum = 0;
            let count = 0;
            
            scoreMap.forEach((horizonScore) => {
              scoreSum += horizonScore.score;
              pcaSum += horizonScore.backendScores?.pca_score || 0;
              linSum += horizonScore.backendScores?.lin_score || 0;
              annSum += horizonScore.backendScores?.ann_score || 0;
              avgSum += horizonScore.backendScores?.avg_score || 0;
              count++;
            });
            
            const averageScore = Math.round(scoreSum / count);
            const firstScore = Array.from(scoreMap.values())[0];
            
            // Format location name
            if (currentViewType === 'county' && !locationName.toUpperCase().includes('COUNTY')) {
              locationName = `${locationName} County`;
            }
            
            // Create aggregated score
            const aggregatedScore: HorizonScore = {
              ...firstScore,
              address: `${locationName} (${zipCodesArray.length} zip codes)`,
              zipCode: zipCodesArray[0], // Use first zip as representative
              score: averageScore,
              scoreCategory: averageScore >= 850 ? 'excellent' :
                           averageScore >= 700 ? 'good' :
                           averageScore >= 550 ? 'fair' :
                           averageScore >= 400 ? 'moderate' :
                           averageScore >= 250 ? 'poor' : 'critical',
              backendScores: {
                pca_score: pcaSum / count,
                lin_score: linSum / count,
                ann_score: annSum / count,
                avg_score: avgSum / count
              }
            };
            
            setComparisonLocation(aggregatedScore);
            
            setIsLoading(false);
            return; // Early return - score is already set
          }
        } else {
          geocodeResult = await geocodeAddress(queryOrZip, geocoder!);
          finalZipCode = geocodeResult?.zipCode || null;
        }
      }

      if (!geocodeResult || !finalZipCode) {
        setError(`Unable to find the ${currentViewType === 'zip' ? 'zip code' : currentViewType === 'city' ? 'city' : 'county'}. Please enter a valid ${currentViewType === 'zip' ? 'zip code' : currentViewType === 'city' ? 'city name' : 'county name'}.`);
        setIsLoading(false);
        return;
      }

      // Check if trying to compare the same zip code as current location
      if (currentScore && finalZipCode === currentScore.zipCode) {
        setError('Cannot compare a location to itself. Please select a different location.');
        setIsLoading(false);
        return;
      }

      // Fetch score using zip code (for zip code searches or fallback)
      const score = await api.getHorizonScoreByZipCode(finalZipCode, {
        address: geocodeResult.formattedAddress,
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude
      });

      setComparisonLocation(score);
      
      // Highlight location on map
      const currentMap = (window as any).currentMap;
      if (currentMap && finalZipCode) {
        try {
          const { updateZipCodePolygonColor } = await import('../../utils/geojsonBoundaries');
          const { getScoreColor } = await import('../../utils/scoreColors');
          const scoreColor = getScoreColor(score.score);
          // Use preserveSelectedZip=true to not interfere with main search selected zip
          updateZipCodePolygonColor(currentMap, finalZipCode, scoreColor, true);
          
          // Store comparison zip code on map for persistence
          (currentMap as any).comparisonZipCode = finalZipCode;
        } catch (err) {
          // Silently handle color update errors
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch location data');
      if (import.meta.env.DEV) {
        console.error('Comparison search error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [geocoder, currentViewType, currentScore]);

  // Clear comparison location
  const handleClearLocation = useCallback(async () => {
    // Store the zip code before clearing
    const zipCodeToRemove = comparisonLocation?.zipCode;
    
    // Clear the state
    setComparisonLocation(null);
    setError(null);
    
    // Remove the polygon from the map completely
    if (zipCodeToRemove) {
      try {
        const currentMap = (window as any).currentMap;
        if (currentMap) {
          // Check if this zip code is the currently selected zip (main location)
          // If so, don't remove it - just reset its color
          const isCurrentlySelected = (currentMap as any).currentSelectedZipCode === zipCodeToRemove;
          
          if (isCurrentlySelected) {
            // If it's the main selected location, just reset to gray instead of removing
            const { updateZipCodePolygonColor } = await import('../../utils/geojsonBoundaries');
            updateZipCodePolygonColor(currentMap, zipCodeToRemove, '#9e9e9e');
          } else {
            // Otherwise, completely remove the polygon
            let polygonMap = (currentMap as any).zipCodePolygonMap || {};
            let polygon = polygonMap[zipCodeToRemove];
            
            if (!polygon) {
              polygonMap = (currentMap as any).cityCountyZipPolygonMap || {};
              polygon = polygonMap[zipCodeToRemove];
            }
            
            if (polygon) {
              // Remove polygon from map
              polygon.setMap(null);
              
              // Remove from polygon maps
              if ((currentMap as any).zipCodePolygonMap && (currentMap as any).zipCodePolygonMap[zipCodeToRemove]) {
                delete (currentMap as any).zipCodePolygonMap[zipCodeToRemove];
              }
              if ((currentMap as any).cityCountyZipPolygonMap && (currentMap as any).cityCountyZipPolygonMap[zipCodeToRemove]) {
                delete (currentMap as any).cityCountyZipPolygonMap[zipCodeToRemove];
              }
              
              // Remove from polygons array if it exists
              const polygons = (currentMap as any).zipCodePolygons || [];
              const index = polygons.indexOf(polygon);
              if (index > -1) {
                polygons.splice(index, 1);
              }
            }
          }
        }
      } catch (err) {
        // Silently handle polygon removal errors
        if (import.meta.env.DEV) {
          console.warn('Failed to remove comparison location polygon:', err);
        }
      }
    }
  }, [comparisonLocation]);

  // Re-highlight comparison location when main search changes (to preserve comparison highlight)
  useEffect(() => {
    if (comparisonLocation && comparisonLocation.zipCode && currentScore) {
      const currentMap = (window as any).currentMap;
      if (currentMap) {
        // Only re-highlight if it's not the currently selected zip (main location)
        const isCurrentlySelected = (currentMap as any).currentSelectedZipCode === comparisonLocation.zipCode;
        if (!isCurrentlySelected) {
          // Longer delay to ensure main search polygon update completes first and score color is set
          const timer = setTimeout(async () => {
            try {
              const { updateZipCodePolygonColor } = await import('../../utils/geojsonBoundaries');
              const { getScoreColor } = await import('../../utils/scoreColors');
              const scoreColor = getScoreColor(comparisonLocation.score);
              
              // Double-check it's still not the selected zip before updating
              // Use preserveSelectedZip=true to not interfere with main search
              const currentSelectedZip = (currentMap as any).currentSelectedZipCode;
              if (currentSelectedZip !== comparisonLocation.zipCode) {
                updateZipCodePolygonColor(currentMap, comparisonLocation.zipCode, scoreColor, true);
              }
            } catch (err) {
              // Silently handle color update errors
            }
          }, 300);
          
          return () => clearTimeout(timer);
        }
      }
    }
  }, [currentScore?.zipCode, comparisonLocation?.zipCode]);

  // Show empty state when there's no score (no loading animation needed - users load scores manually)
  const showEmpty = !currentScore;
  
  return (
    <div className="comparison-panel">
      {/* Chat toggle button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="chat-toggle-button"
        title={isChatOpen ? 'Close chat' : 'Open chat'}
      >
        {isChatOpen ? '✕' : '💬'}
      </button>
      
      {/* Chat Box */}
      <ChatBox 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        currentScore={currentScore}
      />
      
      {comparisonLocation && (
        <button
          onClick={handleClearLocation}
          className="clear-button-top-left"
          title="Clear comparison location"
        >
          Clear
        </button>
      )}
      {currentScore && (
        <div className="comparison-header">
          <div className="comparison-header-title">
            <h1 className="comparison-label">Compare Scores</h1>
          </div>
          <p className="comparison-description">
            {currentViewType === 'zip' 
              ? 'Compare a zip code with the current location to see how affordability factors differ.'
              : currentViewType === 'city'
              ? 'Compare a city with the current location to see how affordability factors differ.'
              : 'Compare a county with the current location to see how affordability factors differ.'}
          </p>
          {!comparisonLocation && (
            <div style={{ marginTop: '16px', width: '100%' }}>
              <SearchBar
                onSearch={handleSearchLocation}
                isLoading={isLoading}
                mapsLoaded={mapsLoaded}
                error={error}
                filterType={currentViewType}
                placeholder={currentViewType === 'zip' 
                  ? 'Search zip code'
                  : currentViewType === 'city'
                  ? 'Search city'
                  : 'Search county'}
              />
            </div>
          )}
        </div>
      )}

      <div className="comparison-content">
        {showEmpty ? (
          <div className="empty-message-comparison">
            <h3>Compare Scores</h3>
            <p>Search an address or zip code to view the comparison</p>
          </div>
        ) : !comparisonLocation ? (
          <div className="empty-message-comparison">
            <h3>No Comparison Location</h3>
            <p>Search for a location to compare with the current location</p>
          </div>
        ) : (
          <>
            <div className="comparison-location-display">
              <div className="location-info">
                <h4>{comparisonLocation.address}</h4>
                <div className="location-score">
                  Score: <strong>{comparisonLocation.score === -1 ? 'N/A' : comparisonLocation.score}</strong> ({comparisonLocation.scoreCategory})
                </div>
              </div>
            </div>

            {currentScore && (
              <ComparisonView
                location1={currentScore}
                location2={comparisonLocation}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
});

ComparisonPanel.displayName = 'ComparisonPanel';

