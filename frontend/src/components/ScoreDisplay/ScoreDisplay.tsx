import type { HorizonScore } from '../../types';
import { FactorCard } from './FactorCard';
import { TrendChart } from './TrendChart';
import './ScoreDisplay.css';

interface ScoreDisplayProps {
  score: HorizonScore | null;
  isLoading?: boolean;
}

function getScoreColor(score: number, range: { min: number; max: number }): string {
  const percentage = ((score - range.min) / (range.max - range.min)) * 100;
  
  if (percentage >= 75) return '#4caf50'; // Green
  if (percentage >= 50) return '#8bc34a'; // Light Green
  if (percentage >= 25) return '#ff9800'; // Orange
  return '#f44336'; // Red
}

function getCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function ScoreDisplay({ score, isLoading = false }: ScoreDisplayProps) {
  if (isLoading) {
    return (
      <div className="score-display-container">
        <div className="loading-message">Loading Horizon Score...</div>
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

  const scoreColor = getScoreColor(score.score, score.scoreRange);

  return (
    <div className="score-display-container">
      {/* Large Score Display */}
      <div className="score-header">
        <h1 className="score-label">Horizon Score</h1>
        <div 
          className="score-number"
          style={{ color: scoreColor }}
        >
          {score.score}
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
        <h3>Why is this score?</h3>
        <p className="reasoning-description">
          The Horizon Score is calculated from multiple factors that impact housing affordability.
          Below are the positive and negative factors that contribute to this score.
        </p>
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
            <div className="model-score-label">PCA Model</div>
            <div className="model-score-value">
              {Math.round(score.backendScores.pca_score * 1000)}
            </div>
            <div className="model-score-raw">Raw: {score.backendScores.pca_score.toFixed(4)}</div>
            <div className="model-score-description">Principal Component Analysis</div>
          </div>
          
          <div className="model-score-card">
            <div className="model-score-label">Linear Model</div>
            <div className="model-score-value">
              {Math.round(score.backendScores.lin_score * 1000)}
            </div>
            <div className="model-score-raw">Raw: {score.backendScores.lin_score.toFixed(4)}</div>
            <div className="model-score-description">Linear Regression</div>
          </div>
          
          <div className="model-score-card">
            <div className="model-score-label">ANN Model</div>
            <div className="model-score-value">
              {Math.round(score.backendScores.ann_score * 1000)}
            </div>
            <div className="model-score-raw">Raw: {score.backendScores.ann_score.toFixed(4)}</div>
            <div className="model-score-description">Artificial Neural Network</div>
          </div>
          
          <div className="model-score-card highlight">
            <div className="model-score-label">Average Score</div>
            <div className="model-score-value">
              {Math.round(score.backendScores.avg_score * 1000)}
            </div>
            <div className="model-score-raw">Raw: {score.backendScores.avg_score.toFixed(4)}</div>
            <div className="model-score-description">Horizon Score (Average of all models)</div>
          </div>
        </div>
      </div>

      {/* Score Breakdown Summary */}
      <div className="score-breakdown">
        <h3>Score Calculation</h3>
        
        {score.baseScore !== undefined && (
          <div className="breakdown-item">
            <span className="breakdown-label">Base Score (PCA):</span>
            <span className="breakdown-value">{score.baseScore}</span>
          </div>
        )}
        
        {score.totalPositiveImpact > 0 && (
          <div className="breakdown-item positive">
            <span className="breakdown-label">Positive Impact:</span>
            <span className="breakdown-value">+{score.totalPositiveImpact}</span>
          </div>
        )}
        
        {score.totalNegativeImpact < 0 && (
          <div className="breakdown-item negative">
            <span className="breakdown-label">Negative Impact:</span>
            <span className="breakdown-value">{score.totalNegativeImpact}</span>
          </div>
        )}
        
        <div className="breakdown-item final">
          <span className="breakdown-label">Final Horizon Score:</span>
          <span className="breakdown-value">{score.score}</span>
          <span className="breakdown-note">(Average of all models: {Math.round(score.backendScores.avg_score * 1000)})</span>
        </div>
      </div>

      {/* Trend Prediction */}
      <TrendChart score={score} />

      {/* Geographic Info */}
      <div className="geographic-info">
        <h4>Location Information</h4>
        <p><strong>Address:</strong> {score.address}</p>
        <p><strong>Zip Code:</strong> {score.zipCode}</p>
        <p><strong>Census Tract:</strong> {score.censusTract}</p>
        {score.displacementRisk !== undefined && (
          <div className="displacement-risk">
            <strong>Displacement Risk:</strong> {score.displacementRisk}/100
          </div>
        )}
      </div>
    </div>
  );
}


