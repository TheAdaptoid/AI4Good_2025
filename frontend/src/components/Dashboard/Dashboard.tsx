import { useState, useCallback, useRef } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>({ lat: 30.3322, lng: -81.6557 });
  const [mapZoom, setMapZoom] = useState(11);
  const [marker, setMarker] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [selectedZipCode, setSelectedZipCode] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const previousZipCodeRef = useRef<string | null>(null);

  // Store reference to handleSearch for zip click
  const searchRef = useRef<typeof handleSearch>();

  const handleSearch = useCallback(async (queryOrZip: string, geocodeInfo?: { address: string; lat: number; lng: number }) => {
    // Update ref so zip click handler can use it
    searchRef.current = handleSearch as any;
    if (!mapsLoaded || !geocoder) {
      return;
    }

    setIsLoading(true);
    setSearchError(null); // Clear any previous errors
    
    try {
      let zipCode: string;
      let geocodeResult: Awaited<ReturnType<typeof geocodeAddress>>;
      let finalZipCode: string;

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
            // This is a city/county search - render boundaries instead of single zip
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
                
                // Render city/county boundaries (stroke only) - shows aggregated boundary for ALL zip codes
                const boundaries = await renderCityCountyBoundaries(currentMap, queryOrZip);
                
                if (boundaries && boundaries.length > 0) {
                  // City/county boundaries rendered - zoom to them and return
                  // User can now click on zip codes within the boundaries
                  setScore(null); // Clear score since we're showing city/county view
                  setSearchError(null);
                  setIsLoading(false);
                  return;
                }
              } catch (error) {
                // Continue with normal geocoding if city boundaries fail
                if (import.meta.env.DEV) {
                  console.warn('Failed to render city/county boundaries:', error);
                }
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
        setIsLoading(false);
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
          setIsLoading(false);
          return;
        } else {
          // Shouldn't happen with autocomplete validation, but handle gracefully
          setSearchError('Unable to process address. Please try a different address or search by zip code.');
          setIsLoading(false);
          return;
        }
      }

      // Validate that the location is in the United States
      if (geocodeResult.country && geocodeResult.country !== 'US') {
        setSearchError('This location is not in the United States. Please enter a US zip code or address.');
        setIsLoading(false);
        return;
      }

      // If no country code is provided but we have coordinates, check if it's likely in US bounds
      if (!geocodeResult.country) {
        const isLikelyUS = geocodeResult.latitude >= 24 && geocodeResult.latitude <= 50 &&
                           geocodeResult.longitude >= -125 && geocodeResult.longitude <= -66;
        
        if (!isLikelyUS) {
          setSearchError('This location appears to be outside the United States. Please enter a US zip code or address.');
          setIsLoading(false);
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
          
          // Clear any city/county boundaries when selecting a zip code
          clearCityCountyBoundaries(currentMap);
          
          // Reset previously selected zip code to invisible state
          if (previousZipCodeRef.current && previousZipCodeRef.current !== finalZipCode) {
            resetZipCodePolygonToInvisible(currentMap, previousZipCodeRef.current);
          }
          
          // Immediately highlight the zip code (before we get the score)
          // Use a temporary blue highlight until we get the score
          updateZipCodePolygonColor(currentMap, finalZipCode, '#4285f4');
          
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

      setMarker({ lat: geocodeResult.latitude, lng: geocodeResult.longitude });

      // Fetch Horizon Score from backend using zip code
      const horizonScore = await api.getHorizonScoreByZipCode(finalZipCode, {
        address: geocodeResult.formattedAddress,
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude
      });

      setScore(horizonScore);
      setSelectedZipCode(finalZipCode);
      setSearchError(null); // Clear error on successful search

      // Update zip code polygon color based on score (already highlighted, just change color)
      // Green for good scores (>= 500), red for poor scores (< 500)
      if (currentMap && horizonScore) {
        try {
          const { updateZipCodePolygonColor } = await import('../../utils/geojsonBoundaries');
          
          // Determine color based on score
          // Horizon scores are 0-1000, so >= 500 is good (green), < 500 is poor (red)
          const scoreColor = horizonScore.score >= 500 ? '#4caf50' : '#f44336'; // Green or Red
          
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
      setIsLoading(false);
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
          <ScoreDisplay score={score} isLoading={isLoading} />
        </div>

        {/* Right Pane - Comparison & Similar Areas */}
        <div className="pane pane-right">
          <ComparisonPanel 
            currentScore={score}
            onLocationSelect={(zipCode) => handleSearch(zipCode)}
            mapsLoaded={mapsLoaded}
          />
        </div>
      </div>
    </LoadScript>
  );
}

