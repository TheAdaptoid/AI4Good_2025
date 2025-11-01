import type { HorizonScore } from '../../types';
import './ComparisonView.css';

interface ComparisonViewProps {
  location1: HorizonScore | null;
  location2: HorizonScore | null;
  currentScore: HorizonScore | null;
  onLocationSelect?: (zipCode: string) => void;
}

export function ComparisonView({
  location1,
  location2,
  currentScore,
  onLocationSelect
}: ComparisonViewProps) {
  if (!location1 && !location2) {
    return null;
  }

  const compareScores = (score1: number, score2: number) => {
    const diff = score1 - score2;
    return {
      diff,
      percentage: ((diff / score1) * 100).toFixed(1),
      better: diff > 0 ? 'location1' : diff < 0 ? 'location2' : 'equal'
    };
  };

  const getFactorComparison = () => {
    if (!location1 || !location2) return [];

    const allFactorNames = new Set([
      ...location1.positiveFactors.map(f => f.name),
      ...location1.negativeFactors.map(f => f.name),
      ...location2.positiveFactors.map(f => f.name),
      ...location2.negativeFactors.map(f => f.name),
    ]);

    return Array.from(allFactorNames).map(name => {
      const factor1 = [...location1.positiveFactors, ...location1.negativeFactors].find(f => f.name === name);
      const factor2 = [...location2.positiveFactors, ...location2.negativeFactors].find(f => f.name === name);
      
      return {
        name,
        location1: factor1 || null,
        location2: factor2 || null,
      };
    });
  };

  return (
    <div className="comparison-view">
      <div className="comparison-header-section">
        <h4>Comparison</h4>
        {location1 && location2 && (
          <div className="score-difference">
            {(() => {
              const comparison = compareScores(location1.score, location2.score);
              return (
                <div className={`difference-badge ${comparison.better}`}>
                  {comparison.diff > 0 ? '+' : ''}{comparison.diff} point difference
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Side-by-Side Score Comparison */}
      <div className="score-comparison-grid">
        <div className="comparison-item">
          <div className="comparison-item-header">Location 1</div>
          {location1 ? (
            <div className="score-details">
              <div className="score-large">{location1.score}</div>
              <div className="score-category">{location1.scoreCategory}</div>
              <div className="score-address">{location1.address}</div>
              <div className="score-zip">{location1.zipCode}</div>
            </div>
          ) : (
            <div className="empty-location">Not set</div>
          )}
        </div>

        <div className="comparison-item">
          <div className="comparison-item-header">Location 2</div>
          {location2 ? (
            <div className="score-details">
              <div className="score-large">{location2.score}</div>
              <div className="score-category">{location2.scoreCategory}</div>
              <div className="score-address">{location2.address}</div>
              <div className="score-zip">{location2.zipCode}</div>
            </div>
          ) : (
            <div className="empty-location">Not set</div>
          )}
        </div>
      </div>

      {/* Factor-by-Factor Comparison */}
      {location1 && location2 && (
        <div className="factor-comparison">
          <h5>Factor Comparison</h5>
          <div className="factor-comparison-table">
            <div className="factor-table-header">
              <div>Factor</div>
              <div>Location 1</div>
              <div>Location 2</div>
              <div>Difference</div>
            </div>
            {getFactorComparison().map((factor, index) => (
              <div key={index} className="factor-table-row">
                <div className="factor-name-cell">{factor.name}</div>
                <div className="factor-value-cell">
                  {factor.location1 ? (
                    <span className={factor.location1.impact > 0 ? 'positive' : 'negative'}>
                      {factor.location1.impact > 0 ? '+' : ''}{factor.location1.impact}
                    </span>
                  ) : (
                    <span className="no-data">—</span>
                  )}
                </div>
                <div className="factor-value-cell">
                  {factor.location2 ? (
                    <span className={factor.location2.impact > 0 ? 'positive' : 'negative'}>
                      {factor.location2.impact > 0 ? '+' : ''}{factor.location2.impact}
                    </span>
                  ) : (
                    <span className="no-data">—</span>
                  )}
                </div>
                <div className="factor-diff-cell">
                  {factor.location1 && factor.location2 ? (
                    <span className={
                      factor.location1.impact > factor.location2.impact ? 'better' :
                      factor.location1.impact < factor.location2.impact ? 'worse' : 'equal'
                    }>
                      {factor.location1.impact > factor.location2.impact ? '+' : ''}
                      {(factor.location1.impact - factor.location2.impact).toFixed(1)}
                    </span>
                  ) : (
                    <span className="no-data">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

