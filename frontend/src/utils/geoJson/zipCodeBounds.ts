/**
 * Zip code bounds and navigation utilities
 */

import { getCachedGeoJSON } from './geoJsonLoader';
import { extractZipCode } from './geoJsonUtils';

/**
 * Get bounds for a zip code from GeoJSON
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
        map.fitBounds(polygonBounds, 50);
        return;
      }
    }
    
    const bounds = await getZipCodeBounds(zipCode);
    if (bounds && !bounds.isEmpty()) {
      map.fitBounds(bounds, 50);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to pan to zip code:', zipCode, error);
    }
  }
}

