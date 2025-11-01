/**
 * Boundary loader - loads all zip code boundaries on map initialization
 */

import { getCachedGeoJSON } from './geoJsonLoader';
import { extractZipCode } from './geoJsonUtils';
import { createPolygonFromFeature } from './polygonRenderer';

/**
 * Load all zip code boundaries from GeoJSON and display them on the map
 * All zip codes are invisible by default, highlight on hover, and stay highlighted when clicked
 */
export async function loadAllZipCodeBoundaries(
  map: google.maps.Map,
  getScoreColor: (zipCode: string) => string = () => '#4285f4',
  onZipCodeClick?: (zipCode: string) => void
): Promise<void> {
  try {
    const geoJSON = await getCachedGeoJSON();

    if (!geoJSON) {
      return;
    }

    // Create shared InfoWindow for all polygons
    const infoWindow = new google.maps.InfoWindow({
      disableAutoPan: false,
      maxWidth: 150
    });

    // Initialize polygon storage
    const polygonMap: { [zipCode: string]: google.maps.Polygon } = {};
    const allPolygons: google.maps.Polygon[] = [];

    // Create polygons for all features
    for (const feature of geoJSON.features) {
      const zipCode = extractZipCode(feature);
      
      if (!zipCode) {
        continue;
      }

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
    if (import.meta.env.DEV) {
      console.warn('Failed to load all zip code boundaries:', error);
    }
  }
}

