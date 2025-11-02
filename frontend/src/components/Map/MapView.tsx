import { useCallback, useRef, useEffect } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import './MapView.css';

const JACKSONVILLE_CENTER = { lat: 30.3322, lng: -81.6557 };
const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%'
};
const DEFAULT_OPTIONS = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

interface MapViewProps {
  center?: google.maps.LatLngLiteral;
  zoom?: number;
  marker?: google.maps.LatLngLiteral | null;
  onZipCodeClick?: (zipCode: string) => void;
  selectedZipCode?: string;
  onMapLoad?: (map: google.maps.Map) => void;
  googleMapsApiKey: string;
}


export function MapView({ 
  center = JACKSONVILLE_CENTER, 
  zoom = 11,
  marker = null,
  onMapLoad
}: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (onMapLoad) {
      onMapLoad(map);
    }
  }, [onMapLoad]);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Don't automatically update center/zoom - let fitBounds handle it
  // This prevents interference with smooth animations
  // Only update on initial load
  const initialLoadRef = useRef(true);
  
  useEffect(() => {
    if (mapRef.current && center && initialLoadRef.current) {
      mapRef.current.setCenter(center);
      initialLoadRef.current = false;
    }
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (mapRef.current && zoom && initialLoadRef.current) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);

  return (
    <div className="map-container">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={DEFAULT_OPTIONS}
      >
        {marker && <Marker position={marker} />}
      </GoogleMap>
    </div>
  );
}

