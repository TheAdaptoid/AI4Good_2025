// Geocoding utility functions for Google Maps API

export interface GeocodeResult {
  address: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  country?: string; // Country code from geocoding result
}

export function isZipCode(input: string): boolean {
  // Check if input is 5 digits or 5 digits + dash + 4 digits
  const zipCodePattern = /^\d{5}(-\d{4})?$/;
  return zipCodePattern.test(input.trim());
}

export interface GeocodeResult {
  address: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  country?: string; // Country code from geocoding result
  county?: string; // County name from geocoding result
}

export async function geocodeAddress(
  address: string,
  geocoder: google.maps.Geocoder
): Promise<GeocodeResult | null> {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const result = results[0];
        const location = result.geometry.location;
        
        // Extract zip code from address components
        let zipCode = '';
        const zipComponent = result.address_components.find(
          component => component.types.includes('postal_code')
        );
        if (zipComponent) {
          zipCode = zipComponent.long_name;
        }

        // Extract country from address components
        let country = '';
        const countryComponent = result.address_components.find(
          component => component.types.includes('country')
        );
        if (countryComponent) {
          country = countryComponent.short_name; // Use short_name for ISO country code (e.g., "US")
        }
        
        // Extract county from address components
        let county = '';
        const countyComponent = result.address_components.find(
          component => component.types.includes('administrative_area_level_2')
        );
        if (countyComponent) {
          county = countyComponent.long_name; // County name
        }
        
        resolve({
          address: address,
          zipCode: zipCode,
          latitude: location.lat(),
          longitude: location.lng(),
          formattedAddress: result.formatted_address,
          country: country,
          county: county
        });
      } else {
        reject(new Error(`Geocoding failed: ${status}`));
      }
    });
  });
}

export async function geocodeZipCode(
  zipCode: string,
  geocoder: google.maps.Geocoder
): Promise<GeocodeResult | null> {
  // Format as "Jacksonville, FL {zipCode}" for better geocoding
  const formattedAddress = `Jacksonville, FL ${zipCode}`;
  return geocodeAddress(formattedAddress, geocoder);
}

/**
 * Reverse geocode coordinates to extract zip code and other info
 * Used when address geocoding doesn't return zip code
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  geocoder: google.maps.Geocoder
): Promise<GeocodeResult | null> {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results.length > 0) {
        const result = results[0];
        const location = result.geometry.location;
        
        // Extract zip code from address components
        let zipCode = '';
        const zipComponent = result.address_components.find(
          component => component.types.includes('postal_code')
        );
        if (zipComponent) {
          zipCode = zipComponent.long_name;
        }

        // Extract country from address components
        let country = '';
        const countryComponent = result.address_components.find(
          component => component.types.includes('country')
        );
        if (countryComponent) {
          country = countryComponent.short_name;
        }
        
        // Extract county from address components
        let county = '';
        const countyComponent = result.address_components.find(
          component => component.types.includes('administrative_area_level_2')
        );
        if (countyComponent) {
          county = countyComponent.long_name;
        }
        
        resolve({
          address: result.formatted_address || '',
          zipCode: zipCode,
          latitude: location.lat(),
          longitude: location.lng(),
          formattedAddress: result.formatted_address || '',
          country: country,
          county: county
        });
      } else {
        reject(new Error(`Reverse geocoding failed: ${status}`));
      }
    });
  });
}


