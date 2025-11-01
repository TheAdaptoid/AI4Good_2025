import type { HAIResponse, PrincipalComponent, SimilarityResponse, Region } from '../types';
import type { HorizonScore, ScoreFactor, SimilarArea } from '../types';

/**
 * Converts a score value (0-1) to a score category
 */
function getScoreCategory(score: number, min: number = 0, max: number = 1): 'excellent' | 'good' | 'fair' | 'poor' {
  const percentage = ((score - min) / (max - min)) * 100;
  
  if (percentage >= 75) return 'excellent';
  if (percentage >= 50) return 'good';
  if (percentage >= 25) return 'fair';
  return 'poor';
}

/**
 * Convert backend score (0-1) to Horizon score (0-1000)
 */
function scaleToHorizonScore(backendScore: number): number {
  return Math.round(backendScore * 1000);
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
  
  // Use avg_score as the primary Horizon score (weighted average of all models)
  const primaryScore = scores.avg_score ?? 
    ((scores.pca_score + scores.lin_score + scores.ann_score) / 3);
  
  // Determine score range (backend uses 0-1 scale)
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
  
  // Calculate base score from PCA (foundational model)
  const baseScore = scaleToHorizonScore(scores.pca_score);
  
  // Determine trend (simple heuristic: compare model scores)
  const scoreVariance = Math.max(scores.pca_score, scores.lin_score, scores.ann_score) - 
                        Math.min(scores.pca_score, scores.lin_score, scores.ann_score);
  let trendDirection: 'improving' | 'declining' | 'stable';
  if (scoreVariance < 0.05) {
    trendDirection = 'stable';
  } else if (scores.ann_score > scores.pca_score) {
    trendDirection = 'improving';
  } else {
    trendDirection = 'declining';
  }
  
  // Create historical data (using model scores as historical points)
  const historical = [
    { year: new Date().getFullYear() - 2, affordabilityIndex: scores.pca_score },
    { year: new Date().getFullYear() - 1, affordabilityIndex: scores.lin_score },
    { year: new Date().getFullYear(), affordabilityIndex: scores.avg_score }
  ];
  
  // Predicted data (using ANN as prediction)
  const predicted = [
    { 
      year: new Date().getFullYear() + 1, 
      affordabilityIndex: scores.ann_score,
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
    scoreCategory: getScoreCategory(primaryScore, scoreMin, scoreMax),
    scoreDate: new Date().toISOString(),
    scoreRange: { min: scoreMin * 1000, max: scoreMax * 1000 },
    
    // Backend model scores (preserved from HAI response)
    backendScores: {
      pca_score: scores.pca_score,
      lin_score: scores.lin_score,
      ann_score: scores.ann_score,
      avg_score: scores.avg_score
    },
    
    // Score components (from principal components)
    positiveFactors,
    negativeFactors,
    
    // Score calculation
    baseScore: baseScore, // PCA score as base
    totalPositiveImpact: Math.round(totalPositiveImpact),
    totalNegativeImpact: Math.round(totalNegativeImpact),
    
    // Predictions (ANN model represents future prediction)
    predictedScore: scaleToHorizonScore(scores.ann_score),
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
  currentZipCode: string,
  currentScore: number
): SimilarArea[] {
  return similarityResponse.similar_regions.map((region: Region, index: number) => {
    const regionScore = Math.round(region.scores.avg_score * 1000);
    const scoreDifference = regionScore - currentScore;
    
    // Calculate distance (mock for now - would need actual coordinates)
    const distance = 2 + (index * 1.5);
    
    // Generate key similarities based on score components
    const keySimilarities: string[] = [];
    if (Math.abs(region.scores.pca_score - region.scores.avg_score) < 0.1) {
      keySimilarities.push('PCA Score Similarity');
    }
    if (Math.abs(region.scores.lin_score - region.scores.avg_score) < 0.1) {
      keySimilarities.push('Linear Model Similarity');
    }
    if (Math.abs(region.scores.ann_score - region.scores.avg_score) < 0.1) {
      keySimilarities.push('ANN Model Similarity');
    }
    if (keySimilarities.length === 0) {
      keySimilarities.push('Overall Score Similarity');
    }
    
    return {
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

