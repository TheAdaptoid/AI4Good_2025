/**
 * Polygon event handlers - hover and click handlers for zip code polygons
 */

import { resetZipCodePolygonToInvisible } from './polygonManager';

/**
 * Create InfoWindow content HTML for a zip code polygon
 */
function createInfoWindowContent(zipCode: string, cityName: string | null, population: number | null): string {
  const popText = population ? population.toLocaleString() : 'N/A';
  const cityText = cityName || 'N/A';
  
  return `
    <style>
      .gm-style .gm-style-iw-c button[title="Close"],
      .gm-style .gm-style-iw-c button[aria-label="Close"],
      .gm-style .gm-style-iw-d button {
        display: none !important;
      }
    </style>
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 8px; font-size: 10px; line-height: 1.3;">
      <div style="font-weight: 600; color: #1967d2; margin-bottom: 2px; font-size: 11px;">
        ZIP ${zipCode}
      </div>
      <div style="color: #5f6368; font-size: 9px;">
        ${cityText}
      </div>
      <div style="color: #80868b; font-size: 9px;">
        Pop: ${popText}
      </div>
    </div>
  `;
}

/**
 * Setup hover handlers for a polygon
 */
export function setupPolygonHoverHandlers(
  polygon: google.maps.Polygon,
  zipCode: string,
  infoWindow: google.maps.InfoWindow | undefined,
  cityName: string | null,
  population: number | null,
  isSelectedRef: { value: boolean }
): void {
  polygon.addListener('mouseover', (e: google.maps.MapMouseEvent) => {
    const map = polygon.getMap();
    if (!map) return;
    
    // Check if city/county is currently loading - prevent hover during loading
    const isCityCountyLoading = (map as any).isCityCountyLoading;
    if (isCityCountyLoading) {
      return;
    }
    
    // Check if we're in a city/county view
    // In city/county view, zips are already highlighted with colors
    // Only show InfoWindow on hover, don't change polygon appearance
    const isCityCountyView = (map as any).isCityCountyView;
    if (isCityCountyView) {
      // In city/county view, only show InfoWindow, don't change polygon colors
      if (infoWindow && e.latLng) {
        const content = createInfoWindowContent(zipCode, cityName, population);
        infoWindow.setContent(content);
        
        const offsetPosition = {
          lat: e.latLng.lat() + 0.0005,
          lng: e.latLng.lng() - 0.0005
        };
        
        infoWindow.setPosition(offsetPosition);
        infoWindow.open(map);
      }
      return;
    }
    
    // Check both the ref and the map's currentSelectedZipCode
    // If this zip is currently selected, completely ignore hover - don't show InfoWindow or change appearance
    const currentSelectedZip = (map as any).currentSelectedZipCode;
    const isSelected = isSelectedRef.value || (currentSelectedZip === zipCode);
    
    if (isSelected) {
      // Selected zip codes are locked - no hover effects at all
      return;
    }
    
    // Only apply hover effects for non-selected zips (not in city/county view)
    polygon.setOptions({
      strokeOpacity: 0.8,
      fillOpacity: 0.3,
      strokeWeight: 3,
      strokeColor: '#4285f4',
      fillColor: '#4285f4'
    });

    if (infoWindow && e.latLng) {
      const content = createInfoWindowContent(zipCode, cityName, population);
      infoWindow.setContent(content);
      
      const offsetPosition = {
        lat: e.latLng.lat() + 0.0005,
        lng: e.latLng.lng() - 0.0005
      };
      
      infoWindow.setPosition(offsetPosition);
      infoWindow.open(map);
    }
  });

  polygon.addListener('mouseout', () => {
    const map = polygon.getMap();
    if (!map) return;
    
    // Check if city/county is currently loading - prevent hover during loading
    const isCityCountyLoading = (map as any).isCityCountyLoading;
    if (isCityCountyLoading) {
      return;
    }
    
    // Check if we're in a city/county view - if so, keep all zips highlighted
    // Zips in city/county view should not be removed by hover
    const isCityCountyView = (map as any).isCityCountyView;
    if (isCityCountyView) {
      // In city/county view, only close InfoWindow, don't change polygon appearance
      if (infoWindow) {
        infoWindow.close();
      }
      return;
    }
    
    // Check both the ref and the map's currentSelectedZipCode
    // If this zip is currently selected, completely ignore mouseout - don't change appearance
    const currentSelectedZip = (map as any).currentSelectedZipCode;
    const isSelected = isSelectedRef.value || (currentSelectedZip === zipCode);
    
    if (isSelected) {
      // Selected zip codes are locked - no hover effects at all
      return;
    }
    
    // Only reset hover effects for non-selected zips (not in city/county view)
    polygon.setOptions({
      fillOpacity: 0,
      strokeOpacity: 0,
      strokeWeight: 2
    });
    
    if (infoWindow) {
      infoWindow.close();
    }
  });
}

/**
 * Setup click handler for a polygon
 */
export function setupPolygonClickHandler(
  polygon: google.maps.Polygon,
  zipCode: string,
  paths: google.maps.LatLngLiteral[][],
  map: google.maps.Map,
  onZipCodeClick?: (zipCode: string) => void,
  isSelectedRef?: { value: boolean }
): void {
  if (!onZipCodeClick) return;

  polygon.addListener('click', (event: google.maps.MapMouseEvent) => {
    if (event.stop) {
      event.stop();
    }
    
    // Check if city/county is currently loading - prevent clicks during loading
    const isCityCountyLoading = (map as any).isCityCountyLoading;
    if (isCityCountyLoading) {
      if (import.meta.env.DEV) {
        console.log('Zip code click blocked: city/county is loading');
      }
      return;
    }
    
    // Check if we're in city/county view
    // If clicking a zip in city/county view, allow the click to proceed to clear city/county view
    const isCityCountyView = (map as any).isCityCountyView;
    
    // Check if this zip is already selected as a single zip (not in city/county view)
    // If in city/county view, allow clicks to transition from city/county to single zip view
    const currentSelectedZip = (map as any).currentSelectedZipCode;
    const isAlreadySelected = currentSelectedZip === zipCode || 
                             (isSelectedRef && isSelectedRef.value);
    
    // Only skip if already selected AND not in city/county view
    // In city/county view, clicking a highlighted zip should transition to single zip view
    if (isAlreadySelected && !isCityCountyView) {
      if (import.meta.env.DEV) {
        console.log('Zip code already selected, ignoring click:', zipCode);
      }
      return; // Don't process click on already selected zip (only if not in city/county view)
    }
    
    // If in city/county view and clicking a zip, clear city/county view first
    // The onZipCodeClick callback will handle clearing city/county boundaries,
    // but we need to ensure the click proceeds
    if (isCityCountyView && import.meta.env.DEV) {
      console.log('Clicking zip in city/county view, transitioning to single zip view:', zipCode);
    }
    
    // Reset previously selected zip code (only if it's different)
    if (currentSelectedZip && currentSelectedZip !== zipCode) {
      resetZipCodePolygonToInvisible(map, currentSelectedZip);
    }
    
    // Mark as selected
    if (isSelectedRef) {
      isSelectedRef.value = true;
    }
    (map as any).currentSelectedZipCode = zipCode;
    
    // Zoom to polygon bounds
    const polyBounds = new google.maps.LatLngBounds();
    if (paths[0]) {
      paths[0].forEach((pt: google.maps.LatLngLiteral) => {
        polyBounds.extend(pt);
      });
      map.fitBounds(polyBounds);
    }
    
    // Keep polygon highlighted
    polygon.setOptions({
      fillOpacity: 0.3,
      strokeOpacity: 0.9,
      strokeWeight: 3,
      strokeColor: '#4285f4',
      fillColor: '#4285f4'
    });
    
    if (import.meta.env.DEV) {
      console.log('Polygon clicked for zip code:', zipCode);
    }
    onZipCodeClick(zipCode);
  });
}

