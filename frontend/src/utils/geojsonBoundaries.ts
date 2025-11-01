/**
 * Zip code boundaries using GeoJSON data from FDOT API
 * Loads all Florida zip codes from localStorage cache or public folder
 */

interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    [key: string]: any;
    ZCTA5CE10?: string; // Census format
    ZCTA5?: string; // Alternative format
    GEOID?: string; // Alternative format
    NAME?: string;
    ZIP?: string; // FDOT format
    PO_NAME?: string;
    POPULATION?: number;
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
      data = JSON.parse(text);
    } catch (parseError) {
      // Silently fail on JSON parse errors
      return null;
    }
    
    // Validate it's a valid GeoJSON FeatureCollection
    if (!data.type || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      // Invalid GeoJSON format - silently fail
      return null;
    }
    
    return data;
  } catch (error) {
    // Silently fail on file loading errors
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
 * Supports both FDOT API format (ZIP) and Census format (ZCTA5CE10, etc.)
 */
function extractZipCode(feature: GeoJSONFeature): string | null {
  const props = feature.properties;
  
  // Try various possible property names (FDOT API uses "ZIP")
  return props.ZIP ||           // FDOT API format (priority)
         props.ZCTA5CE10 || 
         props.ZCTA5 || 
         props.GEOID || 
         props.ZIPCODE || 
         props.ZIP_CODE || 
         props.POSTAL_CODE ||
         props.NAME?.match(/\d{5}/)?.[0] ||
         null;
}

/**
 * Extract city name from GeoJSON feature properties
 */
function extractCityName(feature: GeoJSONFeature): string | null {
  const props = feature.properties;
  return props.PO_NAME || props.CITY || props.CITY_NAME || props.NAME || null;
}

/**
 * Extract county name from GeoJSON feature properties
 */
function extractCountyName(feature: GeoJSONFeature): string | null {
  const props = feature.properties;
  // Try various possible property names for county
  return props.COUNTY || 
         props.COUNTY_NAME || 
         props.NAME || // Sometimes NAME might be county
         props.GEOID?.match(/\d{3}/)?.[0] || // Some formats include county code
         null;
}

/**
 * Extract population from GeoJSON feature properties
 */
function extractPopulation(feature: GeoJSONFeature): number | null {
  const props = feature.properties;
  return props.POPULATION || props.POP || null;
}


/**
 * Create polygon(s) for a single GeoJSON feature
 * For MultiPolygon with disconnected parts, creates multiple polygons
 */
function createPolygonFromFeature(
  map: google.maps.Map,
  feature: GeoJSONFeature,
  _getFillColor: (zipCode: string) => string,
  onZipCodeClick?: (zipCode: string) => void,
  infoWindow?: google.maps.InfoWindow
): google.maps.Polygon | null {
  const zipCode = extractZipCode(feature);
  if (!zipCode) {
    if (import.meta.env.DEV) {
      console.warn('Feature missing zip code:', feature.properties);
    }
    return null;
  }

  const geometryType = feature.geometry.type;
  const cityName = extractCityName(feature);
  const population = extractPopulation(feature);

  if (geometryType === 'Polygon') {
    // Single polygon - straightforward
    const paths = convertCoordinatesToPath(feature.geometry.coordinates, 'Polygon');
    
    if (paths.length === 0) {
      return null;
    }

    // Create polygon INVISIBLE by default (will show on hover or when selected)
    const polygon = new google.maps.Polygon({
      paths: paths,
      strokeColor: '#4285f4',
      strokeOpacity: 0,
      strokeWeight: 2,
      fillColor: '#4285f4',
      fillOpacity: 0,
      clickable: true
    });

    polygon.setMap(map);

    // Store selected state to prevent hover handlers from interfering
    let isSelected = false;
    (polygon as any).zipCode = zipCode;
    (polygon as any).setSelected = (selected: boolean) => {
      isSelected = selected;
    };

    // Add hover handlers with InfoWindow (like the demo)
    polygon.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
      if (!isSelected) {
        // Highlight on hover - make visible
        polygon.setOptions({
          strokeOpacity: 0.8,
          fillOpacity: 0.3,
          strokeWeight: 3,
          strokeColor: '#4285f4',
          fillColor: '#4285f4'
        });

        // Show InfoWindow with ZIP, city, and population (smaller, cleaner, no close button)
        if (infoWindow && e.latLng) {
          const popText = population ? population.toLocaleString() : 'N/A';
          const cityText = cityName || 'N/A';
          
          const content = `
            <style>
              /* Hide InfoWindow close button (X) */
              .gm-style .gm-style-iw-c button[title="Close"],
              .gm-style .gm-style-iw-c button[aria-label="Close"],
              .gm-style .gm-style-iw-d button {
                display: none !important;
              }
            </style>
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 8px; font-size: 10px; line-height: 1.3;">
              <div style="font-weight: 600; color: #1967d2; margin-bottom: 2px; font-size: 11px;">
                ZIP ${zipCode}
              </div>
              <div style="color: #5f6368; font-size: 9px;">
                ${cityText}
              </div>
              <div style="color: #80868b; font-size: 9px;">
                Pop: ${popText}
              </div>
            </div>
          `;
          
          infoWindow.setContent(content);
          
          // Position InfoWindow at top-left of cursor to be less intrusive
          const offsetPosition = {
            lat: e.latLng.lat() + 0.0005, // Slightly above cursor
            lng: e.latLng.lng() - 0.0005  // Slightly to the left
          };
          
          infoWindow.setPosition(offsetPosition);
          infoWindow.open(map);
        }
      }
    });

    polygon.addListener('mouseout', () => {
      if (!isSelected) {
        // Return to invisible state (default)
        polygon.setOptions({
          fillOpacity: 0,
          strokeOpacity: 0,
          strokeWeight: 2
        });
        
        if (infoWindow) {
          infoWindow.close();
        }
      }
    });

    // Add click handler - zoom to polygon bounds (like the demo)
    if (onZipCodeClick) {
      polygon.addListener('click', (event: google.maps.MapMouseEvent) => {
        // Prevent event from bubbling up to map
        if (event.stop) {
          event.stop();
        }
        
        // Calculate bounds from first path and zoom to it (like the demo)
        const polyBounds = new google.maps.LatLngBounds();
        if (paths[0]) {
          paths[0].forEach((pt: google.maps.LatLngLiteral) => {
            polyBounds.extend(pt);
          });
          map.fitBounds(polyBounds);
        }
        
        // Trigger search/load for this zip code
        if (import.meta.env.DEV) {
          console.log('Polygon clicked for zip code:', zipCode);
        }
        onZipCodeClick(zipCode);
      });
    }

    return polygon;
  } else if (geometryType === 'MultiPolygon') {
    // MultiPolygon - handle each polygon separately
    // For disconnected polygons, we create ONE polygon with all outer rings as separate paths
    // Google Maps Polygon can handle multiple disconnected paths
    const coordinates = feature.geometry.coordinates as number[][][][];
    const paths: google.maps.LatLngLiteral[][] = [];
    
    // Extract only the outer ring (first ring) of each polygon
    // Inner rings (holes) are ignored for simplicity - can be added later if needed
    for (const polygon of coordinates) {
      if (polygon.length > 0) {
        // First ring is the outer boundary
        const outerRing = polygon[0];
        const path: google.maps.LatLngLiteral[] = outerRing.map(coord => ({
          lng: coord[0],
          lat: coord[1]
        }));
        paths.push(path);
      }
    }
    
    if (paths.length === 0) {
      return null;
    }

    // Create one polygon with all disconnected parts, INVISIBLE by default
    const polygon = new google.maps.Polygon({
      paths: paths,
      strokeColor: '#4285f4',
      strokeOpacity: 0,
      strokeWeight: 2,
      fillColor: '#4285f4',
      fillOpacity: 0,
      clickable: true
    });

    polygon.setMap(map);

    // Store selected state to prevent hover handlers from interfering
    let isSelected = false;
    (polygon as any).zipCode = zipCode;
    (polygon as any).setSelected = (selected: boolean) => {
      isSelected = selected;
    };

    // Add hover handlers with InfoWindow (like the demo)
    polygon.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
      if (!isSelected) {
        // Highlight on hover - make visible
        polygon.setOptions({
          strokeOpacity: 0.8,
          fillOpacity: 0.3,
          strokeWeight: 3,
          strokeColor: '#4285f4',
          fillColor: '#4285f4'
        });

        // Show InfoWindow with ZIP, city, and population (smaller, cleaner, no close button)
        if (infoWindow && e.latLng) {
          const popText = population ? population.toLocaleString() : 'N/A';
          const cityText = cityName || 'N/A';
          
          const content = `
            <style>
              /* Hide InfoWindow close button (X) */
              .gm-style .gm-style-iw-c button[title="Close"],
              .gm-style .gm-style-iw-c button[aria-label="Close"],
              .gm-style .gm-style-iw-d button {
                display: none !important;
              }
            </style>
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 8px; font-size: 10px; line-height: 1.3;">
              <div style="font-weight: 600; color: #1967d2; margin-bottom: 2px; font-size: 11px;">
                ZIP ${zipCode}
              </div>
              <div style="color: #5f6368; font-size: 9px;">
                ${cityText}
              </div>
              <div style="color: #80868b; font-size: 9px;">
                Pop: ${popText}
              </div>
            </div>
          `;
          
          infoWindow.setContent(content);
          
          // Position InfoWindow at top-left of cursor to be less intrusive
          const offsetPosition = {
            lat: e.latLng.lat() + 0.0005, // Slightly above cursor
            lng: e.latLng.lng() - 0.0005  // Slightly to the left
          };
          
          infoWindow.setPosition(offsetPosition);
          infoWindow.open(map);
        }
      }
    });

    polygon.addListener('mouseout', () => {
      if (!isSelected) {
        // Return to invisible state (default)
        polygon.setOptions({
          fillOpacity: 0,
          strokeOpacity: 0,
          strokeWeight: 2
        });
        
        if (infoWindow) {
          infoWindow.close();
        }
      }
    });

    // Add click handler - zoom to polygon bounds (like the demo)
    if (onZipCodeClick) {
      polygon.addListener('click', (event: google.maps.MapMouseEvent) => {
        // Prevent event from bubbling up to map
        if (event.stop) {
          event.stop();
        }
        
        // Calculate bounds from first path and zoom to it (like the demo)
        const polyBounds = new google.maps.LatLngBounds();
        if (paths[0]) {
          paths[0].forEach((pt: google.maps.LatLngLiteral) => {
            polyBounds.extend(pt);
          });
          map.fitBounds(polyBounds);
        }
        
        // Trigger search/load for this zip code
        if (import.meta.env.DEV) {
          console.log('Polygon clicked for zip code:', zipCode);
        }
        onZipCodeClick(zipCode);
      });
    }

    return polygon;
  }

  return null;
}

// Cache for loaded GeoJSON data
let geoJSONCache: GeoJSON | null = null;
// All Florida zip codes file (from auto-query) - primary source
const allZipCodesPath = '/data/zipcodes/florida-zipcodes-all.json';
// Fallback file - Florida zip codes only
const geoJSONPath = '/data/zipcodes/florida-zipcodes.geojson';

// Cache for county GeoJSON data
let countiesCache: GeoJSON | null = null;
// County boundaries file path (updated to correct location)
const countiesPath = '/data/counties/florida-counties.json';

/**
 * Load and cache GeoJSON file (loads once, reuses for subsequent calls)
 * Tries localStorage cache first, then local GeoJSON file
 */
export async function getCachedGeoJSON(): Promise<GeoJSON | null> {
  if (geoJSONCache) {
    return geoJSONCache;
  }

  // First try localStorage cache (from auto-query for all Florida zip codes)
  try {
    const cachedAll = localStorage.getItem('florida-zipcodes-all-cache');
    if (cachedAll) {
      const parsed = JSON.parse(cachedAll) as GeoJSON;
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        geoJSONCache = parsed;
        if (import.meta.env.DEV) {
          console.log(`Loaded ${parsed.features.length} zip codes from localStorage (all Florida)`);
        }
        return geoJSONCache;
      }
    }
  } catch (cacheError) {
    // localStorage cache invalid or unavailable
    if (import.meta.env.DEV) {
      console.warn('localStorage cache unavailable:', cacheError);
    }
  }

  // Load from local GeoJSON files
  // Try all-zipcodes file first, then fallback to regular file
  try {
    geoJSONCache = await loadGeoJSONFromPublic(allZipCodesPath);
    if (geoJSONCache && import.meta.env.DEV) {
      console.log(`Loaded ${geoJSONCache.features.length} zip codes from local file (all Florida)`);
    }
    return geoJSONCache;
  } catch (error) {
    // Try regular file if all-zipcodes file doesn't exist
    try {
      geoJSONCache = await loadGeoJSONFromPublic(geoJSONPath);
      if (geoJSONCache && import.meta.env.DEV) {
        console.log(`Loaded ${geoJSONCache.features.length} zip codes from local GeoJSON file`);
      }
      return geoJSONCache;
    } catch (error) {
      // Silently fail - GeoJSON loading errors are handled gracefully
      return null;
    }
  }
}

/**
 * Load and cache county GeoJSON file (loads once, reuses for subsequent calls)
 * Tries localStorage cache first, then local GeoJSON file
 */
export async function getCachedCountiesGeoJSON(): Promise<GeoJSON | null> {
  if (countiesCache) {
    return countiesCache;
  }

  // First try localStorage cache (from auto-query for all Florida counties)
  try {
    const cachedCounties = localStorage.getItem('florida-counties-cache');
    if (cachedCounties) {
      const parsed = JSON.parse(cachedCounties) as GeoJSON;
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        countiesCache = parsed;
        if (import.meta.env.DEV) {
          console.log(`Loaded ${parsed.features.length} counties from localStorage`);
        }
        return countiesCache;
      }
    }
  } catch (cacheError) {
    // localStorage cache invalid or unavailable
    if (import.meta.env.DEV) {
      console.warn('localStorage counties cache unavailable:', cacheError);
    }
  }

  // Load from local GeoJSON file
  try {
    countiesCache = await loadGeoJSONFromPublic(countiesPath);
    if (countiesCache && import.meta.env.DEV) {
      console.log(`Loaded ${countiesCache.features.length} counties from local file`);
    }
    return countiesCache;
  } catch (error) {
    // Silently fail - GeoJSON loading errors are handled gracefully
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
  (map as any).zipCodePolygonMap = {};
}

/**
 * Update the color of a specific zip code polygon
 * When a zip code is selected, it becomes highlighted with the specified color (overrides default blue)
 */
export function updateZipCodePolygonColor(
  map: google.maps.Map,
  zipCode: string,
  color: string
): void {
  const polygonMap = (map as any).zipCodePolygonMap || {};
  const polygon = polygonMap[zipCode];
  
  if (polygon) {
    // Mark as selected to prevent hover handlers from resetting it
    if ((polygon as any).setSelected) {
      (polygon as any).setSelected(true);
    }
    
    // Close info window if open
    const infoWindow = (map as any).zipCodeInfoWindow;
    if (infoWindow) {
      infoWindow.close();
    }
    
    // Update to selected color (more prominent than default blue)
    polygon.setOptions({
      fillColor: color,
      fillOpacity: 0.4,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 3
    });
  }
}

/**
 * Reset a zip code polygon to default invisible state
 */
export function resetZipCodePolygonToInvisible(
  map: google.maps.Map,
  zipCode: string
): void {
  const polygonMap = (map as any).zipCodePolygonMap || {};
  const polygon = polygonMap[zipCode];
  
  if (polygon) {
    // Mark as not selected so hover handlers work again
    if ((polygon as any).setSelected) {
      (polygon as any).setSelected(false);
    }
    
    // Return to default invisible state (will show on hover)
    polygon.setOptions({
      strokeColor: '#4285f4',
      strokeOpacity: 0,
      strokeWeight: 2,
      fillColor: '#4285f4',
      fillOpacity: 0
    });
  }
}

/**
 * Get bounds for a zip code from GeoJSON
 * Returns the bounds that encompass the zip code polygon
 */
export async function getZipCodeBounds(zipCode: string): Promise<google.maps.LatLngBounds | null> {
  try {
    const geoJSON = await getCachedGeoJSON();
    if (!geoJSON) {
      return null;
    }

    const requestedZip = zipCode.trim();
    const feature = geoJSON.features.find(feature => {
      const code = extractZipCode(feature);
      return code === requestedZip;
    });

    if (!feature) {
      return null;
    }

    const bounds = new google.maps.LatLngBounds();
    
    if (feature.geometry.type === 'Polygon') {
      const coords = feature.geometry.coordinates as number[][][];
      for (const ring of coords) {
        for (const coord of ring) {
          bounds.extend({ lat: coord[1], lng: coord[0] });
        }
      }
    } else if (feature.geometry.type === 'MultiPolygon') {
      const coords = feature.geometry.coordinates as number[][][][];
      for (const polygon of coords) {
        for (const ring of polygon) {
          for (const coord of ring) {
            bounds.extend({ lat: coord[1], lng: coord[0] });
          }
        }
      }
    }

    return bounds;
  } catch (error) {
    return null;
  }
}

/**
 * Pan map to zip code with smooth animation
 */
export async function panToZipCode(
  map: google.maps.Map,
  zipCode: string,
  _zoomLevel: number = 14
): Promise<void> {
  try {
    // First try to get polygon from map and use its bounds (most reliable)
    const polygonMap = (map as any).zipCodePolygonMap || {};
    const polygon = polygonMap[zipCode];
    
    if (polygon) {
      const polygonBounds = new google.maps.LatLngBounds();
      const paths = polygon.getPaths();
      
      paths.forEach((path: google.maps.MVCArray<google.maps.LatLng>) => {
        path.forEach((point: google.maps.LatLng) => {
          polygonBounds.extend(point);
        });
      });
      
      if (!polygonBounds.isEmpty()) {
        // Use fitBounds for smooth animated pan/zoom
        map.fitBounds(polygonBounds, 50);
        return;
      }
    }
    
    // Fallback: calculate bounds from GeoJSON
    const bounds = await getZipCodeBounds(zipCode);
    if (bounds && !bounds.isEmpty()) {
      // Use fitBounds for smooth animation to show entire zip code
      map.fitBounds(bounds, 50);
    }
  } catch (error) {
    // Silently fail - panning errors are handled gracefully
    if (import.meta.env.DEV) {
      console.warn('Failed to pan to zip code:', zipCode, error);
    }
  }
}



/**
 * Find connected components of zip codes (main area vs islands)
 * Returns array of groups, where each group is an array of zip codes
 */
function findConnectedComponents(
  cityFeatures: GeoJSONFeature[]
): GeoJSONFeature[][] {
  // For simplicity, group by proximity to centroid
  // Zip codes close together are in the same component
  if (cityFeatures.length === 0) {
    return [];
  }
  
  // Calculate centroid of all city zip codes
  let totalLat = 0;
  let totalLng = 0;
  let totalPoints = 0;
  
  for (const feature of cityFeatures) {
    const paths = convertCoordinatesToPath(
      feature.geometry.coordinates,
      feature.geometry.type
    );
    if (paths.length > 0 && paths[0]) {
      paths[0].forEach(point => {
        totalLat += point.lat;
        totalLng += point.lng;
        totalPoints++;
      });
    }
  }
  
  if (totalPoints === 0) {
    return [cityFeatures];
  }
  
  const centroid = {
    lat: totalLat / totalPoints,
    lng: totalLng / totalPoints
  };
  
  // Group zip codes by distance from centroid
  // Main area: close to centroid
  // Islands: far from centroid
  const mainArea: GeoJSONFeature[] = [];
  const islands: GeoJSONFeature[] = [];
  
  const islandThreshold = 0.1; // degrees (roughly 11km)
  
  for (const feature of cityFeatures) {
    const paths = convertCoordinatesToPath(
      feature.geometry.coordinates,
      feature.geometry.type
    );
    if (paths.length > 0 && paths[0] && paths[0].length > 0) {
      // Calculate distance from centroid to first point of zip code
      const firstPoint = paths[0][0];
      const distLat = Math.abs(firstPoint.lat - centroid.lat);
      const distLng = Math.abs(firstPoint.lng - centroid.lng);
      const distance = Math.sqrt(distLat * distLat + distLng * distLng);
      
      if (distance < islandThreshold) {
        mainArea.push(feature);
      } else {
        islands.push(feature);
      }
    } else {
      mainArea.push(feature);
    }
  }
  
  const components: GeoJSONFeature[][] = [];
  if (mainArea.length > 0) {
    components.push(mainArea);
  }
  // Each island is its own component
  islands.forEach(island => {
    components.push([island]);
  });
  
  return components;
}


/**
 * Render city/county boundaries as a filled area (no borders)
 * Creates one homogeneous filled shape covering all zip codes in the city/county
 * For disconnected areas (islands), shows separate filled areas
 */
export async function renderCityCountyBoundaries(
  map: google.maps.Map,
  cityOrCountyName: string
): Promise<google.maps.Polygon[] | null> {
  try {
    const searchUpper = cityOrCountyName.toUpperCase().trim();
    
    // First check if this is a county search by checking the county GeoJSON file
    const countiesGeoJSON = await getCachedCountiesGeoJSON();
    if (countiesGeoJSON && countiesGeoJSON.features.length > 0) {
      // Find matching county in county file (case-insensitive partial match)
      // Try exact match first, then partial match
      let matchingCounty = countiesGeoJSON.features.find(feature => {
        const countyName = feature.properties.NAME || 
                          feature.properties.COUNTY_NAME || 
                          feature.properties.COUNTY;
        if (!countyName) return false;
        const countyUpper = countyName.toUpperCase().trim();
        // Remove "COUNTY" suffix if present for matching
        const countyUpperClean = countyUpper.replace(/\s+COUNTY\s*$/, '');
        const searchClean = searchUpper.replace(/\s+COUNTY\s*$/, '');
        return countyUpperClean === searchClean || countyUpper === searchUpper;
      });
      
      // If no exact match, try partial match
      if (!matchingCounty) {
        matchingCounty = countiesGeoJSON.features.find(feature => {
          const countyName = feature.properties.NAME || 
                            feature.properties.COUNTY_NAME || 
                            feature.properties.COUNTY;
          if (!countyName) return false;
          const countyUpper = countyName.toUpperCase().trim();
          const countyUpperClean = countyUpper.replace(/\s+COUNTY\s*$/, '');
          const searchClean = searchUpper.replace(/\s+COUNTY\s*$/, '');
          return countyUpperClean.includes(searchClean) || countyUpper.includes(searchUpper);
        });
      }
      
      // If we found a county match, use the county file directly
      if (matchingCounty) {
        // Clear previous city/county boundaries
        const existingBoundaries = (map as any).cityCountyBoundaries || [];
        existingBoundaries.forEach((poly: google.maps.Polygon) => poly.setMap(null));
        
        const boundaries: google.maps.Polygon[] = [];
        const allBounds = new google.maps.LatLngBounds();
        
        // Fill color - red shading with transparency
        const fillColor = '#ff6b6b';
        const fillOpacity = 0.3;
        
        // Convert county geometry to paths
        // For MultiPolygon, we need to group paths by polygon (islands)
        const geometryType = matchingCounty.geometry.type;
        const coordinates = matchingCounty.geometry.coordinates;
        
        if (geometryType === 'Polygon') {
          // Single polygon - all rings belong together
          const coords = coordinates as number[][][];
          const paths: google.maps.LatLngLiteral[][] = [];
          
          for (const ring of coords) {
            const path: google.maps.LatLngLiteral[] = ring.map(coord => ({
              lng: coord[0],
              lat: coord[1]
            }));
            paths.push(path);
            path.forEach(point => {
              allBounds.extend(point);
            });
          }
          
          if (paths.length > 0 && paths[0].length > 0) {
            // Use first path as outer ring, others as holes if any
            const filledArea = new google.maps.Polygon({
              paths: paths,
              strokeColor: 'transparent',
              strokeOpacity: 0,
              strokeWeight: 0,
              fillColor: fillColor,
              fillOpacity: fillOpacity,
              clickable: false,
              map: map
            });
            
            boundaries.push(filledArea);
          }
        } else if (geometryType === 'MultiPolygon') {
          // Multiple polygons (islands) - each polygon gets its own filled area
          const coords = coordinates as number[][][][];
          
          for (const polygon of coords) {
            const paths: google.maps.LatLngLiteral[][] = [];
            
            for (const ring of polygon) {
              const path: google.maps.LatLngLiteral[] = ring.map(coord => ({
                lng: coord[0],
                lat: coord[1]
              }));
              paths.push(path);
              path.forEach(point => {
                allBounds.extend(point);
              });
            }
            
            if (paths.length > 0 && paths[0].length > 0) {
              // Each polygon in MultiPolygon gets its own filled area
              const filledArea = new google.maps.Polygon({
                paths: paths,
                strokeColor: 'transparent',
                strokeOpacity: 0,
                strokeWeight: 0,
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                clickable: false,
                map: map
              });
              
              boundaries.push(filledArea);
            }
          }
        }
        
        if (boundaries.length > 0) {
          // Store for cleanup
          (map as any).cityCountyBoundaries = boundaries;
          
          // Fit bounds to show county
          if (!allBounds.isEmpty()) {
            map.fitBounds(allBounds, 50);
          }
          
          return boundaries;
        }
      }
    }
    
    // Fallback: use ZIP code data for city searches or if county not found
    const geoJSON = await getCachedGeoJSON();
    
    if (!geoJSON || geoJSON.features.length === 0) {
      return null;
    }
    
    // Try both city and county matches from ZIP code data
    const filteredFeatures = geoJSON.features.filter(feature => {
      const city = extractCityName(feature);
      const county = extractCountyName(feature);
      
      // Match if city name includes the search term
      if (city && city.toUpperCase().includes(searchUpper)) {
        return true;
      }
      
      // Match if county name includes the search term
      if (county && county.toUpperCase().includes(searchUpper)) {
        return true;
      }
      
      return false;
    });
    
    if (filteredFeatures.length === 0) {
      return null;
    }
    
    // Clear previous city/county boundaries
    const existingBoundaries = (map as any).cityCountyBoundaries || [];
    existingBoundaries.forEach((poly: google.maps.Polygon) => poly.setMap(null));
    
    // Find connected components (main area vs islands)
    const components = findConnectedComponents(filteredFeatures);
    
    const boundaries: google.maps.Polygon[] = [];
    const allBounds = new google.maps.LatLngBounds();
    
    // Fill color - red shading with transparency
    const fillColor = '#ff6b6b';
    const fillOpacity = 0.3; // Semi-transparent red
    
    // Process each component separately (main area + islands)
    for (const component of components) {
      // Collect all paths from all zip codes in this component
      // Google Maps will automatically create a union when paths overlap
      const allPaths: google.maps.LatLngLiteral[][] = [];
      
      for (const feature of component) {
        const paths = convertCoordinatesToPath(
          feature.geometry.coordinates,
          feature.geometry.type
        );
        
        // Add outer ring (first path) of each zip code
        if (paths.length > 0 && paths[0] && paths[0].length > 0) {
          allPaths.push(paths[0]);
          
          // Extend bounds
          paths[0].forEach(point => {
            allBounds.extend(point);
          });
        }
      }
      
      if (allPaths.length === 0) {
        continue;
      }
      
      // Create one filled polygon with all paths
      // Google Maps will handle overlapping paths to create a union-like shape
      // Using multiple paths creates one homogeneous filled area
      const filledArea = new google.maps.Polygon({
        paths: allPaths,
        strokeColor: 'transparent', // No border lines
        strokeOpacity: 0,
        strokeWeight: 0,
        fillColor: fillColor,
        fillOpacity: fillOpacity, // Semi-transparent red fill
        clickable: false, // Not clickable, just visual
        map: map
      });
      
      boundaries.push(filledArea);
    }
    
    if (boundaries.length === 0) {
      return null;
    }
    
    // Store for cleanup
    (map as any).cityCountyBoundaries = boundaries;
    
    // Fit bounds to show all filled areas
    if (!allBounds.isEmpty()) {
      map.fitBounds(allBounds, 50);
    }
    
    return boundaries;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Failed to render city/county boundaries for ${cityOrCountyName}:`, error);
    }
    return null;
  }
}

/**
 * Clear city/county boundaries from map
 */
export function clearCityCountyBoundaries(map: google.maps.Map): void {
  const boundaries = (map as any).cityCountyBoundaries || [];
  boundaries.forEach((poly: google.maps.Polygon) => poly.setMap(null));
  (map as any).cityCountyBoundaries = [];
}

/**
 * Load all zip code boundaries from GeoJSON and display them on the map
 * All zip codes are invisible by default, highlight on hover, and stay highlighted when clicked
 * 
 * @param map Google Maps map instance
 * @param getScoreColor Function to get color for a zip code (defaults to blue)
 * @param onZipCodeClick Optional click handler for zip codes
 */
export async function loadAllZipCodeBoundaries(
  map: google.maps.Map,
  getScoreColor: (zipCode: string) => string = () => '#4285f4',
  onZipCodeClick?: (zipCode: string) => void
): Promise<void> {
  try {
    // Get cached GeoJSON (loads once)
    const geoJSON = await getCachedGeoJSON();

    if (!geoJSON) {
      // Silently fail - GeoJSON may not be available
      return;
    }

    // Create shared InfoWindow for all polygons (like the demo)
    // Configure InfoWindow to be smaller and without close button
    const infoWindow = new google.maps.InfoWindow({
      disableAutoPan: false, // Still allow auto-pan but make it subtle
      maxWidth: 150 // Smaller max width for compact display
    });

    // Initialize polygon storage
    const polygonMap: { [zipCode: string]: google.maps.Polygon } = {};
    const allPolygons: google.maps.Polygon[] = [];

    // Create polygons for all features
    for (const feature of geoJSON.features) {
      const zipCode = extractZipCode(feature);
      
      if (!zipCode) {
        continue; // Skip features without zip codes
      }

      // Create polygon invisible by default (will show on hover or when selected)
      const polygon = createPolygonFromFeature(
        map,
        feature,
        (zip) => getScoreColor(zip),
        onZipCodeClick,
        infoWindow
      );

      if (polygon) {
        // Make invisible by default - will show on hover
        polygon.setOptions({
          fillOpacity: 0,
          strokeOpacity: 0
        });
        
        polygonMap[zipCode] = polygon;
        allPolygons.push(polygon);
      }
    }

    // Store polygons on map for cleanup and updates
    (map as any).zipCodePolygons = allPolygons;
    (map as any).zipCodePolygonMap = polygonMap;
    (map as any).zipCodeInfoWindow = infoWindow;
  } catch (error) {
    // Silently fail - boundary loading errors are handled gracefully
    if (import.meta.env.DEV) {
      console.warn('Failed to load all zip code boundaries:', error);
    }
  }
}

