/**
 * GeoJSON file loading and caching
 */

import type { GeoJSON } from './geoJsonTypes';

const allZipCodesPath = '/data/zipcodes/florida-zipcodes-all.json';
const geoJSONPath = '/data/zipcodes/florida-zipcodes.geojson';
const countiesPath = '/data/counties/florida-counties.json';

// Cache for loaded GeoJSON data
let geoJSONCache: GeoJSON | null = null;
let countiesCache: GeoJSON | null = null;

/**
 * Load GeoJSON data from public folder
 */
async function loadGeoJSONFromPublic(path: string): Promise<GeoJSON | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to load GeoJSON: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    
    if (text.trim().startsWith('<!')) {
      if (import.meta.env.DEV) {
        console.warn(`Got HTML instead of JSON from ${path} - file might not exist`);
      }
      return null;
    }
    
    if (!text || text.trim().length === 0) {
      if (import.meta.env.DEV) {
        console.warn(`File ${path} is empty`);
      }
      return null;
    }
    
    let data: GeoJSON;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      return null;
    }
    
    if (!data.type || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      return null;
    }
    
    return data;
  } catch (error) {
    return null;
  }
}

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
    if (import.meta.env.DEV) {
      console.warn('localStorage cache unavailable:', cacheError);
    }
  }

  // Load from local GeoJSON files
  try {
    geoJSONCache = await loadGeoJSONFromPublic(allZipCodesPath);
    if (geoJSONCache && import.meta.env.DEV) {
      console.log(`Loaded ${geoJSONCache.features.length} zip codes from local file (all Florida)`);
    }
    return geoJSONCache;
  } catch (error) {
    try {
      geoJSONCache = await loadGeoJSONFromPublic(geoJSONPath);
      if (geoJSONCache && import.meta.env.DEV) {
        console.log(`Loaded ${geoJSONCache.features.length} zip codes from local GeoJSON file`);
      }
      return geoJSONCache;
    } catch (error) {
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

  // First try localStorage cache
  try {
    const cached = localStorage.getItem('florida-counties-cache');
    if (cached) {
      const parsed = JSON.parse(cached) as GeoJSON;
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        countiesCache = parsed;
        if (import.meta.env.DEV) {
          console.log(`Loaded ${parsed.features.length} counties from localStorage`);
        }
        return countiesCache;
      }
    }
  } catch (cacheError) {
    if (import.meta.env.DEV) {
      console.warn('localStorage cache unavailable:', cacheError);
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
    return null;
  }
}

