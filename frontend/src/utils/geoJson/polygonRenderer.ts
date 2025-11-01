/**
 * Polygon rendering - creates Google Maps polygons from GeoJSON features
 */

import { convertCoordinatesToPath } from './geoJsonUtils';
import { extractZipCode, extractCityName, extractPopulation } from './geoJsonUtils';
import { setupPolygonHoverHandlers, setupPolygonClickHandler } from './polygonHandlers';
import type { GeoJSONFeature } from './geoJsonTypes';

/**
 * Create a Google Maps polygon from a GeoJSON feature
 */
export function createPolygonFromFeature(
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

  // Convert geometry to paths
  const paths = convertCoordinatesToPath(feature.geometry.coordinates, geometryType);
  if (paths.length === 0) {
    return null;
  }

  // Create polygon (invisible by default)
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

  // Store selected state
  let isSelected = false;
  const isSelectedRef = { value: false };
  (polygon as any).zipCode = zipCode;
  (polygon as any).setSelected = (selected: boolean) => {
    isSelected = selected;
    isSelectedRef.value = selected;
  };

  // Setup event handlers
  setupPolygonHoverHandlers(polygon, zipCode, infoWindow, cityName, population, isSelectedRef);
  setupPolygonClickHandler(polygon, zipCode, paths, map, onZipCodeClick, isSelectedRef);

  return polygon;
}

