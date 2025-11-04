import type { ScoreFactor } from '../../types';
import './FactorCard.css';

interface FactorCardProps {
  factor: ScoreFactor;
  isPositive: boolean;
}

function getThresholdText(value: number | string, isPositive: boolean): string {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, ''));
  
  // If value is not a valid number, use a generic message
  if (isNaN(numValue)) {
    return isPositive 
      ? 'Higher values indicate better affordability'
      : 'Higher values indicate affordability challenges';
  }
  
  if (isPositive) {
    // Positive factors (strengths) - contribute positively to affordability
    if (numValue < 0) {
      return 'Negative values show that this metric is helping to drive the cost of housing down';
    } else {
      return 'Positive values show that this metric indicates better affordability conditions';
    }
  } else {
    // Negative factors (challenges) - contribute negatively to affordability
    if (numValue > 0) {
      return 'Positive values show that this metric indicates higher housing costs, contributing to affordability challenges';
    } else {
      return 'Negative values show that this metric indicates lower housing costs, reducing affordability challenges';
    }
  }
}

export function FactorCard({ factor, isPositive }: FactorCardProps) {
  const impactSign = isPositive ? '+' : '';
  const impactColor = isPositive ? '#4caf50' : '#f44336';
  
  return (
    <div className={`factor-card ${isPositive ? 'positive' : 'negative'}`}>
      <div className="factor-header">
        <div className="factor-icon">
          {isPositive ? '✓' : '⚠'}
        </div>
        <div className="factor-info">
          <h4 className="factor-name">{factor.name}</h4>
          <div className="factor-impact" style={{ color: impactColor }}>
            {impactSign}{factor.impact} points
            {/* ({factor.percentage}%) */}
          </div>
        </div>
      </div>
      
      {factor.description && (
        <p className="factor-description">{factor.description}</p>
      )}
      
      <div className="factor-details">
        <div className="factor-value">
          <strong>Value:</strong> {typeof factor.trueValue === 'number' 
            ? factor.trueValue.toLocaleString() 
            : factor.trueValue}
        </div>
        <div className="factor-threshold">
          <strong>Weight:</strong> {(Number(factor.value) / factor.trueValue).toFixed(2)} - {getThresholdText(factor.value, isPositive)}
        </div>
      </div>
    </div>
  );
}

