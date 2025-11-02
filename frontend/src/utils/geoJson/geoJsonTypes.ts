/**
 * GeoJSON type definitions
 */

export interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    [key: string]: any;
    ZCTA5CE10?: string; // Census format
    ZCTA5?: string; // Alternative format
    GEOID?: string; // Alternative format
    NAME?: string;
    ZIP?: string; // FDOT format
    PO_NAME?: string;
    POPULATION?: number;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

