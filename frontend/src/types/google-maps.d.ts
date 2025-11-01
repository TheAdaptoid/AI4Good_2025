/// <reference types="@types/google.maps" />

// Extend window to include Google Maps types
declare global {
  interface Window {
    google?: typeof google;
  }
}

declare namespace google {
  namespace maps {
    class Geocoder {
      geocode(
        request: GeocoderRequest,
        callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
      ): void;
    }

    interface GeocoderRequest {
      address?: string;
      location?: LatLng | LatLngLiteral;
      placeId?: string;
    }

    interface GeocoderResult {
      address_components: GeocoderAddressComponent[];
      formatted_address: string;
      geometry: GeocoderGeometry;
      place_id: string;
      types: string[];
    }

    interface GeocoderAddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }

    interface GeocoderGeometry {
      location: LatLng;
      location_type: GeocoderLocationType;
      viewport: LatLngBounds;
      bounds?: LatLngBounds;
    }

    type GeocoderStatus = 
      | 'OK'
      | 'ZERO_RESULTS'
      | 'OVER_QUERY_LIMIT'
      | 'REQUEST_DENIED'
      | 'INVALID_REQUEST'
      | 'UNKNOWN_ERROR';

    type GeocoderLocationType =
      | 'ROOFTOP'
      | 'RANGE_INTERPOLATED'
      | 'GEOMETRIC_CENTER'
      | 'APPROXIMATE';

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    class LatLngBounds {
      constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
      extend(point: LatLng | LatLngLiteral): LatLngBounds;
      getCenter(): LatLng;
      contains(point: LatLng | LatLngLiteral): boolean;
    }

    class Map {
      constructor(mapDiv: Element | null, opts?: MapOptions);
      setCenter(latlng: LatLng | LatLngLiteral): void;
      getCenter(): LatLng | null;
      setZoom(zoom: number): void;
      getZoom(): number | undefined;
    }

    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      zoomControl?: boolean;
      streetViewControl?: boolean;
      mapTypeControl?: boolean;
      fullscreenControl?: boolean;
    }

    namespace places {
      // Legacy Autocomplete API
      class Autocomplete {
        constructor(inputField: HTMLInputElement, opts?: AutocompleteOptions);
        setBounds(bounds: LatLngBounds): void;
        setComponentRestrictions(restrictions: { country?: string | string[] }): void;
        getPlace(): PlaceResult;
        addListener(event: string, handler: () => void): void;
      }
      
      interface AutocompleteOptions {
        componentRestrictions?: { country?: string | string[] };
        fields?: string[];
        types?: string[];
      }
      
      interface PlaceResult {
        formatted_address?: string;
        address_components?: PlaceAddressComponent[];
        geometry?: {
          location?: LatLng | { lat(): number; lng(): number; } | { lat: number; lng: number; };
        };
        place_id?: string;
      }
      
      interface PlaceAddressComponent {
        long_name: string;
        short_name: string;
        types: string[];
      }
      
      // New Places API (PlaceAutocompleteElement) - Web Component
      // This is a custom HTML element: <gmp-place-autocomplete-field>
      interface PlaceAutocompleteElement extends HTMLElement {
        countryRestrictions?: string;
        restrictToBounds?: LatLngBounds;
        setBounds?(bounds: LatLngBounds): void;
        addEventListener(type: 'gmp-placeselect', listener: (event: PlaceSelectEvent) => void): void;
        setAttribute(name: string, value: string): void;
      }
      
      interface PlaceSelectEvent extends Event {
        place: {
          formattedAddress?: string;
          addressComponents?: {
            longText?: string;
            shortText?: string;
            longName?: string;
            shortName?: string;
            text?: string;
            types?: string[];
          }[];
          geometry?: {
            location?: LatLng | LatLngLiteral;
          };
          id?: string;
          placeId?: string;
        };
      }
      
      namespace places {
        // Add PlaceAutocompleteElement as available in places namespace
        const PlaceAutocompleteElement: {
          new (): PlaceAutocompleteElement;
        };
      }
    }
  }
}


