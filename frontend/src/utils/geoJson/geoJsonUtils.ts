/**
 * GeoJSON utility functions - coordinate conversion and property extraction
 */

import type { GeoJSONFeature } from './geoJsonTypes';

/**
 * Convert GeoJSON coordinates to Google Maps LatLngLiteral[]
 */
export function convertCoordinatesToPath(
  coordinates: number[][] | number[][][] | number[][][][],
  geometryType: 'Polygon' | 'MultiPolygon'
): google.maps.LatLngLiteral[][] {
  const paths: google.maps.LatLngLiteral[][] = [];

  if (geometryType === 'Polygon') {
    const coords = coordinates as number[][][];
    for (const ring of coords) {
      const path: google.maps.LatLngLiteral[] = ring.map(coord => ({
        lng: coord[0],
        lat: coord[1]
      }));
      paths.push(path);
    }
  } else if (geometryType === 'MultiPolygon') {
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
export function extractZipCode(feature: GeoJSONFeature): string | null {
  const props = feature.properties;
  return props.ZIP ||
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
export function extractCityName(feature: GeoJSONFeature): string | null {
  const props = feature.properties;
  return props.PO_NAME || props.CITY || props.CITY_NAME || props.NAME || null;
}

/**
 * Extract county name from GeoJSON feature properties
 */
export function extractCountyName(feature: GeoJSONFeature): string | null {
  const props = feature.properties;
  return props.COUNTY || props.COUNTY_NAME || props.CNTY || null;
}

/**
 * Extract population from GeoJSON feature properties
 */
export function extractPopulation(feature: GeoJSONFeature): number | null {
  const props = feature.properties;
  return props.POPULATION || props.POP || null;
}

