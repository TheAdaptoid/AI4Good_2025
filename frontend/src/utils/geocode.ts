// Geocoding utility functions for Google Maps API

export interface GeocodeResult {
  address: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export function isZipCode(input: string): boolean {
  // Check if input is 5 digits or 5 digits + dash + 4 digits
  const zipCodePattern = /^\d{5}(-\d{4})?$/;
  return zipCodePattern.test(input.trim());
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
        
        resolve({
          address: address,
          zipCode: zipCode,
          latitude: location.lat(),
          longitude: location.lng(),
          formattedAddress: result.formatted_address
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


