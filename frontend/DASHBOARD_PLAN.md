# Affordability Index Dashboard Plan - Revised

## Overview
Build a map-based dashboard for displaying predictive affordability trends with interactive hotspots. Users can click on geographic areas to see detailed trends and displacement risk scores. Focus is primarily on affordability trends, with displacement risk as a secondary feature.

## Key Requirements

### 1. Geographic Hierarchy
- **Level 1**: State view (Florida)
- **Level 2**: County view (Jacksonville/Duval County)
- **Level 3**: Census Tract view (most detailed) - Note: Data is organized by Census Tract (geoid), may need to aggregate to Zip code level if needed
- Navigation/zoom between levels

### 2. Predictive Trends
- **Timeframe**: 1 year predictions (eventually expand to 1, 5, 10 years)
- **Output**: Probability-based predictions from transformer model
- **Trend Direction**: Improving, Declining, Stable (directional representation)
- **Visualization**: Separate charts - one for historical data, one for predicted future (clear separation)

### 3. Interactive Map with Hotspots
- **Hotspot Definition**: Geographic areas with significant affordability indicators
- **Filtering**: 
  - Toggle between "Unaffordable" vs "Affordable" hotspots
  - Filter by trend direction (improving/declining/stable)
- **Interactivity**: Click on hotspots to see detailed view

### 4. Hotspot Detail View
When clicking on a hotspot, show:
- **Affordability Trend Details**:
  - **Historical Trend Chart**: Separate chart showing past data only
  - **Predicted Trend Chart**: Separate chart showing 1 year forecast only
  - Current affordability index score
  - Trend direction indicator (Improving/Declining/Stable)
  - Trend magnitude/change
- **Displacement Risk Score**: Single numerical score (secondary feature)
- **Geographic Information**: State, County, Census Tract (and Zip code if aggregated)
- **Supporting Metrics**: Income, housing costs, ratios (as available)

### 5. Primary vs Secondary Features
- **Primary**: Affordability trends and predictions
- **Secondary**: Displacement risk (add-on if time permits)

## Dashboard Components

### 1. Main Map View
- **Interactive map** showing geographic hierarchy (State/County/Zip)
- **Hotspot markers** color-coded by:
  - Affordability status (affordable vs unaffordable)
  - Trend direction (improving/declining/stable)
- **Zoom controls** to navigate between geographic levels
- **Filter panel** for hotspot visibility

### 2. Hotspot Detail Panel/Modal
- **Trend Visualization**: 
  - **Historical Chart**: Separate time series chart showing past years only
  - **Predicted Chart**: Separate time series chart showing 1-year forecast only
  - Clear visual separation between the two charts (side-by-side or stacked)
- **Current Metrics**:
  - Affordability index score
  - Trend direction indicator (Improving/Declining/Stable with arrows/icons)
  - Change percentage
- **Displacement Risk Score** (if available):
  - Single numerical display
  - Optional color coding (low/medium/high risk)

### 3. Filter Controls
- **Hotspot Filter**: 
  - Show all / Unaffordable only / Affordable only
- **Trend Filter**:
  - Show all / Improving / Declining / Stable
- **Geographic Level Selector**:
  - State / County / Census Tract (or Zip code if aggregated)

### 4. Summary Statistics Panel
- Overall affordability metrics
- Count of areas by category
- Average trends across visible areas

## Raw Data Structure (Jacksonville.csv)

### CSV Format
The raw data is organized with the following structure:
- **Columns**: feature id, feature label, shid, geoid, indicator name, indicator time, indicator unit, indicator format, indicator source, value
- **Geographic Level**: Census Tracts (geoid format like "12031014421")
- **Hierarchy**: `country:us/state:fl/tract:XXXXX` (from shid field)
- **Time Periods**: Mix of "2019-2023" (5-year ACS) and "2024" (current year)
- **Data Sources**: US Census Bureau ACS 5-year, HUD Picture Subsidized HH

### Key Indicators Available
- Median Household Income (by age groups, owner vs renter)
- Rent as Percentage of Income
- Ownership Costs as Percentage of Income
- Excessive Housing Costs (renter and owner)
- HUD Assisted Housing metrics
- SNAP and Public Assistance data
- Income disparity ratios

### Data Processing Notes
- Backend will clean and transform this raw CSV data
- Transformer model will generate affordability predictions
- Historical data (2019-2023) will feed trend analysis
- Current data (2024) serves as "now" point
- Predictions will be for future years (2025+)

## Data Structure Assumptions (After Backend Processing)

### Input Data (from transformer model)
```typescript
interface AffordabilityPrediction {
  // Geographic identifiers
  state: string;
  county: string;
  censusTract: string; // Primary geographic unit from raw data
  zipCode?: string; // Optional if aggregated from tracts
  
  // Current affordability
  currentAffordabilityIndex: number;
  currentYear: number;
  
  // Historical data points
  historical: {
    year: number;
    affordabilityIndex: number;
    medianIncome?: number;
    avgHousingCost?: number;
  }[];
  
  // Predicted data points (1 year for now)
  predicted: {
    year: number;
    affordabilityIndex: number;
    probability?: number; // from transformer model
    medianIncome?: number;
    avgHousingCost?: number;
  }[];
  
  // Trend classification
  trendDirection: 'improving' | 'declining' | 'stable';
  trendMagnitude: number; // percentage change
  
  // Displacement risk (secondary)
  displacementRisk?: number; // 0-100 score
}
```

## Data Display Plan

### Primary Displays

1. **Map-based Geographic Distribution**
   - Interactive map with zoom levels (State → County → Zip)
   - Hotspot markers with color coding
   - Click interaction to open detail view

2. **Trend Charts** (in hotspot detail)
   - **Historical Chart**: 
     - X-axis: Historical years
     - Y-axis: Affordability Index
     - Line chart showing past data
   - **Predicted Chart**:
     - X-axis: Predicted year(s)
     - Y-axis: Affordability Index
     - Line chart showing 1-year forecast
   - Charts displayed side-by-side for clear separation

3. **Hotspot Status Indicators**
   - Color-coded markers on map
   - Category labels (Affordable/Unaffordable)
   - Trend direction indicators (directional: arrows/icons showing Improving/Declining/Stable)

### Secondary Displays

4. **Displacement Risk Score** (if available)
   - Single number display
   - Color-coded indicator (low/medium/high)
   - Appears in hotspot detail view

5. **Supporting Metrics** (if available)
   - Income vs. housing costs
   - Affordability ratios
   - Displayed in hotspot detail view

## User Interaction Flow

1. **Initial View**: Map showing state/county level with hotspots
2. **Filter Hotspots**: User selects affordable/unaffordable or trend filters
3. **Zoom/Explore**: User zooms into county or zip code level
4. **Click Hotspot**: Detail panel/modal opens showing:
   - Historical trend chart (separate)
   - Predicted trend chart (separate)
   - Current affordability score
   - Trend direction indicator (directional)
   - Displacement risk (if available)
   - Supporting metrics
5. **Navigate**: Close detail and continue exploring map

## Technical Approach

### Data Loading
- Load CSV data (recent housing data)
- Process through transformer model (backend - not our concern)
- Frontend receives processed predictions via API

### API Expectations (to be provided by backend)
- `GET /api/data/affordability-predictions` - Get all predictions
- `GET /api/data/trends?tract=<geoid>` or `?zipCode=<code>` - Get trend data for specific area
- `GET /api/data/hotspots?filter=<filter>` - Get filtered hotspot data
- Geographic hierarchy navigation endpoints
- Backend processes raw CSV → cleaned data → transformer model → predictions

## Minimal Viable Display

For initial implementation:
- Interactive map with Census Tract level detail (primary geographic unit from data)
- Hotspot markers (affordable/unaffordable filter) with directional trend indicators
- Click hotspot → Two separate trend charts (historical and predicted)
- Current affordability score
- Directional trend display (Improving/Declining/Stable)
- Basic filter controls
- Historical data: 2019-2023 (from raw CSV)
- Current data: 2024 (from raw CSV)
- Predicted data: 2025+ (from transformer model)

## Future Enhancements
- Multiple year predictions (5, 10 years)
- Displacement risk integration
- More detailed metric breakdowns
- Export/share functionality
- Comparison between areas

