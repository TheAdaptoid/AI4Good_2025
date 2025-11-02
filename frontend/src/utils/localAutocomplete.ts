/**
 * Local autocomplete system for Florida locations
 * Uses cached GeoJSON data to provide autocomplete suggestions
 * Supports: Zip codes, Cities, Counties, Addresses
 */

import { getCachedGeoJSON, getCachedCountiesGeoJSON } from './geojsonBoundaries';

export interface AutocompleteOption {
  type: 'zip' | 'city' | 'county' | 'address';
  display: string;
  value: string;
  zipCode?: string; // For city/county/address searches, the representative zip code
  city?: string;
  county?: string;
  address?: string; // Full address string for address type
  placeId?: string; // Google Places place_id for address type
}

interface SearchIndex {
  zipCodes: Map<string, { zip: string; city?: string; county?: string }>;
  cities: Map<string, Set<string>>; // city name -> set of zip codes
  counties: Map<string, Set<string>>; // county name -> set of zip codes
}

let searchIndex: SearchIndex | null = null;
let indexLoaded = false;

/**
 * Extract county name from GeoJSON feature properties
 * Also tries to get county from Google Geocoding if available
 */
function extractCounty(feature: any): string | null {
  const props = feature.properties;
  
  // First try direct county fields
  if (props.COUNTY || props.COUNTY_NAME) {
    return props.COUNTY || props.COUNTY_NAME;
  }
  
  // Check if we've stored county data from geocoding
  if (props.GEOCODED_COUNTY) {
    return props.GEOCODED_COUNTY;
  }
  
  // Try other possible fields
  if (props.NAME && !props.PO_NAME) {
    // NAME might be county if PO_NAME doesn't exist
    return props.NAME;
  }
  
  return null;
}

/**
 * Enrich GeoJSON feature with county data from cache
 * County data is cached when zip codes are geocoded
 */
function enrichFeatureWithCounty(feature: any, zipCode: string): void {
  // Check if we have cached county data for this zip
  const cacheKey = `zip-county-${zipCode}`;
  const cachedCounty = localStorage.getItem(cacheKey);
  
  if (cachedCounty && !feature.properties.COUNTY && !feature.properties.COUNTY_NAME) {
    // Store county in feature properties for future use
    feature.properties.GEOCODED_COUNTY = cachedCounty;
  }
}

/**
 * Cache county data for a zip code
 * Called when geocoding returns county information
 */
export function cacheCountyForZip(zipCode: string, county: string): void {
  if (zipCode && county) {
    const cacheKey = `zip-county-${zipCode}`;
    localStorage.setItem(cacheKey, county);
    
    // Clear search index so it rebuilds with new county data
    searchIndex = null;
    indexLoaded = false;
  }
}

/**
 * Build search index from GeoJSON data
 * Indexes by zip code, city, and county
 * Loads counties from dedicated county GeoJSON file for accuracy
 */
async function buildSearchIndex(): Promise<SearchIndex> {
  if (searchIndex && indexLoaded) {
    return searchIndex;
  }

  const zipCodes = new Map<string, { zip: string; city?: string; county?: string }>();
  const cities = new Map<string, Set<string>>();
  const counties = new Map<string, Set<string>>();

  // Load ZIP code data (for zip codes and cities)
  const geoJSON = await getCachedGeoJSON();
  if (geoJSON && geoJSON.features) {
    for (const feature of geoJSON.features) {
      const zip = feature.properties.ZIP || 
                  feature.properties.ZCTA5CE10 || 
                  feature.properties.ZCTA5 ||
                  feature.properties.GEOID?.match(/\d{5}/)?.[0];
      
      if (!zip) continue;

      // Enrich feature with cached county data
      enrichFeatureWithCounty(feature, zip);

      const city = feature.properties.PO_NAME || 
                   feature.properties.CITY || 
                   feature.properties.CITY_NAME ||
                   feature.properties.NAME;
      
      const county = extractCounty(feature);

      // Index zip code
      zipCodes.set(zip, { zip, city: city || undefined, county: county || undefined });

      // Index city
      if (city) {
        const cityKey = city.toUpperCase().trim();
        if (!cities.has(cityKey)) {
          cities.set(cityKey, new Set());
        }
        cities.get(cityKey)!.add(zip);
      }
    }
  }

  // Load county data from dedicated county GeoJSON file
  const countiesGeoJSON = await getCachedCountiesGeoJSON();
  if (countiesGeoJSON && countiesGeoJSON.features) {
    for (const feature of countiesGeoJSON.features) {
      // Extract county name from county file
      const countyName = feature.properties.NAME || 
                         feature.properties.COUNTY_NAME || 
                         feature.properties.COUNTY;
      
      if (!countyName) continue;

      const countyKey = countyName.toUpperCase().trim();
      
      // Create or update county entry with all ZIP codes from that county
      // Use ZIP codes from zip code data that match this county
      if (!counties.has(countyKey)) {
        counties.set(countyKey, new Set());
      }
      
      // Add all ZIP codes that belong to this county
      for (const [zip, data] of zipCodes.entries()) {
        if (data.county && data.county.toUpperCase().trim() === countyKey) {
          counties.get(countyKey)!.add(zip);
        }
      }
      
      // If no ZIP codes found for this county, add a placeholder
      // so the county still appears in autocomplete
      if (counties.get(countyKey)!.size === 0) {
        // Add a representative ZIP code if available (first ZIP code)
        const firstZip = zipCodes.keys().next().value;
        if (firstZip) {
          counties.get(countyKey)!.add(firstZip);
        }
      }
    }
  }

  searchIndex = { zipCodes, cities, counties };
  indexLoaded = true;
  
  if (import.meta.env.DEV) {
    console.log(`Built search index: ${zipCodes.size} zip codes, ${cities.size} cities, ${counties.size} counties`);
    
    // Log zip-county association statistics
    let zipsWithCounty = 0;
    let totalZipsInCounties = 0;
    counties.forEach((zipSet) => {
      totalZipsInCounties += zipSet.size;
      zipsWithCounty += zipSet.size;
    });
    
    console.log(`Zip-County Associations: ${zipsWithCounty} zip codes associated with ${counties.size} counties`);
    console.log(`Average zips per county: ${counties.size > 0 ? (totalZipsInCounties / counties.size).toFixed(1) : 0}`);
    
    // Show county with most/least zips
    let maxZips = 0;
    let minZips = Infinity;
    let maxCounty = '';
    let minCounty = '';
    
    counties.forEach((zipSet, countyName) => {
      const count = zipSet.size;
      if (count > maxZips) {
        maxZips = count;
        maxCounty = countyName;
      }
      if (count < minZips && count > 0) {
        minZips = count;
        minCounty = countyName;
      }
    });
    
    if (maxCounty) {
      console.log(`County with most zips: ${maxCounty} (${maxZips} zips)`);
    }
    if (minCounty) {
      console.log(`County with fewest zips: ${minCounty} (${minZips} zips)`);
    }
  }

  return searchIndex;
}

/**
 * Get address suggestions from Google Places AutocompleteService
 * Only returns addresses - cities, counties, and zip codes are handled locally
 * Restricted to Florida locations only
 * Note: We keep cities/zips/counties local and only use Google for addresses
 */
async function getAddressSuggestions(
  query: string,
  maxResults: number = 5
): Promise<AutocompleteOption[]> {
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    return [];
  }

  try {
    const service = new google.maps.places.AutocompleteService();
    
    // Define Florida bounds to restrict results to Florida only
    const floridaBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(24.396308, -87.634643), // Southwest corner
      new google.maps.LatLng(31.000968, -79.974307)   // Northeast corner
    );

    // Only get address suggestions from Google, restricted to Florida
    // Cities, counties, and zip codes are handled by local autocomplete
    return new Promise<AutocompleteOption[]>((resolve) => {
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'us' },
          types: ['address'], // Addresses only - cities/zips/counties handled locally
          locationRestriction: floridaBounds, // Restrict to Florida only (not just bias)
        },
        (predictions, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            resolve([]);
            return;
          }
          
          // Filter to ensure results are in Florida (extra safety check)
          // Check if description contains ", FL" or ", Florida"
          const floridaResults = predictions.filter((prediction) => {
            const desc = prediction.description.toLowerCase();
            return desc.includes(', fl') || desc.includes(', florida');
          });
          
          const results: AutocompleteOption[] = floridaResults.slice(0, maxResults).map((prediction) => ({
            type: 'address',
            display: prediction.description,
            value: prediction.description,
            address: prediction.description,
            placeId: prediction.place_id,
          }));
          
          resolve(results);
        }
      );
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Google Places AutocompleteService failed:', error);
    }
    return [];
  }
}

/**
 * Check if query looks like an address (contains street number or street keywords)
 * Used to determine when to show/hide local suggestions
 */
function looksLikeAddress(query: string): boolean {
  const trimmed = query.trim();
  // Check for street number pattern (starts with digits)
  if (/^\d+\s/.test(trimmed)) {
    return true;
  }
  // Check for common street keywords
  const streetKeywords = ['street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr', 'lane', 'ln', 'blvd', 'boulevard', 'court', 'ct', 'way', 'circle', 'cir'];
  const lowerQuery = trimmed.toLowerCase();
  return streetKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Get autocomplete suggestions for a query
 * Supports: zip codes, cities, counties, addresses
 */
export async function getAutocompleteSuggestions(
  query: string,
  maxResults: number = 10
): Promise<AutocompleteOption[]> {
  const trimmedQuery = query.trim().toUpperCase();
  
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return [];
  }

  const index = await buildSearchIndex();
  const results: AutocompleteOption[] = [];

  // Check if it's a zip code (starts with digits)
  const zipMatch = trimmedQuery.match(/^(\d{0,5})/);
  if (zipMatch && zipMatch[1].length > 0) {
    // Search zip codes
    for (const [zip, data] of index.zipCodes.entries()) {
      if (zip.startsWith(trimmedQuery) || zip.includes(trimmedQuery)) {
        results.push({
          type: 'zip',
          display: zip,
          value: zip,
          zipCode: zip,
          city: data.city || undefined,
          county: data.county || undefined
        });
        
        if (results.length >= maxResults) break;
      }
    }
  }

  // Search cities (case-insensitive partial match)
  for (const [cityKey, zipSet] of index.cities.entries()) {
    if (cityKey.includes(trimmedQuery)) {
      const firstZip = Array.from(zipSet)[0];
      const zipData = index.zipCodes.get(firstZip);
      
      results.push({
        type: 'city',
        display: cityKey,
        value: cityKey,
        zipCode: firstZip,
        city: cityKey,
        county: zipData?.county || undefined
      });
      
      if (results.length >= maxResults) break;
    }
  }

  // Search counties (case-insensitive partial match)
  for (const [countyKey, zipSet] of index.counties.entries()) {
    if (countyKey.includes(trimmedQuery)) {
      const firstZip = Array.from(zipSet)[0];
      
      results.push({
        type: 'county',
        display: countyKey,
        value: countyKey,
        zipCode: firstZip,
        city: undefined, // Don't include city for county searches
        county: countyKey
      });
      
      if (results.length >= maxResults) break;
    }
  }

  // Get address suggestions from Google Places AutocompleteService
  // Only fetch addresses from Google - cities, counties, and zip codes are handled locally
  const looksLikeAddr = looksLikeAddress(query.trim());
  const shouldTryAddresses = looksLikeAddr || results.length < 3;

  if (shouldTryAddresses && window.google?.maps?.places) {
    // Get address suggestions from Google only
    // Local data handles cities, counties, and zip codes
    const addressMax = Math.max(3, maxResults - results.length);
    const addressResults = await getAddressSuggestions(query.trim(), addressMax);
    results.push(...addressResults);
  }

  // Sort results: exact matches first, then by type (zip > city > county > address)
  results.sort((a, b) => {
    const aExact = a.value.toUpperCase() === trimmedQuery ? 0 : 1;
    const bExact = b.value.toUpperCase() === trimmedQuery ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    
    const typeOrder = { zip: 0, city: 1, county: 2, address: 3 };
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return results.slice(0, maxResults);
}

/**
 * Get all zip codes for a city name
 * Uses the search index to get accurate zip codes
 */
export async function getZipCodesForCity(cityName: string): Promise<Set<string> | null> {
  const trimmedQuery = cityName.trim().toUpperCase();
  
  if (!trimmedQuery) {
    return null;
  }

  const index = await buildSearchIndex();
  
  // Try exact match first
  if (index.cities.has(trimmedQuery)) {
    return index.cities.get(trimmedQuery)!;
  }
  
  // Try partial match (find first city that contains the query)
  for (const [cityKey, zipSet] of index.cities.entries()) {
    if (cityKey === trimmedQuery || cityKey.includes(trimmedQuery) || trimmedQuery.includes(cityKey)) {
      return zipSet;
    }
  }
  
  return null;
}

/**
 * Find best matching location from a search query
 * Returns zip code if found, or null if not found
 */
export async function findLocationFromQuery(query: string): Promise<{
  zipCode: string | null;
  type: 'zip' | 'city' | 'county' | null;
  city?: string;
  county?: string;
} | null> {
  const trimmedQuery = query.trim().toUpperCase();
  
  if (!trimmedQuery) {
    return null;
  }

  const index = await buildSearchIndex();

  // Check for exact zip code match
  if (/^\d{5}(-\d{4})?$/.test(query.trim())) {
    const zip = query.trim().substring(0, 5);
    const zipData = index.zipCodes.get(zip);
    if (zipData) {
      return {
        zipCode: zip,
        type: 'zip',
        city: zipData.city || undefined,
        county: zipData.county || undefined
      };
    }
  }

  // Check for exact city match
  const cityKey = trimmedQuery;
  if (index.cities.has(cityKey)) {
    const zipSet = index.cities.get(cityKey)!;
    const firstZip = Array.from(zipSet)[0];
    const zipData = index.zipCodes.get(firstZip);
    
    return {
      zipCode: firstZip,
      type: 'city',
      city: cityKey,
      county: zipData?.county || undefined
    };
  }

  // Check for exact county match
  if (index.counties.has(cityKey)) {
    const zipSet = index.counties.get(cityKey)!;
    const firstZip = Array.from(zipSet)[0];
    const zipData = index.zipCodes.get(firstZip);
    
    return {
      zipCode: firstZip,
      type: 'county',
      city: zipData?.city || undefined,
      county: cityKey
    };
  }

  // Try partial matches (exclude addresses as they're handled separately)
  const suggestions = await getAutocompleteSuggestions(query, 1);
  if (suggestions.length > 0) {
    // Filter out address suggestions - they should be handled by geocoding, not this function
    const nonAddressSuggestions = suggestions.filter(s => s.type !== 'address');
    if (nonAddressSuggestions.length > 0) {
      const best = nonAddressSuggestions[0];
      return {
        zipCode: best.zipCode || null,
        type: best.type === 'address' ? null : best.type, // Convert 'address' to null for type safety
        city: best.city,
        county: best.county
      };
    }
  }

  return null;
}

/**
 * Clear the search index cache (useful for testing or reloading)
 */
export function clearSearchIndex(): void {
  searchIndex = null;
  indexLoaded = false;
}
