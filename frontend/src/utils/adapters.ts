import type { HAIResponse, PrincipalComponent, SimilarityResponse, Region } from '../types';
import type { HorizonScore, ScoreFactor, SimilarArea } from '../types';

/**
 * Converts a normalized HAI score (0-1, where lower is better) to a score category
 * Since lower HAI scores are better, we invert the logic:
 * - Lower HAI (0-0.15) = Excellent (Horizon Score 850-1000)
 * - Lower HAI (0.15-0.3) = Good (Horizon Score 700-850)
 * - Medium HAI (0.3-0.45) = Fair (Horizon Score 550-700)
 * - Medium HAI (0.45-0.6) = Moderate (Horizon Score 400-550)
 * - Higher HAI (0.6-0.75) = Poor (Horizon Score 250-400)
 * - Higher HAI (0.75-1.0) = Critical (Horizon Score 0-250)
 * - HAI -1 = Not Available (no score)
 */
function getScoreCategory(normalizedHAIScore: number | null): 'excellent' | 'good' | 'fair' | 'moderate' | 'poor' | 'critical' | 'not available' {
  // Handle -1 (no data available)
  if (normalizedHAIScore === null || normalizedHAIScore < 0) {
    return 'not available';
  }
  
  // Since lower HAI is better, we check the inverted score
  const invertedScore = 1 - normalizedHAIScore;
  
  // Six categories based on inverted score (higher inverted = better)
  if (invertedScore >= 0.85) return 'excellent';   // HAI 0-15 (best) - Horizon Score 850-1000
  if (invertedScore >= 0.7) return 'good';         // HAI 15-30 - Horizon Score 700-850
  if (invertedScore >= 0.55) return 'fair';        // HAI 30-45 - Horizon Score 550-700
  if (invertedScore >= 0.4) return 'moderate';      // HAI 45-60 - Horizon Score 400-550
  if (invertedScore >= 0.25) return 'poor';        // HAI 60-75 - Horizon Score 250-400
  return 'critical';                                // HAI 75-100 (worst) - Horizon Score 0-250
}

/**
 * Normalize backend HAI score to 0-1 range
 * Backend returns scores in raw scale (typically ~0-100), normalize to 0-1
 * Returns null if score is -1 (data not available)
 */
function normalizeHAIScore(backendScore: number, min: number = 0, max: number = 100): number | null {
  // Handle -1 (no data available)
  if (backendScore === -1) {
    return null;
  }
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
 * Returns -1 if normalized score is null (data not available)
 */
function scaleToHorizonScore(normalizedHAIScore: number | null): number {
  // Handle null (data not available) - return -1 to indicate no score
  if (normalizedHAIScore === null) {
    return -1;
  }
  // Invert: lower HAI is better, so we flip the scale
  const invertedScore = 1 - normalizedHAIScore;
  return Math.round(invertedScore * 1000);
}

/**
 * Converts PrincipalComponent to ScoreFactor for UI display
 * Uses actual component score values to create meaningful factors
 */
function principalComponentToScoreFactor(
  component: PrincipalComponent, 
  totalComponentWeight: number
): ScoreFactor {
  const absScore = Math.abs(component.score);
  
  // These are partial outputs from a linear regression model
  // linear_hai = bias + sum(component_i)
  // Each component.score is a partial output that contributes to linear_hai
  // To show impact in Horizon Score scale (0-1000), we need to:
  // 1. Calculate what portion of linear_hai (minus bias) this component represents
  // 2. Convert that proportion to Horizon Score scale
  
  // Calculate percentage of total impact (for display)
  const percentage = totalComponentWeight > 0 
    ? (absScore / totalComponentWeight) * 100 
    : 0;
  
  // These are partial outputs from linear regression: linear_hai = bias + sum(component_i)
  // Each component.score is the direct contribution to linear_hai
  // The sum of all component scores (plus bias) equals linear_hai
  // To convert to Horizon Score scale, we need to:
  // 1. Treat component.score as a contribution to HAI (0-100 scale)
  // 2. Scale it proportionally to Horizon Score (0-1000 scale)
  // 3. Invert sign (since lower HAI = higher Horizon Score)
  
  // Component score represents contribution to HAI
  // Scale directly: if component contributes absScore to HAI, scale to Horizon Score
  // The component scores should sum (with bias) to equal linear_hai
  // So we scale each component proportionally: (absScore / 100) * 1000
  
  // However, component scores might not be in 0-100 range - they're raw partial outputs
  // So we scale based on their magnitude relative to a typical range
  // Using totalComponentWeight gives us an idea of the total contribution range
  
  // Scale component impact to Horizon Score
  // Normalize component score assuming it's in HAI-like units
  // Then scale to 0-1000 Horizon Score range
  const normalizedComponent = absScore / 100; // Normalize (assume 0-100 HAI range)
  const horizonImpact = normalizedComponent * 1000; // Scale to Horizon Score (0-1000)
  
  // Invert sign based on influence
  // Positive influence: component.score reduces HAI -> increases Horizon Score (positive impact)
  // Negative influence: component.score increases HAI -> decreases Horizon Score (negative impact)
  const impact = component.influence === 'positive'
    ? Math.round(horizonImpact) // Positive contribution to Horizon Score
    : -Math.round(horizonImpact); // Negative contribution to Horizon Score
  
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
  
  // Normalize all scores to 0-1 range (may return null if score is -1)
  const normalizedForest = normalizeHAIScore(scores.forest_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
  const normalizedLinear = normalizeHAIScore(scores.linear_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
  const normalizedNN = normalizeHAIScore(scores.nn_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
  const normalizedAverage = normalizeHAIScore(scores.average_hai, HAI_SCORE_MIN, HAI_SCORE_MAX);
  
  // Use average_hai as the primary Horizon score
  const primaryScore = normalizedAverage;
  
  // Check if data is available (if average_hai is -1, all scores are likely -1)
  const isDataAvailable = normalizedAverage !== null;
  
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
  
  // First, calculate raw impacts for all components
  const rawFactors: Array<{ factor: ScoreFactor; component: PrincipalComponent }> = [];
  sortedComponents.forEach(component => {
    const factor = principalComponentToScoreFactor(component, totalComponentWeight);
    rawFactors.push({ factor, component });
  });
  
  // Calculate raw total impact (sum of absolute values)
  const rawTotalImpact = rawFactors.reduce((sum, rf) => sum + Math.abs(rf.factor.impact), 0);
  
  // Get the final score to use as a cap
  const finalScore = scaleToHorizonScore(primaryScore);
  
  // Scale impacts proportionally if total exceeds final score
  // This ensures the sum of displayed impacts doesn't exceed the final score
  // Handle case where finalScore is -1 (not available) - don't scale in that case
  const scaleFactor = finalScore > 0 && rawTotalImpact > 0 && rawTotalImpact > finalScore 
    ? finalScore / rawTotalImpact 
    : 1.0;
  
  // Apply scaling and separate into positive/negative factors
  positiveFactors.length = 0;
  negativeFactors.length = 0;
  
  rawFactors.forEach(({ factor, component }) => {
    // Scale the impact proportionally
    const scaledImpact = Math.round(factor.impact * scaleFactor);
    const scaledFactor: ScoreFactor = {
      ...factor,
      impact: scaledImpact
    };
    
    if (component.influence === 'positive') {
      positiveFactors.push(scaledFactor);
    } else {
      negativeFactors.push(scaledFactor);
    }
  });
  
  // Calculate totals based on scaled component contributions
  const totalPositiveImpact = positiveFactors.reduce((sum, f) => sum + Math.max(0, f.impact), 0);
  const totalNegativeImpact = negativeFactors.reduce((sum, f) => sum + Math.min(0, f.impact), 0);
  
  // Calculate base score from forest_hai (random forest model - used as foundational model)
  const baseScore = scaleToHorizonScore(normalizedForest);
  
  // Determine trend (simple heuristic: compare model scores)
  // Only calculate trend if all scores are available
  let trendDirection: 'improving' | 'declining' | 'stable';
  if (!isDataAvailable || normalizedForest === null || normalizedLinear === null || normalizedNN === null) {
    trendDirection = 'stable'; // Default when data unavailable
  } else {
    const scoreVariance = Math.max(normalizedForest, normalizedLinear, normalizedNN) - 
                          Math.min(normalizedForest, normalizedLinear, normalizedNN);
    if (scoreVariance < 0.05) {
      trendDirection = 'stable';
    } else if (normalizedNN > normalizedForest) {
      trendDirection = 'improving';
    } else {
      trendDirection = 'declining';
    }
  }
  
  // Create historical data (using model scores as historical points)
  const historical = isDataAvailable && normalizedForest !== null && normalizedLinear !== null && normalizedAverage !== null
    ? [
        { year: new Date().getFullYear() - 2, affordabilityIndex: normalizedForest },
        { year: new Date().getFullYear() - 1, affordabilityIndex: normalizedLinear },
        { year: new Date().getFullYear(), affordabilityIndex: normalizedAverage }
      ]
    : [];
  
  // Predicted data (using ANN as prediction)
  const predicted = isDataAvailable && normalizedNN !== null
    ? [
        { 
          year: new Date().getFullYear() + 1, 
          affordabilityIndex: normalizedNN,
          probability: 0.85 // Default probability
        }
      ]
    : [];
  
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
    // Use 0 as placeholder for null values (will be displayed as N/A)
    backendScores: {
      pca_score: normalizedForest ?? 0,      // Map forest_hai to pca_score for display
      lin_score: normalizedLinear ?? 0,       // Map linear_hai to lin_score for display
      ann_score: normalizedNN ?? 0,           // Map nn_hai to ann_score for display
      avg_score: normalizedAverage ?? 0       // Map average_hai to avg_score for display
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
    // Only compare if all scores are available
    const keySimilarities: string[] = [];
    if (normalizedForest !== null && normalizedAverage !== null && 
        Math.abs(normalizedForest - normalizedAverage) < 0.1) {
      keySimilarities.push('Forest Model Similarity');
    }
    if (normalizedLinear !== null && normalizedAverage !== null && 
        Math.abs(normalizedLinear - normalizedAverage) < 0.1) {
      keySimilarities.push('Linear Model Similarity');
    }
    if (normalizedNN !== null && normalizedAverage !== null && 
        Math.abs(normalizedNN - normalizedAverage) < 0.1) {
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

