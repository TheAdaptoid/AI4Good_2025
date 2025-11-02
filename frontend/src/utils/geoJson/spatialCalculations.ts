/**
 * Spatial calculation utilities - point-in-polygon, area overlap, centroid
 */

/**
 * Calculate the centroid (center point) of a polygon
 */
export function calculateCentroid(paths: google.maps.LatLngLiteral[][]): google.maps.LatLngLiteral | null {
  if (paths.length === 0 || paths[0].length === 0) {
    return null;
  }
  
  let totalLat = 0;
  let totalLng = 0;
  let pointCount = 0;
  
  for (const path of paths) {
    for (const point of path) {
      totalLat += point.lat;
      totalLng += point.lng;
      pointCount++;
    }
  }
  
  if (pointCount === 0) {
    return null;
  }
  
  return {
    lat: totalLat / pointCount,
    lng: totalLng / pointCount
  };
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(point: google.maps.LatLngLiteral, polygonPaths: google.maps.LatLngLiteral[][]): boolean {
  if (polygonPaths.length === 0) {
    return false;
  }
  
  const outerRing = polygonPaths[0];
  if (!outerRing || outerRing.length < 3) {
    return false;
  }
  
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  
  for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
    const xi = outerRing[i].lng;
    const yi = outerRing[i].lat;
    const xj = outerRing[j].lng;
    const yj = outerRing[j].lat;
    
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }
  
  // If point is in outer ring, check if it's in any holes (inner rings)
  if (inside && polygonPaths.length > 1) {
    for (let i = 1; i < polygonPaths.length; i++) {
      const hole = polygonPaths[i];
      if (hole && hole.length >= 3) {
        let inHole = false;
        for (let j = 0, k = hole.length - 1; j < hole.length; k = j++) {
          const xj = hole[j].lng;
          const yj = hole[j].lat;
          const xk = hole[k].lng;
          const yk = hole[k].lat;
          
          const intersect = ((yj > y) !== (yk > y)) && (x < (xk - xj) * (y - yj) / (yk - yj) + xj);
          if (intersect) {
            inHole = !inHole;
          }
        }
        if (inHole) {
          inside = false;
          break;
        }
      }
    }
  }
  
  return inside;
}

/**
 * Calculate the approximate area overlap percentage between a zip code and a county/city boundary
 * Uses point sampling to estimate what percentage of the zip code's area is within the boundary
 * Returns a value between 0 and 1 (0 = no overlap, 1 = completely inside)
 */
export function calculateAreaOverlapPercentage(
  zipCodePaths: google.maps.LatLngLiteral[][],
  boundaryPaths: google.maps.LatLngLiteral[][]
): number {
  if (zipCodePaths.length === 0 || boundaryPaths.length === 0) {
    return 0;
  }
  
  let pointsInside = 0;
  let totalPoints = 0;
  
  // Sample points from the outer boundary
  const outerRing = zipCodePaths[0];
  if (outerRing && outerRing.length > 0) {
    const sampleRate = Math.max(1, Math.floor(outerRing.length / 50));
    for (let i = 0; i < outerRing.length; i += sampleRate) {
      if (isPointInPolygon(outerRing[i], boundaryPaths)) {
        pointsInside++;
      }
      totalPoints++;
    }
  }
  
  // Also sample interior points using a grid approach
  const bounds = new google.maps.LatLngBounds();
  zipCodePaths.forEach(path => {
    path.forEach(point => bounds.extend(point));
  });
  
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const latStep = (ne.lat() - sw.lat()) / 10;
  const lngStep = (ne.lng() - sw.lng()) / 10;
  
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const testPoint: google.maps.LatLngLiteral = {
        lat: sw.lat() + (i * latStep),
        lng: sw.lng() + (j * lngStep)
      };
      
      if (isPointInPolygon(testPoint, zipCodePaths)) {
        if (isPointInPolygon(testPoint, boundaryPaths)) {
          pointsInside++;
        }
        totalPoints++;
      }
    }
  }
  
  return totalPoints > 0 ? pointsInside / totalPoints : 0;
}

/**
 * Check if zip code overlaps with county boundary
 * For zip codes that span multiple counties, this will include them in all relevant counties
 * Uses a lower threshold (30%) to catch multi-county zip codes
 */
export function isZipCodeInCounty(
  zipCodePaths: google.maps.LatLngLiteral[][],
  countyPaths: google.maps.LatLngLiteral[][]
): boolean {
  if (zipCodePaths.length === 0 || countyPaths.length === 0) {
    return false;
  }
  
  // Check centroid - if centroid is in county, definitely include it
  const centroid = calculateCentroid(zipCodePaths);
  if (centroid && isPointInPolygon(centroid, countyPaths)) {
    return true;
  }
  
  // Check area overlap - if >= 30% of zip is in county, include it
  const overlapPercentage = calculateAreaOverlapPercentage(zipCodePaths, countyPaths);
  return overlapPercentage >= 0.3;
}

