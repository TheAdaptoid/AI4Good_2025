import { useState } from 'react';
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
  const [expandedZips, setExpandedZips] = useState<Set<string>>(new Set());

  const getAreaKey = (area: SimilarArea): string => {
    if (area.areaType === 'city' && area.cityName) return `city:${area.cityName}`;
    if (area.areaType === 'county' && area.countyName) return `county:${area.countyName}`;
    return `zip:${area.zipCode || 'unknown'}`;
  };

  const toggleExpand = (area: SimilarArea) => {
    const areaKey = getAreaKey(area);
    
    // Data should always be pre-loaded, so expand/collapse is instant
    // If data is missing, it's an error state (shouldn't happen)
    if (!area.expandedData && !isLoading) {
      if (import.meta.env.DEV) {
        console.warn('Attempted to expand area without pre-loaded data:', areaKey);
      }
      return;
    }
    
    if (expandedZips.has(areaKey)) {
      // Collapse - instant since data is already loaded
      const newExpanded = new Set(expandedZips);
      newExpanded.delete(areaKey);
      setExpandedZips(newExpanded);
    } else {
      // Expand - instant since data is pre-loaded
      setExpandedZips(prev => new Set(prev).add(areaKey));
    }
  };

  const getLocationName = (area: SimilarArea): string => {
    if (area.areaType === 'city' && area.cityName) return area.cityName;
    if (area.areaType === 'county' && area.countyName) {
      return area.countyName.includes('County') ? area.countyName : `${area.countyName} County`;
    }
    if (area.zipCode) return area.zipCode;
    if (area.neighborhoodName) return area.neighborhoodName;
    return 'Unknown';
  };

  const getTopPositive = (area: SimilarArea): string[] => {
    if (area.expandedData?.positiveFactors && area.expandedData.positiveFactors.length > 0) {
      return area.expandedData.positiveFactors
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 3)
        .map(f => f.name || f.category);
    }
    // Fallback to keySimilarities for positive-like attributes
    return area.keySimilarities?.slice(0, 3) || [];
  };

  const getTopNegative = (area: SimilarArea): string[] => {
    if (area.expandedData?.negativeFactors && area.expandedData.negativeFactors.length > 0) {
      return area.expandedData.negativeFactors
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 3)
        .map(f => f.name || f.category);
    }
    return [];
  };

  if (isLoading) {
    return (
      <div className="similar-areas-list">
        <div className="loading-container-similar">
          <div className="loading-spinner"></div>
          <div className="loading-message">Loading similar areas...</div>
        </div>
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
        {areas.map((area, index) => {
          const areaKey = getAreaKey(area);
          const isExpanded = expandedZips.has(areaKey);
          // Data should be pre-loaded, no loading state needed
          const locationName = getLocationName(area);
          const topPositive = getTopPositive(area);
          const topNegative = getTopNegative(area);

          return (
            <div
            key={`${areaKey}-${index}`}
            className={`area-item ${(area.areaType === 'zip' && area.zipCode === currentZipCode) ? 'current' : ''} ${isExpanded ? 'expanded' : ''}`}
            >
              {/* Collapsed View - Only shows location name and score */}
              <div 
                className="area-collapsed"
                onClick={() => toggleExpand(area)}
              >
                <div className="area-header">
                  <div className="area-location">
                    <div className="area-zip">{locationName}</div>
                    {area.areaType === 'zip' && area.zipCode && (
                      <div className="area-zip-code">{area.zipCode}</div>
                    )}
                  </div>
                  <div className="area-score">
                    <span className="score-number">{area.score}</span>
                    <span className={`score-diff ${area.scoreDifference >= 0 ? 'positive' : 'negative'}`}>
                      {area.scoreDifference >= 0 ? '+' : ''}{area.scoreDifference.toFixed(0)}
                    </span>
                  </div>
                </div>

                <div 
                  className="area-expand-indicator"
                  style={{ 
                    opacity: area.expandedData ? 1 : 0.5,
                    pointerEvents: area.expandedData ? 'auto' : 'none',
                    cursor: area.expandedData ? 'pointer' : 'not-allowed'
                  }}
                >
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  <span className="expand-text">
                    {isExpanded ? 'Collapse' : (area.expandedData ? 'Expand for details' : 'Loading...')}
                  </span>
                </div>
              </div>

              {/* Expanded View */}
              {isExpanded && area.expandedData && (
                <div className="area-expanded">
                      <div className="area-expanded-section">
                        <div className="area-distance">
                          <span className="distance-icon">📍</span>
                          {area.distance.toFixed(1)} miles away
                        </div>
                        {area.expandedData?.address && (
                          <div className="area-address">{area.expandedData.address}</div>
                        )}
                        {area.areaType === 'zip' && area.zipCode && (
                          <div className="area-zip-code-full">ZIP: {area.zipCode}</div>
                        )}
                      </div>

                      {/* Top Factors Preview */}
                      {(topPositive.length > 0 || topNegative.length > 0) && (
                        <div className="area-expanded-section">
                          <h5>Key Factors</h5>
                          {topPositive.length > 0 && (
                            <div className="factors-preview-section">
                              <span className="factors-label">Top Positive Factors:</span>
                              <div className="factor-tags">
                                {topPositive.map((factor, i) => (
                                  <span key={i} className="factor-tag positive">{factor}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {topNegative.length > 0 && (
                            <div className="factors-preview-section">
                              <span className="factors-label">Top Negative Factors:</span>
                              <div className="factor-tags">
                                {topNegative.map((factor, i) => (
                                  <span key={i} className="factor-tag negative">{factor}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {area.expandedData?.positiveFactors && area.expandedData.positiveFactors.length > 0 && (
                        <div className="area-factors-section">
                          <h5>Positive Factors</h5>
                          <div className="factors-list">
                            {area.expandedData.positiveFactors.map((factor, i) => (
                              <div key={i} className="factor-item positive">
                                <div className="factor-header">
                                  <span className="factor-name">{factor.name}</span>
                                  <span className="factor-impact">+{factor.impact}</span>
                                </div>
                                <div className="factor-description">{factor.description || factor.category}</div>
                                {factor.value && (
                                  <div className="factor-value">Value: {factor.value}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {area.expandedData?.negativeFactors && area.expandedData.negativeFactors.length > 0 && (
                        <div className="area-factors-section">
                          <h5>Negative Factors</h5>
                          <div className="factors-list">
                            {area.expandedData.negativeFactors.map((factor, i) => (
                              <div key={i} className="factor-item negative">
                                <div className="factor-header">
                                  <span className="factor-name">{factor.name}</span>
                                  <span className="factor-impact">{factor.impact}</span>
                                </div>
                                <div className="factor-description">{factor.description || factor.category}</div>
                                {factor.value && (
                                  <div className="factor-value">Value: {factor.value}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {area.keySimilarities && area.keySimilarities.length > 0 && (
                        <div className="area-similarities">
                          <strong>Similar in:</strong>
                          <div className="similarity-tags">
                            {area.keySimilarities.map((similarity, i) => (
                              <span key={i} className="similarity-tag">{similarity}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="area-actions">
                        <button 
                          className="area-select-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // For city/county views, pass the name; for zip views, pass the zip code
                            if (area.areaType === 'city' && area.cityName) {
                              onAreaClick(area.cityName);
                            } else if (area.areaType === 'county' && area.countyName) {
                              onAreaClick(area.countyName);
                            } else if (area.zipCode) {
                              onAreaClick(area.zipCode);
                            }
                          }}
                        >
                          View Details
                        </button>
                      </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

