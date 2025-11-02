/**
 * Connected components utility - find main area vs islands
 */

import { convertCoordinatesToPath } from './geoJsonUtils';
import { calculateCentroid } from './spatialCalculations';
import type { GeoJSONFeature } from './geoJsonTypes';

/**
 * Find connected components of zip codes (main area vs islands)
 * Returns array of groups, where each group is an array of zip codes
 */
export function findConnectedComponents(
  cityFeatures: GeoJSONFeature[]
): GeoJSONFeature[][] {
  if (cityFeatures.length === 0) {
    return [];
  }

  // Calculate centroid of all features combined
  const allPaths: google.maps.LatLngLiteral[] = [];
  cityFeatures.forEach(feature => {
    const paths = convertCoordinatesToPath(
      feature.geometry.coordinates,
      feature.geometry.type
    );
    if (paths.length > 0 && paths[0]) {
      allPaths.push(...paths[0]);
    }
  });

  if (allPaths.length === 0) {
    return [cityFeatures];
  }

  const centroid = calculateCentroid([allPaths]);
  if (!centroid) {
    return [cityFeatures];
  }

  // Group zip codes by distance from centroid
  const mainArea: GeoJSONFeature[] = [];
  const islands: GeoJSONFeature[] = [];
  
  const islandThreshold = 0.1; // degrees (roughly 11km)
  
  for (const feature of cityFeatures) {
    const paths = convertCoordinatesToPath(
      feature.geometry.coordinates,
      feature.geometry.type
    );
    if (paths.length > 0 && paths[0] && paths[0].length > 0) {
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
  islands.forEach(island => {
    components.push([island]);
  });
  
  return components;
}

