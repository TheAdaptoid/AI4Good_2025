/**
 * FDOT (Florida Department of Transportation) ArcGIS REST API
 * For querying Florida zip code boundaries with accurate, up-to-date data
 * 
 * API Endpoint: https://gis.fdot.gov/arcgis/rest/services/Admin_Boundaries/FeatureServer/8/query
 * 
 * This provides official Florida state data with:
 * - ZIP codes
 * - City names (PO_NAME)
 * - Population data
 * - Accurate geometric boundaries
 */

export interface FDOTFeature {
  attributes: {
    ZIP: string;
    PO_NAME?: string;
    POPULATION?: number;
    [key: string]: any;
  };
  geometry: {
    rings?: number[][][]; // Polygon format: [[[lng, lat], ...]]
    spatialReference?: {
      wkid?: number;
    };
  };
}

export interface FDOTResponse {
  features?: FDOTFeature[];
  error?: {
    code?: number;
    message?: string;
    details?: string[];
  };
  exceededTransferLimit?: boolean;
}

/**
 * NOTE: FDOT API calls are no longer used in production
 * All data is loaded from localStorage cache or local GeoJSON file
 * 
 * The functions below are kept only for:
 * - Manual data fetching via window.autoQueryFloridaZipCodes()
 * - Future use if needed to refresh data
 */

/**
 * Build query URL for FDOT ArcGIS REST API (for manual fetching only)
 */
export function buildFDOTQueryURL(
  whereClause: string = "1=1",
  resultOffset: number = 0,
  resultRecordCount: number = 1000
): string {
  const FDOT_ZIP_QUERY_BASE = "https://gis.fdot.gov/arcgis/rest/services/Admin_Boundaries/FeatureServer/8/query";
  
  const params = new URLSearchParams({
    f: "pjson",  // Use pjson format for better compatibility
    where: whereClause,
    outFields: "ZIP,PO_NAME,POPULATION",
    returnGeometry: "true",
    outSR: "4326",  // WGS84 coordinate system
    resultOffset: resultOffset.toString(),
    resultRecordCount: resultRecordCount.toString()
  });
  
  return FDOT_ZIP_QUERY_BASE + "?" + params.toString();
}

/**
 * Query FDOT API for county boundaries (if available)
 * Checks FeatureServer layer 7 (typically county boundaries)
 * For manual use only - not used in production
 */
export async function queryFDOTCounties(
  whereClause: string = "1=1",
  resultOffset: number = 0,
  resultRecordCount: number = 1000
): Promise<any> {
  // Try different possible layer numbers for counties
  // FDOT typically uses: 8=zip codes, might have county layers at other numbers
  const possibleLayers = [7, 6, 5, 4, 3, 2, 1, 0];
  
  for (const layerNum of possibleLayers) {
    try {
      const url = `https://gis.fdot.gov/arcgis/rest/services/Admin_Boundaries/FeatureServer/${layerNum}/query?f=json&where=${encodeURIComponent(whereClause)}&outFields=*&returnGeometry=true&outSR=4326&resultOffset=${resultOffset}&resultRecordCount=${resultRecordCount}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        // This layer doesn't exist or has an error, try next
        continue;
      }
      
      if (data.features && data.features.length > 0) {
        // Check if this looks like county data (should have exactly 67 counties for Florida)
        const firstFeature = data.features[0];
        if (firstFeature.attributes) {
          const attrs = firstFeature.attributes;
          const fieldNames = Object.keys(attrs).map(k => k.toUpperCase());
          
          // Look for county-specific field names
          const hasCountyField = fieldNames.some(key => 
            key === 'COUNTY' || 
            key === 'COUNTY_NAME' || 
            key === 'NAME' ||
            key.includes('CNTY')
          );
          
          // Get the total count from the API (query with resultRecordCount=0 for metadata)
          let totalCount = data.totalRecordCount || data.count;
          if (!totalCount || totalCount === 1) {
            // If we only got 1 feature, need to get actual total count
            try {
              const countUrl = `https://gis.fdot.gov/arcgis/rest/services/Admin_Boundaries/FeatureServer/${layerNum}/query?f=json&where=1=1&outFields=*&returnGeometry=false&resultRecordCount=0`;
              const countResponse = await fetch(countUrl);
              const countData = await countResponse.json();
              totalCount = countData.totalRecordCount || countData.count;
            } catch (error) {
              // Can't get count, skip this layer
              continue;
            }
          }
          
          // CRITICAL: Florida has EXACTLY 67 counties - must match exactly
          const isCountyCount = totalCount === 67;
          
          // Also check the actual feature - if it doesn't have ZIP field, it's likely not zip codes
          const hasZipField = fieldNames.includes('ZIP');
          
          // Must have county field, must be EXACTLY 67 features, and must NOT have ZIP field
          if (hasCountyField && isCountyCount && !hasZipField) {
            if (import.meta.env.DEV) {
              console.log(`Found county layer at FeatureServer/${layerNum}:`, {
                count: totalCount,
                fields: Object.keys(attrs),
                sample: firstFeature.attributes
              });
            }
            return { ...data, layerNum, totalRecordCount: totalCount }; // Include layer number and total count
          } else if (hasCountyField && !hasZipField && import.meta.env.DEV) {
            // Log potential candidates for debugging
            console.log(`Layer ${layerNum} has county-like fields but wrong count (${totalCount} instead of 67):`, {
              fields: Object.keys(attrs),
              sample: firstFeature.attributes
            });
          }
        }
      }
    } catch (error) {
      // Continue to next layer
      continue;
    }
  }
  
  return null;
}

/**
 * Convert FDOT county feature to GeoJSON format
 */
export function convertFDOTCountyFeatureToGeoJSON(feature: any, _layerNum: number): {
  type: 'Feature';
  properties: {
    [key: string]: any;
    COUNTY?: string;
    COUNTY_NAME?: string;
    NAME?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
} | null {
  if (!feature.geometry) {
    return null;
  }
  
  // Handle ArcGIS rings format
  let coordinates: number[][][] | number[][][][] = [];
  
  if (feature.geometry.rings) {
    // Polygon format: [[[lng, lat], ...], ...]
    coordinates = feature.geometry.rings.map((ring: number[][]) => 
      ring.map((coord: number[]) => [coord[0], coord[1]]) // Ensure [lng, lat] format
    ) as number[][][];
  } else if (feature.geometry.coordinates) {
    // Already in GeoJSON format
    coordinates = feature.geometry.coordinates;
  } else {
    return null;
  }
  
  // Extract county name from attributes
  const attrs = feature.attributes || {};
  let countyName = attrs.COUNTY || attrs.COUNTY_NAME || attrs.NAME || attrs.NAME_1 || attrs.CNTYNAME || null;
  
  // Try to find any field that might be the county name
  if (!countyName) {
    const nameFields = Object.keys(attrs).filter(key => 
      key.toUpperCase().includes('NAME') || 
      key.toUpperCase().includes('COUNTY')
    );
    if (nameFields.length > 0) {
      countyName = attrs[nameFields[0]];
    }
  }
  
  return {
    type: 'Feature',
    properties: {
      ...attrs,
      COUNTY: countyName,
      COUNTY_NAME: countyName,
      NAME: countyName
    },
    geometry: {
      type: coordinates.length === 1 || (Array.isArray(coordinates[0]) && !Array.isArray(coordinates[0][0])) 
        ? 'Polygon' 
        : 'MultiPolygon',
      coordinates: coordinates as number[][][] | number[][][][]
    }
  };
}

/**
 * Convert FDOT county response to GeoJSON FeatureCollection
 * Also handles local GeoJSON files that might already be in GeoJSON format
 */
export function convertFDOTCountiesToGeoJSON(response: any): {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      [key: string]: any;
      COUNTY?: string;
      COUNTY_NAME?: string;
      NAME?: string;
    };
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][] | number[][][][];
    };
  }>;
} | null {
  if (!response || !response.features || response.features.length === 0) {
    return null;
  }
  
  // Check if features are already in GeoJSON format (from local file)
  const firstFeature = response.features[0];
  if (firstFeature.type === 'Feature' && firstFeature.geometry && firstFeature.properties) {
    // Already in GeoJSON format - just ensure COUNTY fields are set
    const features = response.features.map((feature: any) => {
      // If COUNTY field doesn't exist or is incorrect, try to extract from NAME
      if (!feature.properties.COUNTY || feature.properties.COUNTY === feature.properties.NAME) {
        // This might be a city/place - keep as is, but preserve structure
        return feature;
      }
      return feature;
    });
    
    return {
      type: 'FeatureCollection',
      features
    };
  }
  
  // Convert from FDOT ArcGIS format
  const layerNum = response.layerNum || 7;
  const features = response.features
    .map((feature: any) => convertFDOTCountyFeatureToGeoJSON(feature, layerNum))
    .filter((feature: any): feature is NonNullable<typeof feature> => feature !== null);
  
  if (features.length === 0) {
    return null;
  }
  
  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Query all Florida counties from FDOT API (with pagination support)
 * Florida has 67 counties
 */
export async function getAllFDOTCounties(
  progressCallback?: ProgressCallback,
  delayMs: number = 500
): Promise<ReturnType<typeof convertFDOTCountiesToGeoJSON>> {
  // First, find which layer has county data
  // Query with limit 1 to check what we're dealing with
  const initialQuery = await queryFDOTCounties("1=1", 0, 1);
  if (!initialQuery) {
    throw new Error('Could not find county boundary layer in FDOT API. Please check if FDOT has a county boundary service.');
  }
  
  const layerNum = initialQuery.layerNum || 7;
  
  // Get the actual total count from the API (query with resultRecordCount=0 to get metadata only)
  let totalCount = 67; // Default to expected count
  try {
    const countUrl = `https://gis.fdot.gov/arcgis/rest/services/Admin_Boundaries/FeatureServer/${layerNum}/query?f=json&where=1=1&outFields=*&returnGeometry=false&resultRecordCount=0`;
    const countResponse = await fetch(countUrl);
    const countData = await countResponse.json();
    totalCount = countData.totalRecordCount || countData.count || initialQuery.totalRecordCount || 67;
  } catch (error) {
    // Fallback to count from initial query
    totalCount = initialQuery.totalRecordCount || initialQuery.count || 67;
  }
  
  // CRITICAL: Validate that we got the right layer (Florida has exactly 67 counties)
  // If we don't have exactly 67, this is NOT the county layer
  if (totalCount !== 67) {
    throw new Error(
      `Wrong layer detected! Expected 67 counties but found ${totalCount} features in layer ${layerNum}. ` +
      `This layer is likely not the county boundary layer. ` +
      `Please check the FDOT API documentation or try a different layer number.`
    );
  }
  
  if (progressCallback) {
    progressCallback({
      current: 0,
      total: totalCount,
      percentage: 0,
      currentBatch: 1,
      message: `Found county layer. Querying ${totalCount} counties...`
    });
  }
  
  const allFeatures: any[] = [];
  let offset = 0;
  const batchSize = 1000; // FDOT typically allows up to 1000 records per query
  
  while (offset < totalCount) {
    const url = `https://gis.fdot.gov/arcgis/rest/services/Admin_Boundaries/FeatureServer/${layerNum}/query?f=json&where=1=1&outFields=*&returnGeometry=true&outSR=4326&resultOffset=${offset}&resultRecordCount=${batchSize}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`FDOT API error: ${data.error.message || 'Unknown error'}`);
      }
      
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        
        if (progressCallback) {
          progressCallback({
            current: Math.min(offset, totalCount),
            total: totalCount,
            percentage: Math.round((Math.min(offset, totalCount) / totalCount) * 100),
            currentBatch: Math.ceil(offset / batchSize),
            message: `Retrieved ${offset} of ${totalCount} counties...`
          });
        }
        
        // If we got fewer records than requested, we're done
        if (data.features.length < batchSize) {
          break;
        }
      } else {
        break;
      }
      
      // Delay between requests
      if (offset < totalCount) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error querying counties:', error);
      }
      throw error;
    }
  }
  
  return convertFDOTCountiesToGeoJSON({ ...initialQuery, features: allFeatures });
}

/**
 * Download Florida counties from GitHub repository (reliable source)
 * Source: https://github.com/danielcs88/fl_geo_json
 * This provides accurate 67 Florida counties in GeoJSON format
 */
export async function downloadFloridaCountiesFromGitHub(
  progressCallback?: ProgressCallback
): Promise<ReturnType<typeof convertFDOTCountiesToGeoJSON>> {
  const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/danielcs88/fl_geo_json/master/geojson-fl-counties-fips.json';
  
  try {
    if (progressCallback) {
      progressCallback({
        current: 0,
        total: 67,
        percentage: 0,
        currentBatch: 0,
        message: 'Downloading Florida counties from GitHub...'
      });
    }
    
    const response = await fetch(GITHUB_RAW_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('Invalid GeoJSON format received from GitHub');
    }
    
    if (progressCallback) {
      progressCallback({
        current: data.features.length,
        total: data.features.length,
        percentage: 100,
        currentBatch: 1,
        message: `Downloaded ${data.features.length} counties from GitHub`
      });
    }
    
    // Normalize the data to our expected format
    // The GitHub file might have different field names, so we normalize them
    const normalizedFeatures = data.features.map((feature: any) => {
      const props = feature.properties || {};
      
      // Extract county name from various possible fields
      let countyName = props.NAME || props.NAME_1 || props.COUNTY || props.COUNTY_NAME || 
                       props.COUNTYFP || props.CNTYNAME || null;
      
      // If no county name found, try to extract from FIPS code or other fields
      if (!countyName && props.GEOID) {
        // GEOID format for counties is typically STATE(2) + COUNTY(3) + ...
        // We can't reverse lookup county name from FIPS, but we can preserve the structure
      }
      
      return {
        type: 'Feature',
        properties: {
          ...props,
          COUNTY: countyName,
          COUNTY_NAME: countyName,
          NAME: countyName || props.NAME || props.NAME_1,
          // Preserve original fields
          FIPS: props.COUNTYFP || props.FIPS || props.GEOID,
          GEOID: props.GEOID || props.COUNTYFP
        },
        geometry: feature.geometry
      };
    });
    
    const normalized: ReturnType<typeof convertFDOTCountiesToGeoJSON> = {
      type: 'FeatureCollection' as const,
      features: normalizedFeatures
    };
    
    // Validate we got exactly 67 counties
    if (normalizedFeatures.length !== 67) {
      console.warn(`Expected 67 counties but got ${normalizedFeatures.length}. Continuing anyway...`);
    }
    
    return normalized;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to download counties from GitHub:', error);
    }
    throw error;
  }
}

/**
 * Auto-query all Florida counties with automatic saving
 * Checks local file first, then tries GitHub, then falls back to FDOT API query
 * Automatically saves to localStorage as it progresses
 */
export async function autoQueryAllFloridaCounties(
  progressCallback?: ProgressCallback
): Promise<ReturnType<typeof convertFDOTCountiesToGeoJSON>> {
  // First, try to load from local file
  try {
    const localFile = await fetch('/data/counties/florida-counties.json');
    if (localFile.ok) {
      const data = await localFile.json();
      if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        if (progressCallback) {
          progressCallback({
            current: data.features.length,
            total: data.features.length,
            percentage: 100,
            currentBatch: 1,
            message: `Loaded ${data.features.length} features from local file`
          });
        }
        
        // Convert to our expected format
        const converted = convertFDOTCountiesToGeoJSON({ features: data.features, layerNum: 7 });
        if (converted) {
          // Save to localStorage for faster future access
          try {
            localStorage.setItem('florida-counties-cache', JSON.stringify(converted));
            if (import.meta.env.DEV) {
              console.log(`Loaded and cached ${converted.features.length} features from local file`);
            }
          } catch (storageError) {
            // Non-critical - localStorage might be full
          }
          
          return converted;
        }
      }
    }
  } catch (error) {
    // Local file doesn't exist or couldn't be loaded - continue to download
    if (import.meta.env.DEV) {
      console.log('Local county file not found, downloading from GitHub...');
    }
  }
  
  // Second, try to download from GitHub (reliable source for 67 counties)
  try {
    const result = await downloadFloridaCountiesFromGitHub(progressCallback);
    
    if (result && result.features.length > 0) {
      // Auto-save to localStorage
      try {
        localStorage.setItem('florida-counties-cache', JSON.stringify(result));
        if (import.meta.env.DEV) {
          console.log(`Saved ${result.features.length} counties to localStorage`);
        }
      } catch (storageError) {
        if (import.meta.env.DEV) {
          console.warn('Could not save to localStorage:', storageError);
        }
      }
      
      // Also download as file
      downloadGeoJSONAsFile(result, 'florida-counties.json');
      if (import.meta.env.DEV) {
        console.log('✅ Downloaded Florida counties GeoJSON file');
      }
      
      return result;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to download from GitHub, trying FDOT API...', error);
    }
  }
  
  // Fallback to FDOT API query (might not have counties)
  try {
    if (progressCallback) {
      progressCallback({
        current: 0,
        total: 67,
        percentage: 0,
        currentBatch: 0,
        message: 'Starting FDOT API query for all Florida counties...'
      });
    }
    
    const result = await getAllFDOTCounties(progressCallback);
    
    if (result && result.features.length > 0) {
      // Auto-save to localStorage
      try {
        localStorage.setItem('florida-counties-cache', JSON.stringify(result));
        if (import.meta.env.DEV) {
          console.log(`Saved ${result.features.length} counties to localStorage`);
        }
      } catch (storageError) {
        if (import.meta.env.DEV) {
          console.warn('Could not save to localStorage:', storageError);
        }
      }
      
      // Also download as file
      downloadGeoJSONAsFile(result, 'florida-counties.json');
      
      return result;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to query counties from FDOT API:', error);
    }
  }
  
  return null;
}

/**
 * Query FDOT API for zip codes with pagination support
 * @param whereClause SQL WHERE clause (e.g., "ZIP='32256'" or "1=1" for all)
 * @param resultOffset Starting record index (for pagination)
 * @param resultRecordCount Maximum records to return (max 2000, default 1000)
 * @returns FDOT API response
 */
export async function queryFDOTZipCodes(
  whereClause: string = "1=1",
  resultOffset: number = 0,
  resultRecordCount: number = 1000
): Promise<FDOTResponse> {
  const url = buildFDOTQueryURL(whereClause, resultOffset, resultRecordCount);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data: FDOTResponse = await response.json();
    
    if (data.error) {
      throw new Error(`FDOT API error: ${data.error.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('FDOT API query error:', error);
    }
    throw error;
  }
}

/**
 * Convert FDOT ArcGIS feature to GeoJSON format
 */
export function convertFDOTFeatureToGeoJSON(feature: FDOTFeature): {
  type: 'Feature';
  properties: {
    ZIP: string;
    PO_NAME?: string;
    POPULATION?: number;
    [key: string]: any;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
} | null {
  if (!feature.geometry.rings || feature.geometry.rings.length === 0) {
    return null;
  }
  
  // ArcGIS rings format: [[[lng, lat], ...], ...] (same as GeoJSON Polygon)
  // For simplicity, we'll treat all rings as a single Polygon
  // (MultiPolygon support can be added if needed based on ring grouping)
  const coordinates = feature.geometry.rings.map(ring => 
    ring.map(coord => [coord[0], coord[1]]) // Ensure [lng, lat] format
  );
  
  return {
    type: 'Feature',
    properties: {
      ...feature.attributes,
      ZIP: feature.attributes.ZIP,
      PO_NAME: feature.attributes.PO_NAME,
      POPULATION: feature.attributes.POPULATION
    },
    geometry: {
      type: 'Polygon',
      coordinates: coordinates as number[][][]
    }
  };
}

/**
 * Convert FDOT API response to GeoJSON FeatureCollection
 */
export function convertFDOTToGeoJSON(response: FDOTResponse): {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      ZIP: string;
      PO_NAME?: string;
      POPULATION?: number;
      [key: string]: any;
    };
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][] | number[][][][];
    };
  }>;
} | null {
  if (!response.features || response.features.length === 0) {
    return null;
  }
  
  const features = response.features
    .map(convertFDOTFeatureToGeoJSON)
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null);
  
  if (features.length === 0) {
    return null;
  }
  
  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Query all Florida zip codes from FDOT API and convert to GeoJSON (for manual fetching only)
 * Not used in production - all data loaded from local files
 * @param whereClause Optional WHERE clause filter (default: all Florida zip codes)
 */
export async function getAllFDOTZipCodesAsGeoJSON(
  whereClause: string = "1=1"
): Promise<ReturnType<typeof convertFDOTToGeoJSON>> {
  try {
    const response = await queryFDOTZipCodes(whereClause);
    return convertFDOTToGeoJSON(response);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to fetch FDOT zip codes:', error);
    }
    return null;
  }
}

/**
 * Query a specific zip code from FDOT API (for manual fetching only)
 */
export async function getFDOTZipCodeAsGeoJSON(zipCode: string): Promise<ReturnType<typeof convertFDOTToGeoJSON>> {
  // Escape single quotes in zip code for SQL WHERE clause
  const safeZip = zipCode.replace(/'/g, "''");
  const whereClause = `ZIP='${safeZip}'`;
  
  return getAllFDOTZipCodesAsGeoJSON(whereClause);
}

/**
 * Query zip codes for specific cities from FDOT API (for manual fetching only)
 * Uses LIKE query with city names (case-insensitive via UPPER)
 */
export async function getFDOTZipCodesByCity(cityNames: string[]): Promise<ReturnType<typeof convertFDOTToGeoJSON>> {
  if (cityNames.length === 0) {
    return null;
  }

  // Build WHERE clause: UPPER(PO_NAME) LIKE '%JACKSONVILLE%' OR UPPER(PO_NAME) LIKE '%ORLANDO%' OR ...
  const conditions = cityNames.map(city => {
    const safeCity = city.replace(/'/g, "''").toUpperCase();
    return `UPPER(PO_NAME) LIKE '%${safeCity}%'`;
  });
  
  const whereClause = conditions.join(' OR ');
  
  return getAllFDOTZipCodesAsGeoJSON(whereClause);
}

/**
 * Export GeoJSON to downloadable JSON file (for caching/storage)
 * This can be called programmatically to save FDOT data locally
 * Accepts any GeoJSON FeatureCollection
 */
export function downloadGeoJSONAsFile(
  geoJSON: ReturnType<typeof convertFDOTToGeoJSON> | ReturnType<typeof convertFDOTCountiesToGeoJSON> | any,
  filename: string = 'florida-data.json'
): void {
  if (!geoJSON || !geoJSON.features) {
    return;
  }
  
  const jsonStr = JSON.stringify(geoJSON, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  if (import.meta.env.DEV) {
    console.log(`Exported ${geoJSON.features.length} features to ${filename}`);
  }
}

/**
 * Progress callback type for incremental queries
 */
export type ProgressCallback = (progress: {
  current: number;
  total: number;
  percentage: number;
  currentBatch: number;
  message: string;
}) => void;

/**
 * Incrementally query all Florida zip codes using ZIP code ranges
 * Florida ZIP codes range from 32000-34999 (approx. 3000 zip codes)
 * 
 * This function queries in batches by ZIP code ranges to avoid timeouts
 * @param progressCallback Optional callback for progress updates
 * @param batchSize Number of zip codes per range query (default: 500)
 * @param delayMs Delay between requests to avoid rate limiting (default: 500ms)
 * @returns GeoJSON with all Florida zip codes
 */
export async function getAllFloridaZipCodesIncrementally(
  progressCallback?: ProgressCallback,
  batchSize: number = 500,
  delayMs: number = 500
): Promise<ReturnType<typeof convertFDOTToGeoJSON>> {
  // Florida ZIP codes range from 32000-34999
  const ZIP_START = 32000;
  const ZIP_END = 34999;
  
  // Create ZIP code ranges
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = ZIP_START; start <= ZIP_END; start += batchSize) {
    const end = Math.min(start + batchSize - 1, ZIP_END);
    ranges.push({ start, end });
  }
  
  const allFeatures: ReturnType<typeof convertFDOTFeatureToGeoJSON>[] = [];
  let totalEstimated = ranges.length * batchSize; // Estimate, will update
  
  // Query each range
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const whereClause = `ZIP >= '${range.start.toString().padStart(5, '0')}' AND ZIP <= '${range.end.toString().padStart(5, '0')}'`;
    
    try {
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: ranges.length,
          percentage: Math.round(((i + 1) / ranges.length) * 100),
          currentBatch: i + 1,
          message: `Querying ZIP range ${range.start}-${range.end}...`
        });
      }
      
      const response = await queryFDOTZipCodes(whereClause);
      const geoJSON = convertFDOTToGeoJSON(response);
      
      if (geoJSON && geoJSON.features.length > 0) {
        allFeatures.push(...geoJSON.features);
        
        if (import.meta.env.DEV) {
          console.log(`Range ${range.start}-${range.end}: Found ${geoJSON.features.length} zip codes (Total: ${allFeatures.length})`);
        }
        
        // Update estimate based on actual data
        totalEstimated = Math.max(totalEstimated, allFeatures.length);
      }
      
      // Delay between requests to avoid rate limiting
      if (i < ranges.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`Failed to query range ${range.start}-${range.end}:`, error);
      }
      // Continue with next range instead of failing completely
    }
  }
  
  if (allFeatures.length === 0) {
    return null;
  }
  
  // Combine all features into single GeoJSON (filter out nulls)
  const validFeatures = allFeatures.filter((f): f is NonNullable<typeof f> => f !== null);
  
  if (validFeatures.length === 0) {
    return null;
  }
  
  const result: ReturnType<typeof convertFDOTToGeoJSON> = {
    type: 'FeatureCollection',
    features: validFeatures
  };
  
  if (progressCallback) {
    progressCallback({
      current: ranges.length,
      total: ranges.length,
      percentage: 100,
      currentBatch: ranges.length,
      message: `Complete! Retrieved ${allFeatures.length} zip codes.`
    });
  }
  
  return result;
}

/**
 * Alternative incremental query using pagination (if API supports it)
 * Queries all zip codes using resultOffset and resultRecordCount
 * @param progressCallback Optional callback for progress updates
 * @param batchSize Records per page (default: 1000, max: 2000)
 * @param delayMs Delay between requests (default: 500ms)
 * @returns GeoJSON with all Florida zip codes
 */
export async function getAllFloridaZipCodesPaginated(
  progressCallback?: ProgressCallback,
  batchSize: number = 1000,
  delayMs: number = 500
): Promise<ReturnType<typeof convertFDOTToGeoJSON>> {
  const allFeatures: ReturnType<typeof convertFDOTFeatureToGeoJSON>[] = [];
  let offset = 0;
  let hasMore = true;
  let batchNumber = 0;
  
  while (hasMore) {
    batchNumber++;
    
    try {
      if (progressCallback) {
        progressCallback({
          current: batchNumber,
          total: -1, // Unknown total
          percentage: -1,
          currentBatch: batchNumber,
          message: `Fetching batch ${batchNumber} (offset ${offset})...`
        });
      }
      
      const response = await queryFDOTZipCodes("1=1", offset, batchSize);
      const geoJSON = convertFDOTToGeoJSON(response);
      
      if (geoJSON && geoJSON.features.length > 0) {
        allFeatures.push(...geoJSON.features);
        
        if (import.meta.env.DEV) {
          console.log(`Batch ${batchNumber}: Retrieved ${geoJSON.features.length} zip codes (Total: ${allFeatures.length})`);
        }
        
        // Check if there are more results
        hasMore = geoJSON.features.length === batchSize;
        offset += batchSize;
        
        // Delay between requests
        if (hasMore && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`Failed to fetch batch ${batchNumber}:`, error);
      }
      hasMore = false; // Stop on error
    }
  }
  
  // Filter out nulls
  const validFeatures = allFeatures.filter((f): f is NonNullable<typeof f> => f !== null);
  
  if (validFeatures.length === 0) {
    return null;
  }
  
  const result: ReturnType<typeof convertFDOTToGeoJSON> = {
    type: 'FeatureCollection',
    features: validFeatures
  };
  
  if (progressCallback) {
    progressCallback({
      current: batchNumber,
      total: batchNumber,
      percentage: 100,
      currentBatch: batchNumber,
      message: `Complete! Retrieved ${validFeatures.length} zip codes.`
    });
  }
  
  return result;
}

/**
 * Auto-query all Florida zip codes with automatic saving
 * Tries ZIP range method first, falls back to pagination
 * Automatically saves to localStorage as it progresses
 * @param progressCallback Optional callback for progress updates
 * @returns GeoJSON with all Florida zip codes
 */
export async function autoQueryAllFloridaZipCodes(
  progressCallback?: ProgressCallback
): Promise<ReturnType<typeof convertFDOTToGeoJSON>> {
  // Try ZIP range method first (more reliable)
  try {
    if (progressCallback) {
      progressCallback({
        current: 0,
        total: 100,
        percentage: 0,
        currentBatch: 0,
        message: 'Starting incremental query by ZIP code ranges...'
      });
    }
    
    const result = await getAllFloridaZipCodesIncrementally(progressCallback);
    
    if (result && result.features.length > 0) {
      // Auto-save to localStorage
      try {
        localStorage.setItem('florida-zipcodes-all-cache', JSON.stringify(result));
        if (import.meta.env.DEV) {
          console.log(`Saved ${result.features.length} zip codes to localStorage`);
        }
      } catch (storageError) {
        if (import.meta.env.DEV) {
          console.warn('Could not save to localStorage:', storageError);
        }
      }
      
      return result;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('ZIP range method failed, trying pagination:', error);
    }
  }
  
  // Fallback to pagination method
  try {
    if (progressCallback) {
      progressCallback({
        current: 0,
        total: 100,
        percentage: 0,
        currentBatch: 0,
        message: 'Trying pagination method...'
      });
    }
    
    const result = await getAllFloridaZipCodesPaginated(progressCallback);
    
    if (result && result.features.length > 0) {
      // Auto-save to localStorage
      try {
        localStorage.setItem('florida-zipcodes-all-cache', JSON.stringify(result));
        if (import.meta.env.DEV) {
          console.log(`Saved ${result.features.length} zip codes to localStorage`);
        }
      } catch (storageError) {
        if (import.meta.env.DEV) {
          console.warn('Could not save to localStorage:', storageError);
        }
      }
      
      return result;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Both query methods failed:', error);
    }
  }
  
  return null;
}

/**
 * Simple console function to run auto-query for zip codes
 * Run this in browser console:
 * window.autoQueryFloridaZipCodes()
 */
if (typeof window !== 'undefined') {
  (window as any).autoQueryFloridaZipCodes = async function() {
    console.log('Starting auto-query for all Florida zip codes...');
    console.log('This may take several minutes. Progress will be logged to console.');
    
    const result = await autoQueryAllFloridaZipCodes((progress) => {
      if (progress.percentage >= 0) {
        console.log(`[${progress.percentage}%] ${progress.message} (${progress.current}/${progress.total})`);
      } else {
        console.log(`${progress.message} (Batch ${progress.currentBatch})`);
      }
    });
    
    if (result) {
      console.log(`✅ Success! Retrieved ${result.features.length} zip codes`);
      console.log('Data saved to localStorage as "florida-zipcodes-all-cache"');
      
      // Also download as file
      downloadGeoJSONAsFile(result, 'florida-zipcodes-all.json');
      console.log('Data also downloaded as "florida-zipcodes-all.json"');
    } else {
      console.error('❌ Failed to retrieve zip codes');
    }
    
    return result;
  };
  
  /**
   * Simple console function to run auto-query for counties
   * Run this in browser console:
   * window.autoQueryFloridaCounties()
   * 
   * This will try: local file → GitHub → FDOT API
   */
  (window as any).autoQueryFloridaCounties = async function() {
    console.log('Starting auto-query for all Florida counties...');
    console.log('This will try: local file → GitHub → FDOT API');
    console.log('GitHub source has accurate 67 Florida counties. Progress will be logged to console.');
    
    const result = await autoQueryAllFloridaCounties((progress) => {
      if (progress.percentage >= 0) {
        console.log(`[${progress.percentage}%] ${progress.message} (${progress.current}/${progress.total})`);
      } else {
        console.log(`${progress.message} (Batch ${progress.currentBatch})`);
      }
    });
    
    if (result) {
      console.log(`✅ Success! Retrieved ${result.features.length} counties`);
      if (result.features.length === 67) {
        console.log('✅ Perfect! Got exactly 67 Florida counties.');
      } else {
        console.warn(`⚠️ Expected 67 counties but got ${result.features.length}.`);
      }
      console.log('Data saved to localStorage as "florida-counties-cache"');
      console.log('Data also downloaded as "florida-counties.json"');
      console.log('');
      console.log('To use this data:');
      console.log('1. The file is already saved to your downloads folder');
      console.log('2. Move it to frontend/public/data/counties/florida-counties.json');
      console.log('3. The app will automatically use it on next load');
    } else {
      console.error('❌ Failed to retrieve counties');
    }
    
    return result;
  };
  
  /**
   * Direct download from GitHub (bypasses local file check)
   * Run this in browser console:
   * window.downloadFloridaCountiesFromGitHub()
   */
  (window as any).downloadFloridaCountiesFromGitHub = async function() {
    console.log('Downloading Florida counties directly from GitHub...');
    console.log('Source: https://github.com/danielcs88/fl_geo_json');
    
    try {
      const result = await downloadFloridaCountiesFromGitHub((progress) => {
        if (progress.percentage >= 0) {
          console.log(`[${progress.percentage}%] ${progress.message} (${progress.current}/${progress.total})`);
        } else {
          console.log(`${progress.message} (Batch ${progress.currentBatch})`);
        }
      });
      
      if (result) {
        console.log(`✅ Success! Downloaded ${result.features.length} counties`);
        if (result.features.length === 67) {
          console.log('✅ Perfect! Got exactly 67 Florida counties.');
        }
        
        // Save to localStorage
        try {
          localStorage.setItem('florida-counties-cache', JSON.stringify(result));
          console.log('Data saved to localStorage as "florida-counties-cache"');
        } catch (storageError) {
          console.warn('Could not save to localStorage (might be full)');
        }
        
        // Download as file
        downloadGeoJSONAsFile(result, 'florida-counties.json');
        console.log('Data also downloaded as "florida-counties.json"');
        console.log('');
        console.log('Next step: Move the downloaded file to frontend/public/data/counties/florida-counties.json');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to download from GitHub:', error);
      return null;
    }
  };
  
  if (import.meta.env.DEV) {
    console.log('window.autoQueryFloridaZipCodes() is now available in the console');
    console.log('window.autoQueryFloridaCounties() is now available in the console');
    console.log('window.downloadFloridaCountiesFromGitHub() is now available in the console (direct download)');
  }
}

