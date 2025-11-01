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
    if (!isSelectedRef.value) {
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
        infoWindow.open(polygon.getMap()!);
      }
    }
  });

  polygon.addListener('mouseout', () => {
    if (!isSelectedRef.value) {
      polygon.setOptions({
        fillOpacity: 0,
        strokeOpacity: 0,
        strokeWeight: 2
      });
      
      if (infoWindow) {
        infoWindow.close();
      }
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
    
    // Reset previously selected zip code
    const currentSelectedZip = (map as any).currentSelectedZipCode;
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

