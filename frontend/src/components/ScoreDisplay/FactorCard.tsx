import type { ScoreFactor } from '../../types';
import './FactorCard.css';

interface FactorCardProps {
  factor: ScoreFactor;
  isPositive: boolean;
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
            {impactSign}{factor.impact} points ({factor.percentage}%)
          </div>
        </div>
      </div>
      
      <p className="factor-description">{factor.description}</p>
      
      <div className="factor-details">
        <div className="factor-value">
          <strong>Value:</strong> {typeof factor.value === 'number' 
            ? factor.value.toLocaleString() 
            : factor.value}
        </div>
        {factor.threshold && (
          <div className="factor-threshold">
            <strong>Threshold:</strong> {factor.threshold}
          </div>
        )}
      </div>
      
      {factor.category && (
        <div className="factor-category">
          Category: {factor.category}
        </div>
      )}
    </div>
  );
}

