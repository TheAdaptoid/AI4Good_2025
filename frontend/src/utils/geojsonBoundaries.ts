/**
 * Zip code boundaries using GeoJSON data
 * Re-exports all functions from modular geoJson folder for backward compatibility
 */

// Re-export all functions from modular files
export { getCachedGeoJSON, getCachedCountiesGeoJSON } from './geoJson/geoJsonLoader';
export { convertCoordinatesToPath, extractZipCode, extractCityName, extractCountyName, extractPopulation } from './geoJson/geoJsonUtils';
export { calculateCentroid, isPointInPolygon, calculateAreaOverlapPercentage, isZipCodeInCounty } from './geoJson/spatialCalculations';
export { createPolygonFromFeature } from './geoJson/polygonRenderer';
export { clearZipCodePolygons, updateZipCodePolygonColor, loadZipCodePolygonIfNeeded, resetZipCodePolygonToInvisible } from './geoJson/polygonManager';
export { getZipCodeBounds, panToZipCode } from './geoJson/zipCodeBounds';
export { findConnectedComponents } from './geoJson/connectedComponents';
export { renderCityCountyBoundaries, clearCityCountyBoundaries } from './geoJson/cityCountyRenderer';
export { loadAllZipCodeBoundaries } from './geoJson/boundaryLoader';

// Re-export types
export type { GeoJSONFeature, GeoJSON } from './geoJson/geoJsonTypes';
