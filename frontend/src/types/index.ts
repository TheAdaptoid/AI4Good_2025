// Backend API Types (matching backend/schemas.py)
export interface PrincipalComponent {
  name: string;
  description: string;
  influence: 'positive' | 'negative';
  score: number;
}

export interface HAIScores {
  // Backend field names (matching backend/schemas.py)
  linear_hai: number;
  forest_hai: number;
  nn_hai: number;
  average_hai: number;
}

export interface HAIRequest {
  zipcode: number;
}

export interface HAIResponse {
  scores: HAIScores;
  key_components: PrincipalComponent[];
}

export interface Region {
  zipcode: number;
  scores: HAIScores;
}

export interface SimilarityRequest {
  zipcode: number;
  n_regions?: number;
}

export interface SimilarityResponse {
  similar_regions: Region[];
}

// Frontend UI Types (for display components)
export interface HorizonScore {
  // Geographic information
  address: string;
  zipCode: string;
  censusTract: string;
  latitude: number;
  longitude: number;
  
  // Score information
  score: number; // Horizon Score (range determined by model)
  scoreCategory: 'excellent' | 'good' | 'fair' | 'moderate' | 'poor' | 'critical' | 'not available'; // Category label
  scoreDate: string; // When score was calculated
  scoreRange: { min: number; max: number }; // Full range of possible scores
  
  // Backend model scores (from HAI backend)
  backendScores: {
    pca_score: number;    // PCA model score (0-1)
    lin_score: number;     // Linear model score (0-1)
    ann_score: number;     // ANN model score (0-1)
    avg_score: number;     // Average of all models (0-1)
    hntEquivalent?: number; // Raw HNT equivalent index from API (before scaling)
  };
  
  // Score components (displayed under score, positive first, then negative)
  positiveFactors: ScoreFactor[];
  negativeFactors: ScoreFactor[];
  
  // Score calculation explanation
  baseScore?: number; // Starting/base score before factors
  totalPositiveImpact: number; // Sum of positive factors
  totalNegativeImpact: number; // Sum of negative factors
  
  // Predictions
  predictedScore: number; // 1 year prediction
  trendDirection: 'improving' | 'declining' | 'stable';
  
  // Displacement risk (if available)
  displacementRisk?: number; // 0-100
  
  // Historical data points
  historical?: {
    year: number;
    affordabilityIndex: number;
    medianIncome?: number;
    avgHousingCost?: number;
  }[];
  
  // Predicted data points (1 year for now)
  predicted?: {
    year: number;
    affordabilityIndex: number;
    probability?: number; // from transformer model
    medianIncome?: number;
    avgHousingCost?: number;
  }[];
}

export interface ScoreFactor {
  name: string;
  description: string;
  impact: number; // Points added/subtracted
  percentage: number; // Percentage of total score impact
  category: string; // e.g., "Income", "Housing Costs", "Transportation"
  value: number | string; // Actual metric value
  threshold?: string; // What's considered good/bad
}

export interface SimilarArea {
  zipCode?: string; // For zip code views
  cityName?: string; // For city views
  countyName?: string; // For county views
  neighborhoodName?: string;
  areaType: 'zip' | 'city' | 'county'; // Type of area being displayed
  score: number;
  scoreDifference: number; // Difference from searched location
  distance: number; // Miles/km from searched location
  keySimilarities: string[]; // What makes it similar
  latitude: number;
  longitude: number;
  // Full score data when expanded
  expandedData?: {
    positiveFactors: ScoreFactor[];
    negativeFactors: ScoreFactor[];
    address: string;
    [key: string]: any;
  };
}


