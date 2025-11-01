# Zip Code Boundary Data

This folder should contain a GeoJSON file with Florida zip code boundary data.

## Required File

**File**: `florida-zipcodes.geojson`

This file should contain GeoJSON FeatureCollection with zip code boundaries for Florida only.

**Location**: `frontend/public/data/zipcodes/florida-zipcodes.geojson`

## Easy Option: Download Pre-Made Florida GeoJSON

### Option 1: SC Data Co (Recommended - Easiest)

**Direct Download**: https://github.com/OpenDataDE/State-zip-code-geojson

1. Go to: https://github.com/OpenDataDE/State-zip-code-geojson
2. Navigate to the `files` folder
3. Download `fl_zip_codes_geo.min.json` (compressed) or `fl_zip_codes_geo.json` (full)
4. Rename it to `florida-zipcodes.geojson`
5. Place it in this directory: `frontend/public/data/zipcodes/`

**Direct links** (if available):
- Full resolution: https://raw.githubusercontent.com/OpenDataDE/State-zip-code-geojson/master/files/fl_zip_codes_geo.json
- Compressed: https://raw.githubusercontent.com/OpenDataDE/State-zip-code-geojson/master/files/fl_zip_codes_geo.min.json

### Option 2: Florida Department of Health (ArcGIS REST Service)

**Service URL**: https://gis.floridahealth.gov/server/rest/services/EPI/Zip_Code_Boundaries/MapServer/0

1. Open the URL above in your browser
2. Look for export/download options
3. Export as GeoJSON format
4. Save as `florida-zipcodes.geojson` in this directory

### Option 3: Florida Department of Transportation (ArcGIS REST Service)

**Service URL**: https://gis.fdot.gov/arcgis/rest/services/Admin_Boundaries/MapServer/8

1. Open the URL above in your browser
2. Look for export/download options
3. Export as GeoJSON format
4. Save as `florida-zipcodes.geojson` in this directory

## Manual Option: From Census TIGER Files

If you need to create it from scratch, download from:

**Census TIGER/Line Files**: https://www2.census.gov/geo/tiger/TIGER2025/ZCTA520/

1. Download `tl_2025_us_zcta520.zip` (~500MB national file)
2. Extract the shapefile
3. Filter for Florida zip codes (32000-34999 range)
4. Convert to GeoJSON using:
   - **QGIS**: Open shapefile → Filter → Export as GeoJSON
   - **Mapshaper**: https://mapshaper.org/ (upload, filter, export)
   - **ogr2ogr**: `ogr2ogr -f GeoJSON florida-zipcodes.geojson tl_2025_us_zcta520.shp -where "ZCTA5CE20 >= '32000' AND ZCTA5CE20 < '35000'"`

## File Format

The GeoJSON file should have this structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "ZCTA5CE20": "32256",
        // or "ZCTA5CE10", "ZCTA5", "ZIPCODE", "POSTAL_CODE", etc.
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], ...]]
      }
    },
    // ... more Florida zip codes
  ]
}
```

## Property Names

The code will try to extract zip codes from these property names (in order):
- `ZCTA5CE20` (Census 2020/2025 format - most common)
- `ZCTA5CE10` (Census 2010 format)
- `ZCTA5` (Alternative format)
- `GEOID` (Geographic Identifier)
- `ZIPCODE` (If using other data sources)
- `ZIP_CODE` (Alternative format)
- `POSTAL_CODE` (Alternative format)
- `NAME` (if it contains a 5-digit number)

## Notes

- **File size**: Florida-only file should be ~5-15MB (much smaller than full US file)
- **Coordinate system**: GeoJSON uses WGS84 (EPSG:4326) which works with Google Maps
- **Geometry type**: Supports both `Polygon` and `MultiPolygon`
- **Data source**: Official government sources (Census Bureau, Florida state agencies)

## Quick Start

**Fastest way**: Download from SC Data Co GitHub:
```powershell
# Download using PowerShell (if you have it)
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-geojson/master/files/fl_zip_codes_geo.min.json" -OutFile "frontend\public\data\zipcodes\florida-zipcodes.geojson"
```

Or manually download from: https://github.com/OpenDataDE/State-zip-code-geojson and place in this directory.
