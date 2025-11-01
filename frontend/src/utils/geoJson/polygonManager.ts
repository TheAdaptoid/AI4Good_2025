/**
 * Polygon management - update, reset, clear polygon functions
 */

/**
 * Clear all zip code polygons from map
 */
export function clearZipCodePolygons(map: google.maps.Map): void {
  const polygons = (map as any).zipCodePolygons || [];
  polygons.forEach((polygon: google.maps.Polygon) => {
    polygon.setMap(null);
  });
  (map as any).zipCodePolygons = [];
  (map as any).zipCodePolygonMap = {};
}

/**
 * Update the color of a specific zip code polygon
 */
export function updateZipCodePolygonColor(
  map: google.maps.Map,
  zipCode: string,
  color: string
): void {
  let polygonMap = (map as any).zipCodePolygonMap || {};
  let polygon = polygonMap[zipCode];
  
  if (!polygon) {
    polygonMap = (map as any).cityCountyZipPolygonMap || {};
    polygon = polygonMap[zipCode];
  }
  
  if (polygon) {
    if ((polygon as any).setSelected) {
      (polygon as any).setSelected(true);
    }
    
    (map as any).currentSelectedZipCode = zipCode;
    
    const infoWindow = (map as any).zipCodeInfoWindow;
    if (infoWindow) {
      infoWindow.close();
    }
    const cityCountyInfoWindow = (map as any).cityCountyInfoWindow;
    if (cityCountyInfoWindow) {
      cityCountyInfoWindow.close();
    }
    
    polygon.setOptions({
      fillColor: color,
      fillOpacity: 0.4,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 3
    });
  } else {
    // Try to load polygon if not found
    loadZipCodePolygonIfNeeded(map, zipCode).then((loadedPolygon) => {
      if (loadedPolygon) {
        updateZipCodePolygonColor(map, zipCode, color);
      }
    });
  }
}

/**
 * Load a single zip code polygon if it's not already loaded
 */
export async function loadZipCodePolygonIfNeeded(
  map: google.maps.Map,
  zipCode: string
): Promise<google.maps.Polygon | null> {
  const polygonMap = (map as any).zipCodePolygonMap || {};
  if (polygonMap[zipCode]) {
    return polygonMap[zipCode];
  }

  try {
    const { getCachedGeoJSON } = await import('./geoJsonLoader');
    const { extractZipCode } = await import('./geoJsonUtils');
    const { createPolygonFromFeature } = await import('./polygonRenderer');
    
    const geoJSON = await getCachedGeoJSON();
    if (!geoJSON) {
      return null;
    }

    const feature = geoJSON.features.find(f => {
      const code = extractZipCode(f);
      return code === zipCode;
    });

    if (feature) {
      const polygon = createPolygonFromFeature(
        map,
        feature,
        () => '#4285f4',
        undefined,
        undefined
      );
      
      if (polygon) {
        polygon.setOptions({
          fillOpacity: 0,
          strokeOpacity: 0
        });
        
        if (!(map as any).zipCodePolygonMap) {
          (map as any).zipCodePolygonMap = {};
          (map as any).zipCodePolygons = [];
        }
        
        (map as any).zipCodePolygonMap[zipCode] = polygon;
        (map as any).zipCodePolygons.push(polygon);
      }
      
      return polygon;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Failed to load zip code polygon for ${zipCode}:`, error);
    }
  }
  
  return null;
}

/**
 * Reset a zip code polygon to default invisible state
 */
export function resetZipCodePolygonToInvisible(
  map: google.maps.Map,
  zipCode: string
): void {
  let polygonMap = (map as any).zipCodePolygonMap || {};
  let polygon = polygonMap[zipCode];
  
  if (!polygon) {
    polygonMap = (map as any).cityCountyZipPolygonMap || {};
    polygon = polygonMap[zipCode];
  }
  
  if (polygon) {
    if ((polygon as any).setSelected) {
      (polygon as any).setSelected(false);
    }
    
    polygon.setOptions({
      strokeColor: '#4285f4',
      strokeOpacity: 0,
      strokeWeight: 2,
      fillColor: '#4285f4',
      fillOpacity: 0
    });
  }
}

