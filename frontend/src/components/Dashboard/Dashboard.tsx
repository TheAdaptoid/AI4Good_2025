import { useState, useCallback, useRef } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { SearchBar } from '../SearchBar/SearchBar';
import { MapView } from '../Map/MapView';
import { ScoreDisplay } from '../ScoreDisplay/ScoreDisplay';
import { ComparisonPanel } from '../Comparison/ComparisonPanel';
import { api } from '../../services/api';
import { geocodeAddress, geocodeZipCode, isZipCode } from '../../utils/geocode';
import type { HorizonScore } from '../../types';
import './Dashboard.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
// Load libraries for Google Maps
// 'geocoding' for address/coordinate conversion
const GOOGLE_MAPS_LIBRARIES: ('geocoding')[] = ['geocoding'];

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

  // Store reference to handleSearch for zip click
  const searchRef = useRef<typeof handleSearch>();

  const handleMapLoad = useCallback(async (_map: google.maps.Map) => {
    const newGeocoder = new google.maps.Geocoder();
    setGeocoder(newGeocoder);
    setMapsLoaded(true);
    setMapInstance(_map);
    // Store map reference globally for use in search handler
    (window as any).currentMap = _map;
    // No initial zip code loading - boundaries will load on search
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    // Update ref so zip click handler can use it
    searchRef.current = handleSearch as any;
    if (!mapsLoaded || !geocoder) {
      if (import.meta.env.DEV) {
        console.error('Google Maps not loaded');
      }
      return;
    }

    setIsLoading(true);
    
    try {
      // Use manual geocoding for all searches
      let geocodeResult;
      if (isZipCode(query)) {
        geocodeResult = await geocodeZipCode(query, geocoder);
      } else {
        geocodeResult = await geocodeAddress(query, geocoder);
      }

      if (!geocodeResult) {
        throw new Error('Geocoding failed');
      }

      // Update map
      const newCenter = { lat: geocodeResult.latitude, lng: geocodeResult.longitude };
      if (import.meta.env.DEV) {
        console.log('Updating map center to:', newCenter);
      }
      setMapCenter(newCenter);
      setMapZoom(14);
      setMarker(newCenter);

      // Load zip code boundary for the searched location
      if (geocodeResult.zipCode) {
        try {
          const { createZipCodeBoundaryFromGeoJSON } = await import('../../utils/geojsonBoundaries');
          
          // Helper to get score color (will be updated when scores are loaded)
          const getScoreColor = (_zipCode: string) => {
            // For now, use a highlight color for the selected zip code
            // TODO: Update this based on Horizon Score when available
            return '#4285f4'; // Google blue for selected
          };
          
          // Helper for zip code click - use ref to current search function
          const handleZipClick = async (zipCode: string) => {
            if (searchRef.current) {
              await searchRef.current(zipCode);
            }
          };
          
          const polygon = await createZipCodeBoundaryFromGeoJSON(
            mapInstance || (window as any).currentMap || new google.maps.Map(document.createElement('div'), {}), // Fallback if needed
            geocodeResult.zipCode,
            getScoreColor,
            handleZipClick
          );
          
          if (!polygon && import.meta.env.DEV) {
            console.warn(`Failed to load boundary for zip code: ${geocodeResult.zipCode}`);
            console.warn('Make sure GeoJSON file exists. See README.md for instructions.');
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('Failed to load zip code boundary:', error);
          }
        }
      }

      // Fetch Horizon Score
      let horizonScore: HorizonScore;
      if (isZipCode(query)) {
        horizonScore = await api.getHorizonScoreByZipCode(geocodeResult.zipCode);
      } else {
        horizonScore = await api.getHorizonScoreByAddress(query);
      }

      // Update score with geocoded address
      horizonScore.address = geocodeResult.formattedAddress;
      horizonScore.zipCode = geocodeResult.zipCode;
      horizonScore.latitude = geocodeResult.latitude;
      horizonScore.longitude = geocodeResult.longitude;

      setScore(horizonScore);
      setSelectedZipCode(geocodeResult.zipCode);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Search error:', error);
      }
      // Only show alert in development
      if (import.meta.env.DEV) {
        alert('Failed to search. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [mapsLoaded, geocoder, mapInstance]);

  const handleZipCodeClick = useCallback(async (zipCode: string) => {
    // Trigger search for the zip code
    if (handleSearch) {
      await handleSearch(zipCode);
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
            <SearchBar onSearch={handleSearch} isLoading={isLoading} mapsLoaded={mapsLoaded} />
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

