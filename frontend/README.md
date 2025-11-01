# Horizon Score Dashboard

Frontend dashboard for displaying and exploring Horizon Score affordability data for Jacksonville, FL.

## Overview

A three-pane interactive dashboard that allows users to:
- Search addresses or zip codes with Google Places Autocomplete
- View Horizon Scores with detailed factor breakdown
- Compare scores between locations
- Discover similar affordable areas
- Visualize data on an interactive map with geofenced boundaries

## Features

### Phase 1: Core Functionality ✅
- Three-pane layout (Map, Score Display, Comparison)
- Google Maps integration with Jacksonville view
- Google Places Autocomplete search
- Basic Horizon Score display
- Zip code boundary overlays

### Phase 2: Score Details ✅
- Full factor breakdown (positive/negative factors)
- Visual score reasoning display
- Trend prediction with charts
- Geographic information display

### Phase 3: Comparison Feature ✅
- Two-tab comparison system
- Side-by-side score comparison
- Factor-by-factor comparison view

### Phase 4: Similar Areas ✅
- Similar areas list with click-to-view
- Distance and similarity indicators

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google Maps API Key (see setup instructions below)

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Create a `.env` file in the `frontend` directory:

```bash
# Google Maps API Key (required)
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Backend API URL (optional, defaults to /api)
VITE_API_URL=http://localhost:8000/api
```

### Google Maps API Setup

#### Required APIs

Enable these **2 APIs** in [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Library:

1. **Maps JavaScript API** ✅ **REQUIRED**
   - Purpose: Display interactive maps
   - Enable this first

2. **Geocoding API** ✅ **REQUIRED**
   - Purpose: Convert addresses to coordinates and vice versa
   - Used for: Converting user searches to map locations, extracting zip codes

**Note**: Zip code boundaries use GeoJSON data from Census TIGER/Line files (see Boundaries section below). No additional Google APIs needed for boundaries.

#### Step-by-Step API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **"APIs & Services" > "Library"**
4. Enable APIs (in this order):

   **Step 1: Maps JavaScript API**
   - Search for: `Maps JavaScript API`
   - Click "Enable"

   **Step 2: Geocoding API**
   - Search for: `Geocoding API`
   - Click "Enable"

5. Create API Key:
   - Go to **"APIs & Services" > "Credentials"**
   - Click **"Create Credentials" > "API Key"**
   - Copy the API key

6. Add to `.env` file:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

7. Restart your dev server (`npm run dev`)

#### Cost Information

All required APIs have free tiers:
- **Maps JavaScript API**: Free for up to 28,000 map loads per month
- **Geocoding API**: Free for up to $200 credit/month

For development/testing, you'll likely stay within free tiers.

#### ✅ Zip Code Boundaries - GeoJSON (Florida Only)

**Using GeoJSON data from U.S. Census Bureau TIGER/Line files (Florida zip codes only)**

Since Google DDS Boundaries requires Region Lookup API which may not be available, we're using GeoJSON data from Census TIGER/Line files filtered for Florida only.

**Setup:**

1. **Create Florida GeoJSON File**:
   - See `frontend/public/data/zipcodes/README.md` for detailed instructions
   - Download national zip code boundaries from U.S. Census Bureau
   - Filter for Florida zip codes only (32xxx, 33xxx, 34xxx ranges)
   - Convert to GeoJSON format
   - Place `florida-zipcodes.geojson` in `frontend/public/data/zipcodes/` directory

2. **Quick Start**:
   ```bash
   # The GeoJSON file should be at:
   frontend/public/data/zipcodes/florida-zipcodes.geojson
   ```

**Implementation:**
- Uses `google.maps.Polygon` to draw boundaries
- Loads GeoJSON from public folder (single file)
- Supports click events on zip code polygons
- Color-coded based on Horizon Scores
- Works for any Florida zip code

**Benefits:**
- ✅ Works without Region Lookup API
- ✅ Reliable - Official Census data
- ✅ Free and open-source
- ✅ Clickable boundaries
- ✅ Full control over styling
- ✅ Much smaller file size (~5-15MB vs 100-200MB for full US)

**Data Source:**
- **2025 TIGER/Line Files** (Latest): https://www2.census.gov/geo/tiger/TIGER2025/
- Navigate to `<ZCTA520/>` folder for ZIP Code Tabulation Areas
- Filter for Florida zip codes (32000-34999 range)
- See `frontend/public/data/zipcodes/README.md` for complete setup instructions

### Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── Dashboard/        # Main dashboard container
│   ├── Map/              # Google Maps component
│   ├── SearchBar/        # Standard text search input
│   ├── ScoreDisplay/     # Horizon Score display with factors
│   ├── Comparison/       # Comparison features
│   └── SimilarAreas/     # Similar areas list
├── services/
│   └── api.ts           # API service layer
├── types/
│   ├── index.ts         # TypeScript type definitions
│   └── google-maps.d.ts # Google Maps type declarations
└── utils/
    ├── geocode.ts              # Geocoding utilities
    └── geojsonBoundaries.ts   # GeoJSON boundaries implementation
public/
└── data/
    └── zipcodes/
        ├── README.md                    # Instructions for obtaining GeoJSON data
        └── jacksonville-zipcodes.geojson # Place GeoJSON file here (see README.md)
```

## API Endpoints

The frontend expects the backend to provide:

### Horizon Score
- `GET /api/horizon-score?address=<address>` - Get Horizon Score by address
- `GET /api/horizon-score?zipCode=<code>` - Get Horizon Score by zip code

### Boundaries (Geofencing)
- Use GeoJSON data from U.S. Census Bureau TIGER/Line files (Florida only)
  - Download and filter instructions in `frontend/public/data/zipcodes/README.md`
  - Place GeoJSON file at `frontend/public/data/zipcodes/florida-zipcodes.geojson`
  - Implementation in `frontend/src/utils/geojsonBoundaries.ts`

### Comparison & Similar Areas
- `GET /api/similar-areas?zipCode=<code>&score=<score>&limit=10` - Get similar areas

**Note**: If the backend is not available, the frontend will use mock data for development.

## Google Maps Integration

### APIs Used
1. **Maps JavaScript API** - Map display and rendering
2. **Geocoding API** - Address ↔ coordinates conversion

### Geofencing & Boundaries
- **Zip Code Boundaries**: Using GeoJSON data from U.S. Census Bureau (Florida only)
  - Postal code boundaries displayed as clickable polygons
  - Color-coded by Horizon Score (green = high, red = low)
  - Selected zip code highlighted with blue border
  - Click any zip code polygon → Updates score display
  - Works for any Florida zip code (32000-34999 range)
  - GeoJSON file required: `frontend/public/data/zipcodes/florida-zipcodes.geojson`
  - See `frontend/public/data/zipcodes/README.md` for download and filter instructions

## Technologies

- **React** + **TypeScript**
- **Vite** - Build tool
- **@react-google-maps/api** - Google Maps React integration
- **Recharts** - Data visualization
- **Axios** - HTTP client

## Troubleshooting

### Legacy API Warning
**Error**: `You're calling a legacy API, which is not enabled for your project`

**Solution**: 
- Enable **"Places API (New)"** in Google Cloud Console (preferred)
- OR enable legacy **"Places API"** if new API doesn't work
- Code automatically uses new API if available, falls back to legacy

### Autocomplete Deprecation Warning
**Warning**: `google.maps.places.Autocomplete is not available to new customers`

**Status**: ✅ **Expected - Can be ignored**
- This is a deprecation warning from Google - legacy API still works
- Code uses new API if available, falls back to legacy automatically
- **No action needed** - both APIs work fine

### ERR_BLOCKED_BY_CLIENT
**Error**: `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT`

**Solution**: This is usually caused by an ad blocker.
- Temporarily disable ad blockers for `localhost:3000`
- Or add `localhost:3000` to your ad blocker's allowlist
- This doesn't affect functionality, just blocks some Google Maps CSP test requests

### Connection Refused Errors
**Error**: `Failed to load resource: net::ERR_CONNECTION_REFUSED`

**Status**: ✅ **Expected and Handled Silently**
- These occur when the backend isn't running
- The frontend automatically falls back to mock data
- **No action needed** - the app works with mock data for development
- These errors are suppressed in the console (still visible in Network tab)

### API Key Errors
**Error**: `BillingNotEnabledMapError` or `ApiNotActivatedMapError`

**Solution**:
1. **Billing**: Enable billing in Google Cloud Console (required for Maps API)
2. **API Activation**: Ensure these APIs are enabled:
   - Maps JavaScript API
   - Places API (New) (recommended)
   - Places API (legacy fallback)
   - Geocoding API

### Vite Proxy Errors
**Warning**: `[vite] http proxy error`

**Status**: ✅ **Expected and Suppressed**
- These occur when backend isn't running
- Vite proxy configuration suppresses `ECONNREFUSED` errors
- Frontend falls back to mock data automatically

### Quick Fixes Checklist

- [ ] Enable billing in Google Cloud Console
- [ ] Enable Maps JavaScript API
- [ ] Enable Geocoding API
- [ ] Create API Key
- [ ] Add API key to `.env` file
- [ ] Create Florida zip codes GeoJSON file (see `frontend/public/data/zipcodes/README.md`)
- [ ] Place `florida-zipcodes.geojson` in `frontend/public/data/zipcodes/` directory
- [ ] Restart dev server after adding API key
- [ ] Check browser console for any remaining errors

## Development Notes

- Mock data is used when backend is unavailable (connection refused errors are silently handled)
- Vite proxy configured for `/api` requests (forwards to `http://localhost:8000`)
- All Google Maps API calls require valid API key in environment variables
- Code automatically uses Places API (New) if enabled, otherwise falls back to legacy API
- Console logging is environment-aware (only logs in development mode)
