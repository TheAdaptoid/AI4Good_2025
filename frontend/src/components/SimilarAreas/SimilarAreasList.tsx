import type { SimilarArea } from '../../types';
import './SimilarAreasList.css';

interface SimilarAreasListProps {
  areas: SimilarArea[];
  currentZipCode?: string;
  onAreaClick: (zipCode: string) => void;
  isLoading?: boolean;
}

export function SimilarAreasList({ 
  areas, 
  currentZipCode, 
  onAreaClick, 
  isLoading 
}: SimilarAreasListProps) {
  if (isLoading) {
    return (
      <div className="similar-areas-list">
        <div className="loading-message">Loading similar areas...</div>
      </div>
    );
  }

  if (!areas || areas.length === 0) {
    return (
      <div className="similar-areas-list">
        <h4>Similar Areas</h4>
        <div className="empty-message">
          <p>No similar areas found</p>
          <p className="empty-hint">Search for a location to find similar affordable areas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="similar-areas-list">
      <div className="similar-areas-header">
        <h4>Similar Affordable Areas</h4>
        <p className="similar-areas-description">
          Areas with similar Horizon Scores and affordability characteristics
        </p>
      </div>

      <div className="areas-list">
        {areas.map((area, index) => (
          <div
            key={`${area.zipCode}-${index}`}
            className={`area-item ${area.zipCode === currentZipCode ? 'current' : ''}`}
            onClick={() => onAreaClick(area.zipCode)}
          >
            <div className="area-header">
              <div className="area-location">
                <div className="area-zip">{area.zipCode}</div>
                {area.neighborhoodName && (
                  <div className="area-neighborhood">{area.neighborhoodName}</div>
                )}
              </div>
              <div className="area-score">
                <span className="score-number">{area.score}</span>
                <span className={`score-diff ${area.scoreDifference >= 0 ? 'positive' : 'negative'}`}>
                  {area.scoreDifference >= 0 ? '+' : ''}{area.scoreDifference.toFixed(0)}
                </span>
              </div>
            </div>

            <div className="area-details">
              <div className="area-distance">
                <span className="distance-icon">📍</span>
                {area.distance.toFixed(1)} miles away
              </div>
              
              {area.keySimilarities && area.keySimilarities.length > 0 && (
                <div className="area-similarities">
                  <strong>Similar in:</strong>
                  <div className="similarity-tags">
                    {area.keySimilarities.slice(0, 3).map((similarity, i) => (
                      <span key={i} className="similarity-tag">{similarity}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

