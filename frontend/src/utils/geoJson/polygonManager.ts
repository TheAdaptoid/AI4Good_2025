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
 * @param preserveSelectedZip - If true, don't update currentSelectedZipCode (useful for comparison polygons)
 */
export function updateZipCodePolygonColor(
  map: google.maps.Map,
  zipCode: string,
  color: string,
  preserveSelectedZip: boolean = false
): void {
  let polygonMap = (map as any).zipCodePolygonMap || {};
  let polygon = polygonMap[zipCode];
  
  if (!polygon) {
    polygonMap = (map as any).cityCountyZipPolygonMap || {};
    polygon = polygonMap[zipCode];
  }
  
  // Also try to find polygon by iterating through all polygons (fallback)
  if (!polygon) {
    const allPolygons = (map as any).zipCodePolygons || [];
    polygon = allPolygons.find((p: google.maps.Polygon) => (p as any).zipCode === zipCode);
  }
  
  if (polygon) {
    if (import.meta.env.DEV) {
      console.log(`[polygonManager] Found polygon for ${zipCode}, updating to ${color}`);
    }
    
    // Only update selected state if not preserving (i.e., for comparison polygons)
    if (!preserveSelectedZip) {
      if ((polygon as any).setSelected) {
        (polygon as any).setSelected(true);
      }
      
      // Set currentSelectedZipCode BEFORE updating color to prevent mouseout from interfering
      (map as any).currentSelectedZipCode = zipCode;
      
      const infoWindow = (map as any).zipCodeInfoWindow;
      if (infoWindow) {
        infoWindow.close();
      }
      const cityCountyInfoWindow = (map as any).cityCountyInfoWindow;
      if (cityCountyInfoWindow) {
        cityCountyInfoWindow.close();
      }
      
      if (import.meta.env.DEV) {
        console.log(`[polygonManager] Set currentSelectedZipCode to ${zipCode} before color update`);
      }
    }
    
    // Update the polygon color - simple approach like cityCountyRenderer
    // Set all options together to ensure consistency
    polygon.setOptions({
      fillColor: color,
      fillOpacity: 0.4,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 3,
      visible: true
    });
    
    // Immediately verify the color was set correctly
    const actualFillColor = polygon.get('fillColor');
    const actualStrokeColor = polygon.get('strokeColor');
    
    if (import.meta.env.DEV) {
      console.log(`[polygonManager] Updated polygon options for ${zipCode} to ${color}`);
      console.log(`[polygonManager] Verified - fillColor: ${actualFillColor}, strokeColor: ${actualStrokeColor}`);
      
      // If colors don't match, log a warning
      if (actualFillColor !== color || actualStrokeColor !== color) {
        console.warn(`[polygonManager] WARNING: Color mismatch! Expected ${color}, got fillColor=${actualFillColor}, strokeColor=${actualStrokeColor}`);
      }
    }
  } else {
    // Try to load polygon if not found
    loadZipCodePolygonIfNeeded(map, zipCode).then((loadedPolygon) => {
      if (loadedPolygon) {
        updateZipCodePolygonColor(map, zipCode, color, preserveSelectedZip);
      } else if (import.meta.env.DEV) {
        console.warn(`Polygon not found for zip code ${zipCode} and could not be loaded`);
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
        () => '#9e9e9e', // Gray - N/A until score is loaded
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
    
    // Clear currentSelectedZipCode if this was the selected zip
    if ((map as any).currentSelectedZipCode === zipCode) {
      (map as any).currentSelectedZipCode = null;
    }
    
    polygon.setOptions({
      strokeColor: '#9e9e9e', // Gray - N/A until score is loaded
      strokeOpacity: 0,
      strokeWeight: 2,
      fillColor: '#9e9e9e', // Gray - N/A until score is loaded
      fillOpacity: 0
    });
  }
}

