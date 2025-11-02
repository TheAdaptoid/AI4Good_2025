import { useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { LoadScript } from '@react-google-maps/api';
import { SearchBar } from '../SearchBar/SearchBar';
import { MapView } from '../Map/MapView';
import { ScoreDisplay } from '../ScoreDisplay/ScoreDisplay';
import { ComparisonPanel } from '../Comparison/ComparisonPanel';
import { api } from '../../services/api';
import { geocodeAddress, geocodeZipCode, isZipCode, reverseGeocode } from '../../utils/geocode';
import type { HorizonScore } from '../../types';
import './Dashboard.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
// Load libraries for Google Maps - module-level constant array
// 'geocoding' for address/coordinate conversion
// 'places' for Places Autocomplete Service
// Note: This must be a module-level constant, not recreated on each render
const GOOGLE_MAPS_LIBRARIES: ('geocoding' | 'places')[] = ['geocoding', 'places'];

export function Dashboard() {
  const [score, setScore] = useState<HorizonScore | null>(null);
  const [isScoreLoading, setIsScoreLoading] = useState(false);
  const [isSimilarAreasLoading, setIsSimilarAreasLoading] = useState(false);
  
  // Combined loading state - only show content when BOTH are done
  const isLoading = isScoreLoading || isSimilarAreasLoading;
  const [mapCenter] = useState<google.maps.LatLngLiteral>({ lat: 30.3322, lng: -81.6557 });
  const [mapZoom] = useState(11);
  const [marker, setMarker] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [selectedZipCode, setSelectedZipCode] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const previousZipCodeRef = useRef<string | null>(null);
  const [currentViewType, setCurrentViewType] = useState<'zip' | 'city' | 'county'>('zip');
  const [currentViewName, setCurrentViewName] = useState<string | null>(null);

  // Store reference to handleSearch for zip click
  const searchRef = useRef<typeof handleSearch>();

  const handleSearch = useCallback(async (queryOrZip: string, geocodeInfo?: { address: string; lat: number; lng: number }) => {
    // Update ref so zip click handler can use it
    searchRef.current = handleSearch as any;
    if (!mapsLoaded || !geocoder) {
      return;
    }

    // Clear any previous city/county loading flag
    const currentMap = mapInstance || (window as any).currentMap;
    if (currentMap) {
      (currentMap as any).isCityCountyLoading = false;
    }

    // Force immediate render of loading state before async operations
    // Both score and similar areas should show loading together
    flushSync(() => {
      setIsScoreLoading(true);
      setIsSimilarAreasLoading(true); // Start similar areas loading immediately
      setSearchError(null); // Clear any previous errors
    });
    
    try {
      let geocodeResult: Awaited<ReturnType<typeof geocodeAddress>>;
      let finalZipCode: string;
      let zipCode: string;

      // Check if it's a zip code, city, county, or address
      // First, try local autocomplete to see if it's a city/county (check BEFORE geocoding)
      // Skip this check if it's already a zip code to avoid incorrect matches
      if (!isZipCode(queryOrZip)) {
        // Only check local autocomplete if query doesn't look like a full address
        // Full addresses from Google autocomplete should go straight to geocoding
        const looksLikeFullAddress = queryOrZip.includes(',') || 
                                     /^\d+\s/.test(queryOrZip.trim()) ||
                                     queryOrZip.includes('USA') ||
                                     queryOrZip.includes('United States');
        
        // Skip local autocomplete for full addresses - they should be geocoded directly
        if (!looksLikeFullAddress) {
          try {
            const { findLocationFromQuery } = await import('../../utils/localAutocomplete');
            const location = await findLocationFromQuery(queryOrZip);
            if (location && (location.type === 'city' || location.type === 'county')) {
            // Track view type for similar areas
            setCurrentViewType(location.type);
            setCurrentViewName(queryOrZip);
            
            // This is a city/county search - render boundaries with zip code gridlines
            const currentMap = mapInstance || (window as any).currentMap;
            if (currentMap) {
              try {
                const { renderCityCountyBoundaries, clearCityCountyBoundaries } = await import('../../utils/geojsonBoundaries');
                
                // Clear any previous city/county boundaries and zip code selections
                clearCityCountyBoundaries(currentMap);
                if (previousZipCodeRef.current) {
                  const { resetZipCodePolygonToInvisible } = await import('../../utils/geojsonBoundaries');
                  resetZipCodePolygonToInvisible(currentMap, previousZipCodeRef.current);
                  previousZipCodeRef.current = null;
                }
                
                // Default color function (will be updated after scores are fetched)
                const defaultGetScoreColor = (_zipCode: string) => '#4285f4'; // Blue by default
                
                // Set loading flag on map to prevent zip code clicks during loading
                (currentMap as any).isCityCountyLoading = true;
                
                // Render city/county boundaries with individual zip outlines
                const result = await renderCityCountyBoundaries(
                  currentMap, 
                  queryOrZip,
                  defaultGetScoreColor,
                  handleZipCodeClick
                );
                
                if (result && result.zipCodes.length > 0) {
                  // Log zip-county association stats in dev mode
                  if (import.meta.env.DEV) {
                    console.log(`${location.type === 'county' ? 'County' : 'City'} "${queryOrZip}": ${result.zipCodes.length} zip codes found`);
                  }
                  
                  // Fetch scores for all zip codes in the city/county
                  setIsScoreLoading(true);
                  
                  try {
                    // Get scores for all zip codes
                    const scoreMap = await api.getHorizonScoresForZipCodes(result.zipCodes);
                    
                    // Get area weights for weighted averaging (if available)
                    // For counties: uses actual area overlap percentages
                    // For cities: returns empty map, will use equal weights (1.0)
                    const areaWeights = result.getAreaWeights ? result.getAreaWeights() : null;
                    
                    // Calculate WEIGHTED average score for city/county
                    // Weight each zip code's score by the percentage of its area within the boundary
                    // This ensures multi-county zip codes contribute proportionally
                    const scoreColorMap = new Map<string, number>();
                    let weightedScoreSum = 0;
                    let totalWeight = 0;
                    let weightedPca = 0;
                    let weightedLin = 0;
                    let weightedAnn = 0;
                    let weightedAvg = 0;
                    
                    scoreMap.forEach((horizonScore, zip) => {
                      scoreColorMap.set(zip, horizonScore.score);
                      
                      // Get weight for this zip code (area overlap percentage)
                      // If no weights available (e.g., city search without precise boundaries), use equal weights (1.0)
                      const weight = areaWeights && areaWeights.size > 0 ? (areaWeights.get(zip) ?? 1.0) : 1.0;
                      
                      // Weight the score by area overlap
                      weightedScoreSum += horizonScore.score * weight;
                      totalWeight += weight;
                      
                      // Weight backend scores as well
                      if (horizonScore.backendScores) {
                        weightedPca += (horizonScore.backendScores.pca_score || 0) * weight;
                        weightedLin += (horizonScore.backendScores.lin_score || 0) * weight;
                        weightedAnn += (horizonScore.backendScores.ann_score || 0) * weight;
                        weightedAvg += (horizonScore.backendScores.avg_score || 0) * weight;
                      }
                    });
                    
                    if (totalWeight > 0) {
                      // Calculate weighted average (accounts for area overlap)
                      const averageScore = Math.round(weightedScoreSum / totalWeight);
                      
                      // Update zip polygon colors based on scores
                      result.updateColors(scoreColorMap);
                      
                      // Calculate weighted averages of backend scores
                      const avgPca = weightedPca / totalWeight;
                      const avgLin = weightedLin / totalWeight;
                      const avgAnn = weightedAnn / totalWeight;
                      const avgAvg = weightedAvg / totalWeight;
                      
                      // Create aggregated HorizonScore for city/county
                      // Use the first score as a template and modify it
                      const firstScore = Array.from(scoreMap.values())[0];
                      
                      // Prioritize county name for county searches, city name for city searches
                      let locationName: string;
                      if (location.type === 'county') {
                        locationName = location.county || queryOrZip;
                      } else if (location.type === 'city') {
                        locationName = location.city || queryOrZip;
                      } else {
                        locationName = location.county || location.city || queryOrZip;
                      }
                      
                      // Ensure county name includes "County" suffix if not present
                      if (location.type === 'county' && !locationName.toUpperCase().includes('COUNTY')) {
                        locationName = `${locationName} County`;
                      }
                      
                      const aggregatedScore: HorizonScore = {
                        ...firstScore,
                        address: `${locationName}`,
                        zipCode: result.zipCodes[0], // Use first zip as representative
                        score: averageScore,
                        scoreCategory: averageScore >= 700 ? 'good' : 
                                     averageScore >= 400 ? 'fair' : 'bad',
                        // Update backend scores to weighted averages
                        backendScores: {
                          pca_score: avgPca,
                          lin_score: avgLin,
                          ann_score: avgAnn,
                          avg_score: avgAvg
                        }
                      };
                      
                      // Add zip code count to address for display purposes
                      aggregatedScore.address = `${locationName} (${result.zipCodes.length} zip codes)`;
                      
                      setScore(aggregatedScore);
                      setSearchError(null);
                      // Score loading done - similar areas will be triggered by score/currentViewName change
                      setIsScoreLoading(false);
                    } else {
                      // No scores available
                      setScore(null);
                      setIsScoreLoading(false);
                    }
                  } catch (error) {
                    if (import.meta.env.DEV) {
                      console.warn('Failed to fetch scores for city/county:', error);
                    }
                    setScore(null);
                    setIsScoreLoading(false);
                  } finally {
                    // Clear loading flag when done (success or error)
                    (currentMap as any).isCityCountyLoading = false;
                  }
                  return;
                } else {
                  // No result or no zip codes found - clear loading flag
                  (currentMap as any).isCityCountyLoading = false;
                  setIsScoreLoading(false);
                  setIsSimilarAreasLoading(false);
                }
              } catch (error) {
                // Continue with normal geocoding if city boundaries fail
                if (import.meta.env.DEV) {
                  console.warn('Failed to render city/county boundaries:', error);
                }
                // Clear loading flag on error
                (currentMap as any).isCityCountyLoading = false;
              }
            }
          }
          } catch (error) {
            // Continue with normal geocoding if local search fails
            if (import.meta.env.DEV) {
              console.warn('Local autocomplete check failed:', error);
            }
          }
        }
        // If it looks like a full address, skip local autocomplete and go straight to geocoding
      }

      // If not handled as city/county, proceed with normal zip code/address search
      if (isZipCode(queryOrZip)) {
        // Direct zip code input
        zipCode = queryOrZip.trim();
        geocodeResult = await geocodeZipCode(zipCode, geocoder);
      } else {
        // Could be address - geocode to extract info
        geocodeResult = await geocodeAddress(queryOrZip, geocoder);
      }

      if (!geocodeResult) {
        setSearchError('Unable to find the location. Please enter a valid US zip code or address.');
        setIsScoreLoading(false);
        setIsSimilarAreasLoading(false);
        return;
      }

      // Extract final zip code
      finalZipCode = geocodeResult.zipCode;

      // If zip code is missing but we have coordinates (from autocomplete-validated selection),
      // try reverse geocoding to get zip code
      if (!finalZipCode && geocodeResult.latitude && geocodeResult.longitude) {
        try {
          const reverseResult = await reverseGeocode(geocodeResult.latitude, geocodeResult.longitude, geocoder);
          if (reverseResult && reverseResult.zipCode) {
            finalZipCode = reverseResult.zipCode;
            // Update geocodeResult with reverse geocoded zip code
            geocodeResult.zipCode = reverseResult.zipCode;
            // Also update county if we got it from reverse geocoding
            if (reverseResult.county && !geocodeResult.county) {
              geocodeResult.county = reverseResult.county;
            }
          }
        } catch (error) {
          // Non-critical - continue even if reverse geocoding fails
          if (import.meta.env.DEV) {
            console.warn('Reverse geocoding failed:', error);
          }
        }
      }

      // Cache county data if available (Google Geocoding provides county info)
      if (geocodeResult.county && finalZipCode) {
        try {
          const { cacheCountyForZip } = await import('../../utils/localAutocomplete');
          cacheCountyForZip(finalZipCode, geocodeResult.county);
        } catch (error) {
          // Non-critical - continue even if caching fails
        }
      }

      // If we still don't have a zip code after reverse geocoding,
      // provide a helpful error (autocomplete ensures valid selection, so this is rare)
      if (!finalZipCode) {
        // Check if we have valid coordinates in Florida/US bounds
        const isInFloridaBounds = geocodeResult.latitude >= 24 && geocodeResult.latitude <= 31 &&
                                   geocodeResult.longitude >= -87.5 && geocodeResult.longitude <= -79.5;
        const isInUSBounds = geocodeResult.latitude >= 24 && geocodeResult.latitude <= 50 &&
                              geocodeResult.longitude >= -125 && geocodeResult.longitude <= -66;
        
        if (geocodeResult.country === 'US' && (isInFloridaBounds || isInUSBounds)) {
          // Valid selection from autocomplete but zip code extraction failed
          // Try one more time with a formatted query that includes city and state
          setSearchError('Could not extract zip code from address. Please try selecting a more specific address (with street number) or search by zip code directly.');
          setIsScoreLoading(false);
          setIsSimilarAreasLoading(false);
          return;
        } else {
          // Shouldn't happen with autocomplete validation, but handle gracefully
          setSearchError('Unable to process address. Please try a different address or search by zip code.');
          setIsScoreLoading(false);
          setIsSimilarAreasLoading(false);
          return;
        }
      }

      // Validate that the location is in the United States
      if (geocodeResult.country && geocodeResult.country !== 'US') {
        setSearchError('This location is not in the United States. Please enter a US zip code or address.');
        setIsScoreLoading(false);
        setIsSimilarAreasLoading(false);
        return;
      }

      // If no country code is provided but we have coordinates, check if it's likely in US bounds
      if (!geocodeResult.country) {
        const isLikelyUS = geocodeResult.latitude >= 24 && geocodeResult.latitude <= 50 &&
                           geocodeResult.longitude >= -125 && geocodeResult.longitude <= -66;
        
        if (!isLikelyUS) {
          setSearchError('This location appears to be outside the United States. Please enter a US zip code or address.');
          setIsScoreLoading(false);
          setIsSimilarAreasLoading(false);
          return;
        }
      }

      // Update zip code polygon to highlight it
      const currentMap = mapInstance || (window as any).currentMap;
      if (currentMap) {
        try {
          const { 
            updateZipCodePolygonColor, 
            resetZipCodePolygonToInvisible, 
            panToZipCode,
            clearCityCountyBoundaries 
          } = await import('../../utils/geojsonBoundaries');
          
          // Check if we're transitioning from city/county view to single zip view
          const isCityCountyView = (currentMap as any).isCityCountyView;
          const cityCountyPolygonMap = (currentMap as any).cityCountyZipPolygonMap || {};
          const cityCountyPolygon = cityCountyPolygonMap[finalZipCode];
          
          if (isCityCountyView && cityCountyPolygon) {
            // We're clicking a zip from city/county view - clear city view and show only this zip
            if (!(currentMap as any).zipCodePolygonMap) {
              (currentMap as any).zipCodePolygonMap = {};
              (currentMap as any).zipCodePolygons = [];
            }
            
            // Remove from city/county map and array BEFORE clearing
            delete cityCountyPolygonMap[finalZipCode];
            const cityCountyZipPolygons = (currentMap as any).cityCountyZipPolygons || [];
            const polygonIndex = cityCountyZipPolygons.indexOf(cityCountyPolygon);
            if (polygonIndex !== -1) {
              cityCountyZipPolygons.splice(polygonIndex, 1);
            }
            
            // Mark as selected and ensure visible
            if ((cityCountyPolygon as any).setSelected) {
              (cityCountyPolygon as any).setSelected(true);
            }
            (currentMap as any).currentSelectedZipCode = finalZipCode;
            
            // Move to regular polygon map
            (currentMap as any).zipCodePolygonMap[finalZipCode] = cityCountyPolygon;
            if (!(currentMap as any).zipCodePolygons.includes(cityCountyPolygon)) {
              (currentMap as any).zipCodePolygons.push(cityCountyPolygon);
            }
            
            // Clear city/county boundaries (preserve the clicked zip)
            clearCityCountyBoundaries(currentMap, finalZipCode);
            
            // Ensure the clicked zip stays visible and highlighted
            cityCountyPolygon.setOptions({
              fillColor: '#4285f4',
              fillOpacity: 0.4,
              strokeColor: '#4285f4',
              strokeOpacity: 0.9,
              strokeWeight: 3
            });
          } else {
            // Normal zip code search (not from city/county view)
            // Clear any city/county boundaries when selecting a zip code
            clearCityCountyBoundaries(currentMap);
            
            // Reset previously selected zip code to invisible state
            if (previousZipCodeRef.current && previousZipCodeRef.current !== finalZipCode) {
              resetZipCodePolygonToInvisible(currentMap, previousZipCodeRef.current);
            }
            
            // Reset any currently selected zip code stored on the map
            const currentSelectedZip = (currentMap as any).currentSelectedZipCode;
            if (currentSelectedZip && currentSelectedZip !== finalZipCode) {
              resetZipCodePolygonToInvisible(currentMap, currentSelectedZip);
            }
            
            // Immediately highlight the zip code (before we get the score)
            updateZipCodePolygonColor(currentMap, finalZipCode, '#4285f4');
          }
          
          // Pan to zip code with smooth animation (only if not already panned by polygon click)
          // The polygon click handler already does fitBounds, so this handles search bar searches
          await panToZipCode(currentMap, finalZipCode, 14);
        } catch (error) {
          // Fallback to center-based panning if bounds calculation fails
          const newCenter = { lat: geocodeResult.latitude, lng: geocodeResult.longitude };
          currentMap.panTo(newCenter);
          currentMap.setZoom(14);
        }
      }

      // Only set marker for address searches (not zip code/city/county searches)
      // Check if this was an address search by checking if it looks like an address
      const isAddressSearch = !isZipCode(queryOrZip) && 
                              (queryOrZip.includes(',') || 
                               /^\d+\s/.test(queryOrZip.trim()) ||
                               queryOrZip.includes('USA') ||
                               queryOrZip.includes('United States') ||
                               geocodeInfo !== undefined);
      
      if (isAddressSearch) {
        setMarker({ lat: geocodeResult.latitude, lng: geocodeResult.longitude });
      } else {
        setMarker(null); // Clear marker for zip/city/county searches
      }

              // Fetch Horizon Score from backend using zip code
              const horizonScore = await api.getHorizonScoreByZipCode(finalZipCode, {
                address: geocodeResult.formattedAddress,
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude
              });

              // Track view type - reset to zip for zip code searches
              setCurrentViewType('zip');
              setCurrentViewName(null);

              setScore(horizonScore);
              setSelectedZipCode(finalZipCode);
              setSearchError(null); // Clear error on successful search
              setIsScoreLoading(false); // Score loading done

      // Update zip code polygon color based on score (already highlighted, just change color)
      // Three colors: Green (Good >= 700), Yellow (Fair 400-700), Red (Bad < 400)
      if (currentMap && horizonScore) {
        try {
          const { updateZipCodePolygonColor } = await import('../../utils/geojsonBoundaries');
          
          // Determine color based on score
          // Three categories: Good (700-1000), Fair (400-700), Bad (0-400)
          let scoreColor: string;
          if (horizonScore.score >= 700) {
            scoreColor = '#4caf50'; // Green - Good
          } else if (horizonScore.score >= 400) {
            scoreColor = '#ffeb3b'; // Yellow - Fair
          } else {
            scoreColor = '#f44336'; // Red - Bad
          }
          
          // Update current zip code color based on score
          updateZipCodePolygonColor(currentMap, finalZipCode, scoreColor);
          
          // Track this as the previous zip code for next selection
          previousZipCodeRef.current = finalZipCode;
        } catch (error) {
          // Silently handle color update errors
        }
      }
    } catch (error) {
      // Set user-friendly error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to search. Please check the address or zip code and try again.';
      
      setSearchError(errorMessage);
    } finally {
      // Always clear loading if there's an error
      setIsScoreLoading(false);
      setIsSimilarAreasLoading(false);
    }
  }, [mapsLoaded, geocoder, mapInstance]);

  const handleMapLoad = useCallback(async (_map: google.maps.Map) => {
    const newGeocoder = new google.maps.Geocoder();
    setGeocoder(newGeocoder);
    setMapsLoaded(true);
    setMapInstance(_map);
    // Store map reference globally for use in search handler
    (window as any).currentMap = _map;
    
    // Set up the search ref with handleSearch so it's available immediately
    searchRef.current = handleSearch as any;
    
    // Load all zip code boundaries on map initialization
    try {
      const { loadAllZipCodeBoundaries } = await import('../../utils/geojsonBoundaries');
      
      // Default color function - all zip codes start as blue
      const getScoreColor = () => '#4285f4'; // Blue
      
      // Click handler for zip codes - uses searchRef which is set above
      const handleZipClick = async (zipCode: string) => {
        const searchFn = searchRef.current;
        if (searchFn) {
          if (import.meta.env.DEV) {
            console.log('Clicking zip code:', zipCode);
          }
          await searchFn(zipCode);
        } else if (import.meta.env.DEV) {
          console.warn('Search function not available for zip code click:', zipCode);
        }
      };
      
      await loadAllZipCodeBoundaries(_map, getScoreColor, handleZipClick);
    } catch (error) {
      // Silently handle boundary loading errors
      if (import.meta.env.DEV) {
        console.warn('Failed to load initial zip code boundaries:', error);
      }
    }
  }, [handleSearch]);

  const handleErrorClear = useCallback(() => {
    setSearchError(null);
  }, []);

  const handleZipCodeClick = useCallback(async (zipCode: string) => {
    // Trigger search for the zip code
    if (handleSearch) {
      await handleSearch(zipCode); // Just pass zip code, no geocodeInfo
    }
  }, [handleSearch]);

  const handleMapsLoaded = useCallback(() => {
    if (!mapsLoaded) {
      setMapsLoaded(true);
    }
  }, [mapsLoaded]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="loading-container">
        <p style={{ color: 'red' }}>
          Error: VITE_GOOGLE_MAPS_API_KEY not set in environment variables
        </p>
        <p>Please set your Google Maps API key in the .env file</p>
      </div>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      libraries={GOOGLE_MAPS_LIBRARIES}
      onLoad={handleMapsLoaded}
    >
      <div className="dashboard">
        {/* Left Pane - Map */}
        <div className="pane pane-left">
            <SearchBar 
              onSearch={handleSearch} 
              isLoading={isLoading} 
              mapsLoaded={mapsLoaded}
              error={searchError}
              onErrorClear={handleErrorClear}
            />
          <div className="map-wrapper">
            <MapView
              center={mapCenter}
              zoom={mapZoom}
              marker={marker}
              onZipCodeClick={(zipCode) => handleZipCodeClick(zipCode)}
              selectedZipCode={selectedZipCode || undefined}
              onMapLoad={handleMapLoad}
              googleMapsApiKey={GOOGLE_MAPS_API_KEY}
            />
          </div>
        </div>

        {/* Middle Pane - Score Display */}
        <div className="pane pane-middle">
          <ScoreDisplay score={score} isLoading={isLoading || isSimilarAreasLoading} />
        </div>

        {/* Right Pane - Comparison & Similar Areas */}
        <div className="pane pane-right">
          <ComparisonPanel 
            currentScore={score}
            onLocationSelect={(zipCode) => handleSearch(zipCode)}
            mapsLoaded={mapsLoaded}
            currentViewType={currentViewType}
            currentViewName={currentViewName}
            isSearching={isLoading || isSimilarAreasLoading}
            onSimilarAreasLoadingChange={setIsSimilarAreasLoading}
          />
        </div>
      </div>
    </LoadScript>
  );
}

