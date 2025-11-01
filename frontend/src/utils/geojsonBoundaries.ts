/**
 * Alternative approach for zip code boundaries using GeoJSON data
 * Uses Census TIGER/Line files or other GeoJSON sources
 * 
 * Data Source: U.S. Census Bureau TIGER/Line Files
 * Download from: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
 * 
 * For Jacksonville, FL zip codes, you'll need:
 * - Download the ZCTA5 (Zip Code Tabulation Area) shapefiles
 * - Convert to GeoJSON (can use online tools or ogr2ogr)
 * - Place GeoJSON files in public/data/zipcodes/ directory
 */

interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    [key: string]: any;
    ZCTA5CE10?: string; // Census format
    ZCTA5?: string; // Alternative format
    GEOID?: string; // Alternative format
    NAME?: string;
    [key: string]: any;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Load GeoJSON data from public folder
 */
export async function loadGeoJSONFromPublic(path: string): Promise<GeoJSON | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      // Don't log 404s - file might not exist, try next one
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to load GeoJSON: ${response.status} ${response.statusText}`);
    }
    
    // Get response text first to check what we're dealing with
    const text = await response.text();
    
    // Double-check it's not HTML (404 page)
    if (text.trim().startsWith('<!')) {
      if (import.meta.env.DEV) {
        console.warn(`Got HTML instead of JSON from ${path} - file might not exist`);
      }
      return null;
    }
    
    // Check if file is empty or too short
    if (!text || text.trim().length === 0) {
      if (import.meta.env.DEV) {
        console.warn(`File ${path} is empty`);
      }
      return null;
    }
    
    // Try to parse as JSON
    let data: GeoJSON;
    try {
      if (import.meta.env.DEV) {
        console.log(`Parsing JSON from ${path} (${(text.length / 1024 / 1024).toFixed(2)} MB)...`);
      }
      data = JSON.parse(text);
    } catch (parseError) {
      if (import.meta.env.DEV) {
        console.error(`Failed to parse JSON from ${path}:`, parseError);
        console.error(`File size: ${(text.length / 1024 / 1024).toFixed(2)} MB`);
        console.error(`First 200 chars: ${text.substring(0, 200)}`);
        console.error(`Last 200 chars: ${text.substring(Math.max(0, text.length - 200))}`);
        // Check if file might be incomplete
        if (!text.trim().endsWith('}') && !text.trim().endsWith(']')) {
          console.error('⚠️ File might be incomplete - does not end with } or ]');
        }
      }
      return null;
    }
    
    // Validate it's a valid GeoJSON FeatureCollection
    if (!data.type || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      if (import.meta.env.DEV) {
        console.warn(`Invalid GeoJSON format from ${path} - expected FeatureCollection`);
      }
      return null;
    }
    
    return data;
  } catch (error) {
    // Only log actual errors, not missing files
    if (import.meta.env.DEV && error instanceof Error && !error.message.includes('404')) {
      console.warn(`Failed to load GeoJSON from ${path}:`, error);
    }
    return null;
  }
}

/**
 * Convert GeoJSON coordinates to Google Maps LatLngLiteral[]
 */
function convertCoordinatesToPath(
  coordinates: number[][] | number[][][] | number[][][][],
  geometryType: 'Polygon' | 'MultiPolygon'
): google.maps.LatLngLiteral[][] {
  const paths: google.maps.LatLngLiteral[][] = [];

  if (geometryType === 'Polygon') {
    // Polygon: coordinates is number[][][]
    const coords = coordinates as number[][][];
    for (const ring of coords) {
      const path: google.maps.LatLngLiteral[] = ring.map(coord => ({
        lng: coord[0],
        lat: coord[1]
      }));
      paths.push(path);
    }
  } else if (geometryType === 'MultiPolygon') {
    // MultiPolygon: coordinates is number[][][][]
    const coords = coordinates as number[][][][];
    for (const polygon of coords) {
      for (const ring of polygon) {
        const path: google.maps.LatLngLiteral[] = ring.map(coord => ({
          lng: coord[0],
          lat: coord[1]
        }));
        paths.push(path);
      }
    }
  }

  return paths;
}

/**
 * Extract zip code from GeoJSON feature properties
 */
function extractZipCode(feature: GeoJSONFeature): string | null {
  const props = feature.properties;
  
  // Try various possible property names
  return props.ZCTA5CE10 || 
         props.ZCTA5 || 
         props.GEOID || 
         props.ZIPCODE || 
         props.ZIP_CODE || 
         props.POSTAL_CODE ||
         props.NAME?.match(/\d{5}/)?.[0] ||
         null;
}

/**
 * Create polygon for a single GeoJSON feature
 */
function createPolygonFromFeature(
  map: google.maps.Map,
  feature: GeoJSONFeature,
  getFillColor: (zipCode: string) => string,
  onZipCodeClick?: (zipCode: string) => void
): google.maps.Polygon | null {
  const zipCode = extractZipCode(feature);
  if (!zipCode) {
    if (import.meta.env.DEV) {
      console.warn('Feature missing zip code:', feature.properties);
    }
    return null;
  }

  const geometryType = feature.geometry.type;
  const paths = convertCoordinatesToPath(feature.geometry.coordinates, geometryType);
  
  if (paths.length === 0) {
    return null;
  }

  const fillColor = getFillColor(zipCode);

  const polygon = new google.maps.Polygon({
    paths: paths,
    strokeColor: '#ffffff',
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: fillColor,
    fillOpacity: 0.35,
    clickable: true,
    cursor: 'pointer'
  });

  polygon.setMap(map);

  // Add click handler
  if (onZipCodeClick) {
    polygon.addListener('click', () => {
      if (import.meta.env.DEV) {
        console.log('Zip code polygon clicked:', zipCode);
      }
      onZipCodeClick(zipCode);
    });
  }

  return polygon;
}

// Cache for loaded GeoJSON data
let geoJSONCache: GeoJSON | null = null;
// Primary file - Florida zip codes only
const geoJSONPath = '/data/zipcodes/florida-zipcodes.geojson';

/**
 * Load and cache GeoJSON file (loads once, reuses for subsequent calls)
 * Loads Florida zip codes only
 */
async function getCachedGeoJSON(): Promise<GeoJSON | null> {
  if (geoJSONCache) {
    return geoJSONCache;
  }

  try {
    geoJSONCache = await loadGeoJSONFromPublic(geoJSONPath);
    if (geoJSONCache && import.meta.env.DEV) {
      console.log(`✓ Loaded Florida GeoJSON file: ${geoJSONPath} (${geoJSONCache.features.length} zip codes)`);
    }
    return geoJSONCache;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to load Florida GeoJSON file:', error);
      console.error(`Make sure file exists at: ${geoJSONPath}`);
      console.error('See README.md for instructions on creating Florida zip code GeoJSON.');
    }
    return null;
  }
}

/**
 * Create zip code boundary for a single zip code from GeoJSON file
 * 
 * @param map Google Maps map instance
 * @param postalCode Single zip code to display
 * @param getScoreColor Function to get color for the zip code
 * @param onZipCodeClick Optional click handler
 */
export async function createZipCodeBoundaryFromGeoJSON(
  map: google.maps.Map,
  postalCode: string,
  getScoreColor: (zipCode: string) => string,
  onZipCodeClick?: (zipCode: string) => void
): Promise<google.maps.Polygon | null> {
  try {
    // Clear any existing polygons first
    clearZipCodePolygons(map);

    // Get cached GeoJSON (loads once)
    const geoJSON = await getCachedGeoJSON();

    if (!geoJSON) {
      if (import.meta.env.DEV) {
        console.warn('Failed to load GeoJSON. Make sure file exists at:');
        console.warn(`  - ${geoJSONPath}`);
        console.warn('See README.md for instructions on creating Florida zip code GeoJSON.');
      }
      return null;
    }

    // Find the specific zip code
    const requestedZip = postalCode.trim();
    const feature = geoJSON.features.find(feature => {
      const zipCode = extractZipCode(feature);
      return zipCode === requestedZip;
    });

    if (!feature) {
      if (import.meta.env.DEV) {
        console.warn(`Zip code ${requestedZip} not found in GeoJSON file`);
        console.warn('Available zip codes:', geoJSON.features.slice(0, 10).map(f => extractZipCode(f)).filter(Boolean));
      }
      return null;
    }

    // Create polygon for the found feature
    const polygon = createPolygonFromFeature(map, feature, getScoreColor, onZipCodeClick);

    if (polygon) {
      // Store polygon on map for cleanup
      (map as any).zipCodePolygons = (map as any).zipCodePolygons || [];
      (map as any).zipCodePolygons.push(polygon);

      if (import.meta.env.DEV) {
        console.log(`Created boundary polygon for zip code: ${requestedZip}`);
      }
    }

    return polygon;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to create zip code boundary from GeoJSON:', error);
    }
    return null;
  }
}

/**
 * Clean up all zip code polygons from the map
 */
export function clearZipCodePolygons(map: google.maps.Map): void {
  const polygons = (map as any).zipCodePolygons || [];
  polygons.forEach((polygon: google.maps.Polygon) => {
    polygon.setMap(null);
  });
  (map as any).zipCodePolygons = [];
}

