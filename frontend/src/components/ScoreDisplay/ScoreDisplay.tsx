import type { HorizonScore } from '../../types';
import { FactorCard } from './FactorCard';
import './ScoreDisplay.css';

interface ScoreDisplayProps {
  score: HorizonScore | null;
  isLoading?: boolean;
  currentViewType?: 'zip' | 'city' | 'county';
  zipCodes?: string[];
}

function getScoreColor(score: number): string {
  // Handle -1 (not available)
  if (score === -1) return '#9e9e9e'; // Gray - Not Available
  
  // Six categories with new color scheme
  // Excellent (850-1000): Purple
  if (score >= 850) return '#9c27b0'; // Purple
  // Good (700-850): Blue
  if (score >= 700) return '#2196F3'; // Blue
  // Fair (550-700): Green
  if (score >= 550) return '#4caf50'; // Green
  // Moderate (400-550): Yellow
  if (score >= 400) return '#ffeb3b'; // Yellow
  // Poor (250-400): Orange
  if (score >= 250) return '#ff9800'; // Orange
  // Critical (0-250): Red
  return '#f44336'; // Red
}

function getCategoryLabel(category: string): string {
  if (category === 'not available') {
    return 'Not Available';
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function ScoreDisplay({ score, isLoading = false, currentViewType = 'zip', zipCodes = [] }: ScoreDisplayProps) {
  if (isLoading) {
    return (
      <div className="score-display-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-message">Loading Horizon Score...</div>
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="score-display-container">
        <div className="empty-message">
          <h2>Horizon Score</h2>
          <p>Search an address or zip code to view the affordability score</p>
        </div>
      </div>
    );
  }

  const scoreColor = getScoreColor(score.score);

  // Check if this is a city/county aggregated score (address doesn't contain zip code)
  const isCityOrCounty = score.address && !score.address.match(/\b\d{5}\b/);
  
  return (
    <div className="score-display-container">
      {/* Large Score Display */}
      <div className="score-header">
        <h1 className="score-label">Horizon Score</h1>
        {isCityOrCounty && (
          <div className="score-subtitle" style={{ fontSize: '0.9em', color: '#666', marginBottom: '0.5em' }}>
            {score.address} - Average Score
          </div>
        )}
        <div 
          className="score-number"
          style={{ color: scoreColor }}
        >
          {score.score === -1 ? 'N/A' : score.score}
        </div>
        <div className="score-category">
          {getCategoryLabel(score.scoreCategory)}
        </div>
        <div className="score-range">
          Range: {score.scoreRange.min} - {score.scoreRange.max}
        </div>
      </div>

      {/* Visual Score Reasoning */}
      <div className="score-reasoning">
        <h3>What is this score?</h3>
        <p className="reasoning-description">
          The Horizon Score is calculated from multiple factors that impact housing affordability.
          Below are the positive and negative factors that contribute to this score.
        </p>
      </div>

      {/* Location Information */}
      <div className="location-info-card">
        <h3>Location Information</h3>
        <div className="location-info-content">
          {currentViewType === 'zip' ? (
            <>
              <p><strong>Address:</strong> {score.address}</p>
              <p><strong>Zip Code:</strong> {score.zipCode}</p>
              {score.displacementRisk !== undefined && (
                <div className="displacement-risk">
                  <strong>Displacement Risk:</strong> {score.displacementRisk}/100
                </div>
              )}
            </>
          ) : currentViewType === 'city' ? (
            <>
              <p><strong>City:</strong> {score.address.replace(/\s*\(\d+\s+zip\s+codes?\)$/i, '')}</p>
              {zipCodes.length > 0 && (
                <div className="zip-codes-list">
                  <strong>Affiliated Zip Codes:</strong> {zipCodes.join(', ')}
                </div>
              )}
            </>
          ) : currentViewType === 'county' ? (
            <>
              <p><strong>County:</strong> {score.address.replace(/\s*\(\d+\s+zip\s+codes?\)$/i, '')}</p>
              {zipCodes.length > 0 && (
                <div className="zip-codes-list">
                  <strong>Affiliated Zip Codes:</strong> {zipCodes.join(', ')}
                </div>
              )}
            </>
          ) : (
            <>
              <p><strong>Address:</strong> {score.address}</p>
              <p><strong>Zip Code:</strong> {score.zipCode}</p>
              {score.displacementRisk !== undefined && (
                <div className="displacement-risk">
                  <strong>Displacement Risk:</strong> {score.displacementRisk}/100
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Positive Factors */}
      {score.positiveFactors && score.positiveFactors.length > 0 && (
        <div className="factors-section positive-factors">
          <h3 className="factors-header">
            <span className="factors-icon">✓</span>
            Positive Factors (Strengths)
          </h3>
          <div className="factors-list">
            {score.positiveFactors.map((factor, index) => (
              <FactorCard key={`positive-${index}`} factor={factor} isPositive={true} />
            ))}
          </div>
        </div>
      )}

      {/* Negative Factors */}
      {score.negativeFactors && score.negativeFactors.length > 0 && (
        <div className="factors-section negative-factors">
          <h3 className="factors-header">
            <span className="factors-icon">⚠</span>
            Negative Factors (Challenges)
          </h3>
          <div className="factors-list">
            {score.negativeFactors.map((factor, index) => (
              <FactorCard key={`negative-${index}`} factor={factor} isPositive={false} />
            ))}
          </div>
        </div>
      )}

      {/* Model Scores Section - Backend Data */}
      <div className="model-scores-section">
        <h3>Model Scores</h3>
        <p className="model-scores-description">
          Individual scores from different machine learning models that contribute to the Horizon Score.
        </p>
        <div className="model-scores-grid">
          <div className="model-score-card">
            <div className="model-score-label">Random Forest Model</div>
            <div className="model-score-value">
              {score.score === -1 ? 'N/A' : Math.round((1 - score.backendScores.pca_score) * 1000)}
            </div>
            <div className="model-score-raw">
              {score.score === -1 ? 'Not Available' : `Normalized: ${score.backendScores.pca_score.toFixed(4)}`}
            </div>
            <div className="model-score-description">Random Forest Regression</div>
          </div>
          
          <div className="model-score-card">
            <div className="model-score-label">Linear Model</div>
            <div className="model-score-value">
              {score.score === -1 ? 'N/A' : Math.round((1 - score.backendScores.lin_score) * 1000)}
            </div>
            <div className="model-score-raw">
              {score.score === -1 ? 'Not Available' : `Normalized: ${score.backendScores.lin_score.toFixed(4)}`}
            </div>
            <div className="model-score-description">Linear Regression</div>
          </div>
          
          <div className="model-score-card">
            <div className="model-score-label">ANN Model</div>
            <div className="model-score-value">
              {score.score === -1 ? 'N/A' : Math.round((1 - score.backendScores.ann_score) * 1000)}
            </div>
            <div className="model-score-raw">
              {score.score === -1 ? 'Not Available' : `Normalized: ${score.backendScores.ann_score.toFixed(4)}`}
            </div>
            <div className="model-score-description">Artificial Neural Network</div>
          </div>
          
          {score.backendScores.hntEquivalent !== undefined && (
            <div className="model-score-card">
              <div className="model-score-label">H+T Equivalent</div>
              <div className="model-score-value">
                {score.backendScores.hntEquivalent === -1 
                  ? 'N/A' 
                  : typeof score.backendScores.hntEquivalent === 'number'
                  ? score.backendScores.hntEquivalent.toFixed(2)
                  : 'N/A'}
              </div>
              <div className="model-score-raw">
                {score.backendScores.hntEquivalent === -1 
                  ? 'Not Available' 
                  : 'Raw value from API (before scaling)'}
              </div>
              <div className="model-score-description">Index we based ours from</div>
            </div>
          )}
          
          <div className="model-score-card highlight">
            <div className="model-score-label">Average Score</div>
            <div className="model-score-value">
              {score.score === -1 ? 'N/A' : score.score}
            </div>
            <div className="model-score-raw">
              {score.score === -1 ? 'Not Available' : `Normalized: ${score.backendScores.avg_score.toFixed(4)}`}
            </div>
            <div className="model-score-description">Horizon Score (Average of all models)</div>
          </div>
        </div>
      </div>
    </div>
  );
}


