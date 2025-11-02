/**
 * City/County boundary rendering - renders city and county boundaries with zip code outlines
 */

import { getCachedGeoJSON, getCachedCountiesGeoJSON } from './geoJsonLoader';
import { convertCoordinatesToPath } from './geoJsonUtils';
import { extractZipCode, extractCityName, extractCountyName } from './geoJsonUtils';
import { isZipCodeInCounty, calculateAreaOverlapPercentage } from './spatialCalculations';
import { findConnectedComponents } from './connectedComponents';
import { createPolygonFromFeature } from './polygonRenderer';
import type { GeoJSONFeature } from './geoJsonTypes';

/**
 * Render city/county boundaries with individual zip code outlines (gridlines)
 * Shows zip code boundaries color-coded by score, with a background fill
 * Returns the zip codes found and a function to update their colors
 */
export async function renderCityCountyBoundaries(
  map: google.maps.Map,
  cityOrCountyName: string,
  getScoreColor: (zipCode: string) => string = () => '#4285f4',
  onZipCodeClick?: (zipCode: string) => void
): Promise<{ boundaries: google.maps.Polygon[]; zipCodes: string[]; updateColors: (scoreMap: Map<string, number>) => void; getAreaWeights: () => Map<string, number> } | null> {
  try {
    const searchUpper = cityOrCountyName.toUpperCase().trim();
    
    // First check if this is a county search by checking the county GeoJSON file
    const countiesGeoJSON = await getCachedCountiesGeoJSON();
    if (countiesGeoJSON && countiesGeoJSON.features.length > 0) {
      // Find matching county in county file (case-insensitive partial match)
      let matchingCounty = countiesGeoJSON.features.find(feature => {
        const countyName = feature.properties.NAME || 
                          feature.properties.COUNTY_NAME || 
                          feature.properties.COUNTY;
        if (!countyName) return false;
        const countyUpper = countyName.toUpperCase().trim();
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
      
      // If we found a county match, find zip codes in that county and render them
      if (matchingCounty) {
        const countyName = matchingCounty.properties.NAME || 
                          matchingCounty.properties.COUNTY_NAME || 
                          matchingCounty.properties.COUNTY;
        
        if (!countyName) {
          return null;
        }
        
        // Find all zip codes in this county using SPATIAL INTERSECTION
        const geoJSON = await getCachedGeoJSON();
        if (!geoJSON || geoJSON.features.length === 0) {
          return null;
        }
        
        // Convert county geometry to paths for spatial checking
        const countyPaths = convertCoordinatesToPath(
          matchingCounty.geometry.coordinates,
          matchingCounty.geometry.type
        );
        
        if (countyPaths.length === 0 || countyPaths[0].length === 0) {
          return null;
        }
        
        // Normalize county name for matching as fallback
        const countyNameUpper = countyName.toUpperCase().trim();
        const countyNameUpperClean = countyNameUpper.replace(/\s+COUNTY\s*$/, '');
        
        // Find zip codes using SPATIAL intersection
        const zipCodesInArea = new Set<string>();
        const zipCodeFeatures: GeoJSONFeature[] = [];
        const areaWeights = new Map<string, number>();
        
        if (import.meta.env.DEV) {
          console.log(`Checking ${geoJSON.features.length} zip codes against county "${countyName}" using spatial intersection...`);
        }
        
        let spatialMatches = 0;
        let nameMatches = 0;
        
        for (const feature of geoJSON.features) {
          const zip = extractZipCode(feature);
          if (!zip) continue;
          
          const zipPaths = convertCoordinatesToPath(
            feature.geometry.coordinates,
            feature.geometry.type
          );
          
          if (zipPaths.length === 0 || zipPaths[0].length === 0) {
            continue;
          }
          
          // PRIMARY: Use spatial intersection
          const isSpatiallyInside = isZipCodeInCounty(zipPaths, countyPaths);
          
          // FALLBACK: Also check name matching
          let isNameMatch = false;
          const county = extractCountyName(feature);
          if (county) {
            const countyUpper = county.toUpperCase().trim();
            const countyUpperClean = countyUpper.replace(/\s+COUNTY\s*$/, '');
            
            isNameMatch = countyUpper === countyNameUpper ||
                         countyUpperClean === countyNameUpperClean ||
                         countyUpper === countyNameUpperClean ||
                         countyUpperClean === countyNameUpper ||
                         countyUpper.includes(countyNameUpper) ||
                         countyNameUpper.includes(countyUpper) ||
                         countyUpper.includes(countyNameUpperClean) ||
                         countyNameUpperClean.includes(countyUpper);
          }
          
          if (isSpatiallyInside || isNameMatch) {
            if (!zipCodesInArea.has(zip)) {
              zipCodesInArea.add(zip);
              zipCodeFeatures.push(feature);
              
              const overlapPercentage = calculateAreaOverlapPercentage(zipPaths, countyPaths);
              areaWeights.set(zip, overlapPercentage);
              
              if (isSpatiallyInside) spatialMatches++;
              if (isNameMatch) nameMatches++;
            }
          }
        }
        
        if (import.meta.env.DEV) {
          console.log(`County "${countyName}": Found ${zipCodesInArea.size} zip codes (${spatialMatches} spatial, ${nameMatches} name matches)`);
        }
        
        if (zipCodesInArea.size === 0) {
          return null;
        }
        
        return renderZipCodePolygons(
          map,
          zipCodeFeatures,
          matchingCounty.geometry,
          zipCodesInArea,
          areaWeights,
          getScoreColor,
          onZipCodeClick
        );
      }
    }
    
    // Fallback: use ZIP code data for city searches
    const geoJSON = await getCachedGeoJSON();
    
    if (!geoJSON || geoJSON.features.length === 0) {
      return null;
    }
    
    // Use the search index to get accurate zip codes for cities
    // This ensures we get the same zip codes that autocomplete shows
    let zipCodesInArea: Set<string> | null = null;
    
    try {
      const { getZipCodesForCity } = await import('../localAutocomplete');
      const cityZipCodes = await getZipCodesForCity(cityOrCountyName);
      
      if (cityZipCodes && cityZipCodes.size > 0) {
        zipCodesInArea = cityZipCodes;
        
        if (import.meta.env.DEV) {
          console.log(`City search "${cityOrCountyName}": Found ${zipCodesInArea.size} zip codes from search index`);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to get zip codes from search index, falling back to name matching:', error);
      }
    }
    
    // Fallback to name matching if search index didn't work
    if (!zipCodesInArea || zipCodesInArea.size === 0) {
      // Try both city and county matches from ZIP code data
      const filteredFeatures = geoJSON.features.filter(feature => {
        const city = extractCityName(feature);
        const county = extractCountyName(feature);
        
        const searchClean = searchUpper.replace(/\s+COUNTY\s*$/, '').replace(/\s+CITY\s*$/, '');
        
        if (city) {
          const cityUpper = city.toUpperCase().trim();
          const cityUpperClean = cityUpper.replace(/\s+CITY\s*$/, '').replace(/\s+TOWN\s*$/, '');
          
          if (cityUpper === searchUpper ||
              cityUpperClean === searchClean ||
              cityUpper.includes(searchUpper) ||
              cityUpper.includes(searchClean) ||
              searchUpper.includes(cityUpper) ||
              searchClean.includes(cityUpperClean)) {
            return true;
          }
        }
        
        if (county) {
          const countyUpper = county.toUpperCase().trim();
          const countyUpperClean = countyUpper.replace(/\s+COUNTY\s*$/, '');
          
          if (countyUpper === searchUpper ||
              countyUpperClean === searchClean ||
              countyUpper.includes(searchUpper) ||
              countyUpper.includes(searchClean) ||
              searchUpper.includes(countyUpper) ||
              searchClean.includes(countyUpperClean)) {
            return true;
          }
        }
        
        return false;
      });
      
      zipCodesInArea = new Set<string>();
      filteredFeatures.forEach(feature => {
        const zip = extractZipCode(feature);
        if (zip) {
          zipCodesInArea!.add(zip);
        }
      });
      
      if (import.meta.env.DEV) {
        console.log(`City/County search "${cityOrCountyName}": Found ${filteredFeatures.length} zip code features via name matching`);
      }
    }
    
    if (!zipCodesInArea || zipCodesInArea.size === 0) {
      return null;
    }
    
    // Filter GeoJSON features to only include the zip codes from the search index
    const filteredFeatures = geoJSON.features.filter(feature => {
      const zip = extractZipCode(feature);
      return zip && zipCodesInArea!.has(zip);
    });
    
    if (filteredFeatures.length === 0) {
      return null;
    }
    
    return renderZipCodePolygons(
      map,
      filteredFeatures,
      null,
      zipCodesInArea,
      new Map<string, number>(),
      getScoreColor,
      onZipCodeClick
    );
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Failed to render city/county boundaries for ${cityOrCountyName}:`, error);
    }
    return null;
  }
}

/**
 * Helper function to render zip code polygons for city/county
 */
function renderZipCodePolygons(
  map: google.maps.Map,
  features: GeoJSONFeature[],
  countyGeometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } | null,
  zipCodesInArea: Set<string>,
  areaWeights: Map<string, number>,
  getScoreColor: (zipCode: string) => string,
  onZipCodeClick?: (zipCode: string) => void
): { boundaries: google.maps.Polygon[]; zipCodes: string[]; updateColors: (scoreMap: Map<string, number>) => void; getAreaWeights: () => Map<string, number> } | null {
  // Clear previous city/county boundaries
  const existingBoundaries = (map as any).cityCountyBoundaries || [];
  existingBoundaries.forEach((poly: google.maps.Polygon) => poly.setMap(null));
  
  const existingZipPolygons = (map as any).cityCountyZipPolygons || [];
  existingZipPolygons.forEach((poly: google.maps.Polygon) => poly.setMap(null));
  
  // Create background fill
  const boundaries: google.maps.Polygon[] = [];
  const allBounds = new google.maps.LatLngBounds();
  const fillColor = '#ff6b6b';
  const fillOpacity = 0.1;
  
  // If county geometry provided, use it for background fill
  if (countyGeometry) {
    const paths: google.maps.LatLngLiteral[][] = [];
    
    if (countyGeometry.type === 'Polygon') {
      const coords = countyGeometry.coordinates as number[][][];
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
    } else if (countyGeometry.type === 'MultiPolygon') {
      const coords = countyGeometry.coordinates as number[][][][];
      for (const polygon of coords) {
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
      }
    }
    
    if (paths.length > 0 && paths[0].length > 0) {
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
  } else {
    // For city searches, use connected components
    const components = findConnectedComponents(features);
    
    for (const component of components) {
      const allPaths: google.maps.LatLngLiteral[][] = [];
      
      for (const feature of component) {
        const paths = convertCoordinatesToPath(
          feature.geometry.coordinates,
          feature.geometry.type
        );
        
        if (paths.length > 0 && paths[0] && paths[0].length > 0) {
          allPaths.push(paths[0]);
          paths[0].forEach(point => {
            allBounds.extend(point);
          });
        }
      }
      
      if (allPaths.length > 0) {
        const filledArea = new google.maps.Polygon({
          paths: allPaths,
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
  
  // Create InfoWindow for zip code info
  const infoWindow = new google.maps.InfoWindow({
    disableAutoPan: false,
    maxWidth: 150
  });
  
  // Create individual zip code polygons
  const zipPolygons: google.maps.Polygon[] = [];
  const zipPolygonMap: { [zipCode: string]: google.maps.Polygon } = {};
  
  const zipFeatures = new Map<string, GeoJSONFeature>();
  features.forEach(feature => {
    const zip = extractZipCode(feature);
    if (zip && !zipFeatures.has(zip)) {
      zipFeatures.set(zip, feature);
    }
  });
  
  zipFeatures.forEach((feature, zipCode) => {
    const polygon = createPolygonFromFeature(
      map,
      feature,
      (zip) => getScoreColor(zip),
      onZipCodeClick,
      infoWindow
    );
    
    if (polygon) {
      polygon.setOptions({
        fillOpacity: 0.2,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        strokeColor: getScoreColor(zipCode),
        fillColor: getScoreColor(zipCode)
      });
      
      zipPolygons.push(polygon);
      zipPolygonMap[zipCode] = polygon;
    }
  });
  
  // Store for cleanup and updates
  (map as any).cityCountyBoundaries = boundaries;
  (map as any).cityCountyZipPolygons = zipPolygons;
  (map as any).cityCountyZipPolygonMap = zipPolygonMap;
  (map as any).cityCountyInfoWindow = infoWindow;
  (map as any).isCityCountyView = true; // Flag to indicate we're in city/county view
  
  // Function to update colors based on scores
  const updateColors = (scoreMap: Map<string, number>) => {
    const getColorFromScore = (score: number): string => {
      // Three categories: Good (700-1000), Fair (400-700), Bad (0-400)
      if (score >= 700) return '#4caf50'; // Green - Good
      if (score >= 400) return '#ffeb3b'; // Yellow - Fair
      return '#f44336'; // Red - Bad
    };
    
    zipPolygons.forEach((polygon) => {
      const zipCode = (polygon as any).zipCode;
      if (zipCode && scoreMap.has(zipCode)) {
        const score = scoreMap.get(zipCode)!;
        const color = getColorFromScore(score);
        polygon.setOptions({
          strokeColor: color,
          fillColor: color
        });
      }
    });
  };
  
  // Fit bounds to show all areas
  if (!allBounds.isEmpty()) {
    map.fitBounds(allBounds, 50);
  }
  
  // Return function to get area weights
  const getAreaWeights = () => areaWeights;
  
  return {
    boundaries,
    zipCodes: Array.from(zipCodesInArea),
    updateColors,
    getAreaWeights
  };
}

/**
 * Clear city/county boundaries from map
 */
export function clearCityCountyBoundaries(map: google.maps.Map, preserveZipCode?: string): void {
  // Clear background fill boundaries
  const boundaries = (map as any).cityCountyBoundaries || [];
  boundaries.forEach((poly: google.maps.Polygon) => poly.setMap(null));
  (map as any).cityCountyBoundaries = [];
  
  // Get zip polygons to clear
  // Note: If preserveZipCode is provided, the polygon should already be removed from this array
  const zipPolygons = (map as any).cityCountyZipPolygons || [];
  
  // Clear all city/county zip polygons (the one being preserved should already be removed from array)
  zipPolygons.forEach((poly: google.maps.Polygon) => {
    const zipCode = (poly as any).zipCode;
    // Only remove if it's not the one being preserved (or if no preserveZipCode specified)
    if (!preserveZipCode || zipCode !== preserveZipCode) {
      poly.setMap(null);
    }
  });
  
  // Clear city/county storage
  (map as any).cityCountyZipPolygons = [];
  (map as any).cityCountyZipPolygonMap = {};
  (map as any).isCityCountyView = false; // Clear city/county view flag
  
  const infoWindow = (map as any).cityCountyInfoWindow;
  if (infoWindow) {
    infoWindow.close();
  }
}

