export interface HorizonScore {
  // Geographic information
  address: string;
  zipCode: string;
  censusTract: string;
  latitude: number;
  longitude: number;
  
  // Score information
  score: number; // Horizon Score (range determined by model)
  scoreCategory: 'excellent' | 'good' | 'fair' | 'poor'; // Category label
  scoreDate: string; // When score was calculated
  scoreRange: { min: number; max: number }; // Full range of possible scores
  
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
  zipCode: string;
  neighborhoodName?: string;
  score: number;
  scoreDifference: number; // Difference from searched location
  distance: number; // Miles/km from searched location
  keySimilarities: string[]; // What makes it similar
  latitude: number;
  longitude: number;
}


