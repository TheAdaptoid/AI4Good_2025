/**
 * Google Maps Data-Driven Styling (DDS) for Boundaries
 * Supports postal codes (zip codes) in the US
 * https://developers.google.com/maps/documentation/javascript/dds-boundaries
 * 
 * NOTE: This requires Region Lookup API to be enabled in Google Cloud Console.
 * If DDS Boundaries don't work, alternative approaches include:
 * 
 * 1. Using external GeoJSON data (Census TIGER/Line files)
 *    - Download zip code boundaries from: https://www.census.gov/geographies/mapping-files.html
 *    - Load GeoJSON and use google.maps.Polygon to draw boundaries
 * 
 * 2. Using Places API place geometry (if available for postal codes)
 *    - Get place ID via Geocoding API or Region Lookup API REST endpoint
 *    - Use Places API to get geometry and draw polygons
 * 
 * 3. Using @googlemaps/region-lookup npm package (server-side REST API)
 *    - Requires backend implementation
 *    - npm install @googlemaps/region-lookup
 * 
 * For now, we're using DDS Boundaries as it's the recommended client-side approach.
 * See: https://support.google.com/maps/thread/4830567 for community discussions
 */

/**
 * Load Google DDS Boundaries library for postal codes
 * Requires Region Lookup API to be enabled
 */
export async function loadGoogleDdsBoundaries(): Promise<any> {
  try {
    // Check if importLibrary is available
    if (!window.google?.maps?.importLibrary) {
      if (import.meta.env.DEV) {
        console.warn('Google Maps importLibrary not available');
      }
      return null;
    }

    // Import the 'maps' library which contains DDS Boundaries
    const mapsLib = await window.google.maps.importLibrary('maps') as any;
    
    if (!mapsLib) {
      if (import.meta.env.DEV) {
        console.warn('Maps library import failed');
      }
      return null;
    }

    // According to Google's documentation, BoundaryLayer should be in the maps library
    // Check various possible locations
    const BoundaryLayer = mapsLib.BoundaryLayer || 
                         mapsLib.boundaryLayer ||
                         (window.google.maps as any).maps?.library?.maps?.BoundaryLayer;

    const FeatureLayer = mapsLib.FeatureLayer || 
                        mapsLib.featureLayer;

    const RegionLookup = mapsLib.RegionLookup || 
                        mapsLib.regionLookup;

    if (!BoundaryLayer) {
      if (import.meta.env.DEV) {
        console.warn('BoundaryLayer not found in maps library.');
        console.warn('Make sure Region Lookup API is enabled in Google Cloud Console:');
        console.warn('1. Go to https://console.cloud.google.com/apis/library');
        console.warn('2. Search for "Region Lookup API"');
        console.warn('3. Click "Enable"');
        console.warn('Available maps library properties:', Object.keys(mapsLib));
        console.warn('Maps library structure:', mapsLib);
      }
      return null;
    }

    return { FeatureLayer, BoundaryLayer, RegionLookup };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to load Google DDS Boundaries:', error);
      console.error('Make sure Region Lookup API is enabled in Google Cloud Console:');
      console.error('https://console.cloud.google.com/apis/library');
    }
    return null;
  }
}

/**
 * Create a feature layer for postal code boundaries
 * This displays zip code boundaries using Google's DDS Boundaries API
 * 
 * Based on: https://developers.google.com/maps/documentation/javascript/dds-boundaries/style-polygon
 */
export async function createPostalCodeBoundaryLayer(
  map: google.maps.Map,
  postalCodes: string[],
  getScoreColor: (zipCode: string) => string,
  onZipCodeClick?: (zipCode: string) => void
): Promise<any> {
  try {
    // Wait for map to be fully initialized
    if (!map) {
      if (import.meta.env.DEV) {
        console.warn('Map instance not provided');
      }
      return null;
    }

    const libraries = await loadGoogleDdsBoundaries();
    
    if (!libraries || !libraries.BoundaryLayer) {
      if (import.meta.env.DEV) {
        console.error('DDS Boundaries not available - make sure Region Lookup API is enabled');
        console.error('Steps to enable:');
        console.error('1. Go to https://console.cloud.google.com/apis/library');
        console.error('2. Search for "Region Lookup API"');
        console.error('3. Click "Enable"');
        console.error('4. Wait a few minutes for the API to propagate');
        console.error('5. Refresh your app');
      }
      return null;
    }

    const { BoundaryLayer } = libraries;

    // Create boundary layer for postal codes
    // According to Google's docs: new BoundaryLayer(map, options)
    const boundaryLayer = new BoundaryLayer(map, {
      boundaryType: 'postal_code',
      style: (feature: any) => {
        // Extract zip code from feature
        const zipCode = feature?.feature?.properties?.postalCode || 
                       feature?.properties?.postalCode || 
                       feature?.postalCode || 
                       feature?.displayName || 
                       feature?.properties?.displayName ||
                       feature?.feature?.displayName ||
                       '';
        
        const fillColor = getScoreColor(zipCode);
        
        return {
          fillColor: fillColor,
          fillOpacity: 0.35,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          strokeOpacity: 1,
          clickable: true,
          cursor: 'pointer'
        };
      }
    });

    // Filter for specific postal codes (Jacksonville area)
    // According to Google's docs, setFilter accepts postalCodes array
    try {
      if (typeof boundaryLayer.setFilter === 'function') {
        boundaryLayer.setFilter({
          postalCodes: postalCodes
        });
      } else {
        // Try alternative method names
        if (typeof (boundaryLayer as any).setPostalCodes === 'function') {
          (boundaryLayer as any).setPostalCodes(postalCodes);
        }
      }
    } catch (filterError) {
      if (import.meta.env.DEV) {
        console.warn('Failed to set filter on boundary layer:', filterError);
        console.warn('Boundary layer will show all postal codes in the visible area');
      }
    }

    // Add click handler if provided
    if (onZipCodeClick) {
      try {
        boundaryLayer.addListener('click', (event: any) => {
          // Extract zip code from click event
          // Event structure may vary, so check multiple possibilities
          const zipCode = event?.feature?.properties?.postalCode ||
                         event?.feature?.postalCode || 
                         event?.displayName || 
                         event?.properties?.postalCode ||
                         event?.properties?.displayName ||
                         event?.feature?.displayName ||
                         '';
          
          if (import.meta.env.DEV && zipCode) {
            console.log('Zip code boundary clicked:', zipCode);
          }
          
          if (zipCode) {
            onZipCodeClick(zipCode);
          }
        });
      } catch (clickError) {
        if (import.meta.env.DEV) {
          console.warn('Failed to add click listener to boundary layer:', clickError);
        }
      }
    }

    // BoundaryLayer is automatically displayed when created with a map
    // Store reference for potential cleanup
    (map as any).boundaryLayers = (map as any).boundaryLayers || [];
    (map as any).boundaryLayers.push(boundaryLayer);

    if (import.meta.env.DEV) {
      console.log('Postal code boundary layer created successfully for', postalCodes.length, 'zip codes');
    }

    return boundaryLayer;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to create postal code boundary layer:', error);
      console.error('Error details:', error);
      console.error('Error stack:', (error as Error).stack);
    }
    return null;
  }
}
