import type { HAIResponse, PrincipalComponent, SimilarityResponse, Region } from '../types';
import type { HorizonScore, ScoreFactor, SimilarArea } from '../types';

/**
 * Converts a normalized HAI score (0-1, where lower is better) to a score category
 * Since lower HAI scores are better, we invert the logic:
 * - Lower HAI (0-0.3) = Good (Horizon Score 700-1000)
 * - Medium HAI (0.3-0.6) = Fair (Horizon Score 400-700)
 * - Higher HAI (0.6-1.0) = Bad (Horizon Score 0-400)
 */
function getScoreCategory(normalizedHAIScore: number): 'good' | 'fair' | 'bad' {
  // Since lower HAI is better, we check the inverted score
  const invertedScore = 1 - normalizedHAIScore;
  
  // Categories based on inverted score (higher inverted = better)
  if (invertedScore >= 0.7) return 'good';   // HAI 0-30 (best)
  if (invertedScore >= 0.4) return 'fair';   // HAI 30-60 (ideal around 30)
  return 'bad';                                // HAI 60-100 (worst)
}

/**
 * Normalize backend HAI score to 0-1 range
 * Backend returns scores in raw scale (typically ~0-100), normalize to 0-1
 */
function normalizeHAIScore(backendScore: number, min: number = 0, max: number = 100): number {
  if (max === min) return 0.5; // Avoid division by zero
  const normalized = (backendScore - min) / (max - min);
  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Convert normalized HAI score (0-1, where lower is better) to Horizon score (0-1000, where higher is better)
 * Inverts the scale so that:
 * - HAI 0 (best) → Horizon Score 1000
 * - HAI 30 (ideal) → Horizon Score 700
 * - HAI 100 (worst) → Horizon Score 0
 */
function scaleToHorizonScore(normalizedHAIScore: number): number {
  // Invert: lower HAI is better, so we flip the scale
  const invertedScore = 1 - normalizedHAIScore;
  return Math.round(invertedScore * 1000);
}

/**
 * Converts PrincipalComponent to ScoreFactor for UI display
 * Uses actual component score values to create meaningful factors
 */
function principalComponentToScoreFactor(component: PrincipalComponent, totalComponentWeight: number): ScoreFactor {
  const absScore = Math.abs(component.score);
  
  // Calculate impact in Horizon score scale (0-1000)
  // Component score is typically -1 to 1, so we scale it appropriately
  const impact = component.influence === 'positive' 
    ? scaleToHorizonScore(absScore * 0.1) // Positive component adds up to 100 points
    : -scaleToHorizonScore(absScore * 0.1); // Negative component subtracts up to 100 points
  
  // Calculate percentage of total impact
  const percentage = totalComponentWeight > 0 
    ? (absScore / totalComponentWeight) * 100 
    : 0;
  
  // Determine category based on component name
  let category = 'Model Component';
  let description = `Principal component ${component.name}`;
  
  // Map common PC names to meaningful categories
  if (component.name.toLowerCase().includes('income') || component.name.toLowerCase().includes('pc1')) {
    category = 'Economic Factors';
    description = `Income and economic indicators (${component.name})`;
  } else if (component.name.toLowerCase().includes('housing') || component.name.toLowerCase().includes('pc2')) {
    category = 'Housing Costs';
    description = `Housing cost factors (${component.name})`;
  } else if (component.name.toLowerCase().includes('transport') || component.name.toLowerCase().includes('pc3')) {
    category = 'Transportation';
    description = `Transportation accessibility (${component.name})`;
  } else if (component.name.toLowerCase().includes('demographic') || component.name.toLowerCase().includes('pc4')) {
    category = 'Demographics';
    description = `Demographic characteristics (${component.name})`;
  } else if (component.name.toLowerCase().includes('pc5')) {
    category = 'Regional Factors';
    description = `Regional and local factors (${component.name})`;
  }
  
  return {
    name: component.name,
    description: `${description} with ${component.influence} influence on affordability`,
    impact,
    percentage: Math.round(percentage),
    category,
    value: component.score.toFixed(3),
    threshold: component.influence === 'positive' 
      ? 'Higher values indicate better affordability' 
      : 'Higher values indicate affordability challenges'
  };
}

/**
 * Transforms HAIResponse from backend to HorizonScore for frontend UI
 * 
 * @param haiResponse Backend HAI response
 * @param geoInfo Geographic information from geocoding (optional, will use defaults if not provided)
 */
export function transformHAIToHorizonScore(
  haiResponse: HAIResponse,
  geoInfo?: {
    address?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  }
): HorizonScore {
  const { scores, key_components } = haiResponse;
  
  // Backend returns scores in raw scale (typically ~0-100), normalize to 0-1
  // Assuming HAI scores are typically in 0-100 range, adjust if needed
  const HAI_SCORE_MIN = 0;
  const HAI_SCORE_MAX = 100;
  
  // Normalize all scores to 0-1 range
  const normalizedForest = normalizeHAIScore(scores.forest_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
  const normalizedLinear = normalizeHAIScore(scores.linear_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
  const normalizedNN = normalizeHAIScore(scores.nn_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
  const normalizedAverage = normalizeHAIScore(scores.average_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
  
  // Use average_hai as the primary Horizon score
  const primaryScore = normalizedAverage;
  
  // Determine score range (normalized to 0-1 scale)
  const scoreMin = 0;
  const scoreMax = 1;
  
  // Calculate total weight for principal components (for percentage calculation)
  const totalComponentWeight = key_components.reduce(
    (sum, comp) => sum + Math.abs(comp.score), 
    0
  );
  
  // Convert principal components to factors with proper weighting
  const positiveFactors: ScoreFactor[] = [];
  const negativeFactors: ScoreFactor[] = [];
  
  // Sort components by absolute score (most influential first)
  const sortedComponents = [...key_components].sort((a, b) => 
    Math.abs(b.score) - Math.abs(a.score)
  );
  
  sortedComponents.forEach(component => {
    const factor = principalComponentToScoreFactor(component, totalComponentWeight);
    if (component.influence === 'positive') {
      positiveFactors.push(factor);
    } else {
      negativeFactors.push(factor);
    }
  });
  
  // Calculate totals based on actual component contributions
  const totalPositiveImpact = positiveFactors.reduce((sum, f) => sum + Math.max(0, f.impact), 0);
  const totalNegativeImpact = negativeFactors.reduce((sum, f) => sum + Math.min(0, f.impact), 0);
  
  // Calculate base score from forest_hai (random forest model - used as foundational model)
  const baseScore = scaleToHorizonScore(normalizedForest);
  
  // Determine trend (simple heuristic: compare model scores)
  const scoreVariance = Math.max(normalizedForest, normalizedLinear, normalizedNN) - 
                        Math.min(normalizedForest, normalizedLinear, normalizedNN);
  let trendDirection: 'improving' | 'declining' | 'stable';
  if (scoreVariance < 0.05) {
    trendDirection = 'stable';
  } else if (normalizedNN > normalizedForest) {
    trendDirection = 'improving';
  } else {
    trendDirection = 'declining';
  }
  
  // Create historical data (using model scores as historical points)
  const historical = [
    { year: new Date().getFullYear() - 2, affordabilityIndex: normalizedForest },
    { year: new Date().getFullYear() - 1, affordabilityIndex: normalizedLinear },
    { year: new Date().getFullYear(), affordabilityIndex: normalizedAverage }
  ];
  
  // Predicted data (using ANN as prediction)
  const predicted = [
    { 
      year: new Date().getFullYear() + 1, 
      affordabilityIndex: normalizedNN,
      probability: 0.85 // Default probability
    }
  ];
  
  // Build HorizonScore with backend data
  const horizonScore: HorizonScore = {
    // Geographic information
    address: geoInfo?.address || 'Address not available',
    zipCode: geoInfo?.zipCode || 'N/A',
    censusTract: 'N/A', // Not provided by backend
    latitude: geoInfo?.latitude || 0,
    longitude: geoInfo?.longitude || 0,
    
    // Score information - using avg_score as primary Horizon Score
    score: scaleToHorizonScore(primaryScore), // Convert 0-1 to 0-1000 scale for display
    scoreCategory: getScoreCategory(primaryScore),
    scoreDate: new Date().toISOString(),
    scoreRange: { min: scoreMin * 1000, max: scoreMax * 1000 },
    
    // Backend model scores (preserved from HAI response, normalized to 0-1)
    // Map backend field names to frontend display names for consistency
    backendScores: {
      pca_score: normalizedForest,      // Map forest_hai to pca_score for display
      lin_score: normalizedLinear,       // Map linear_hai to lin_score for display
      ann_score: normalizedNN,           // Map nn_hai to ann_score for display
      avg_score: normalizedAverage       // Map average_hai to avg_score for display
    },
    
    // Score components (from principal components)
    positiveFactors,
    negativeFactors,
    
    // Score calculation
    baseScore: baseScore, // PCA score as base
    totalPositiveImpact: Math.round(totalPositiveImpact),
    totalNegativeImpact: Math.round(totalNegativeImpact),
    
    // Predictions (ANN model represents future prediction)
    predictedScore: scaleToHorizonScore(normalizedNN),
    trendDirection,
    
    // Historical and predicted data
    historical,
    predicted,
    
    // Optional fields (not provided by backend yet)
    displacementRisk: undefined
  };
  
  return horizonScore;
}

/**
 * Transforms SimilarityResponse from backend to SimilarArea[] for frontend UI
 * 
 * @param similarityResponse Backend similarity response
 * @param currentZipCode Current zip code for comparison
 * @param currentScore Current score for comparison
 */
export function transformSimilarityToSimilarAreas(
  similarityResponse: SimilarityResponse,
  _currentZipCode: string,
  currentScore: number
): SimilarArea[] {
  const HAI_SCORE_MIN = 0;
  const HAI_SCORE_MAX = 100;
  
  return similarityResponse.similar_regions.map((region: Region, index: number) => {
    // Normalize backend scores to 0-1
    const normalizedForest = normalizeHAIScore(region.scores.forest_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
    const normalizedLinear = normalizeHAIScore(region.scores.linear_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
    const normalizedNN = normalizeHAIScore(region.scores.nn_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
    const normalizedAverage = normalizeHAIScore(region.scores.average_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
    
    const regionScore = scaleToHorizonScore(normalizedAverage); // Use inverted scaling (lower HAI = higher Horizon Score)
    const scoreDifference = regionScore - currentScore;
    
    // Calculate distance (mock for now - would need actual coordinates)
    const distance = 2 + (index * 1.5);
    
    // Generate key similarities based on score components
    const keySimilarities: string[] = [];
    if (Math.abs(normalizedForest - normalizedAverage) < 0.1) {
      keySimilarities.push('Forest Model Similarity');
    }
    if (Math.abs(normalizedLinear - normalizedAverage) < 0.1) {
      keySimilarities.push('Linear Model Similarity');
    }
    if (Math.abs(normalizedNN - normalizedAverage) < 0.1) {
      keySimilarities.push('ANN Model Similarity');
    }
    if (keySimilarities.length === 0) {
      keySimilarities.push('Overall Score Similarity');
    }
    
    return {
      areaType: 'zip',
      zipCode: region.zipcode.toString(),
      score: regionScore,
      scoreDifference,
      distance: parseFloat(distance.toFixed(1)),
      keySimilarities,
      latitude: 0, // Would need actual coordinates
      longitude: 0 // Would need actual coordinates
    };
  });
}

