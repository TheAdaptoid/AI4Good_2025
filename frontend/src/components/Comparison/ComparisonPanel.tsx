import { useState, useCallback } from 'react';
import { ComparisonTabs } from './ComparisonTabs';
import { ComparisonView } from './ComparisonView';
import { SimilarAreasPanel } from '../SimilarAreas/SimilarAreasPanel';
import { api } from '../../services/api';
import type { HorizonScore } from '../../types';
import './ComparisonPanel.css';

interface ComparisonPanelProps {
  currentScore: HorizonScore | null;
  onLocationSelect?: (zipCode: string) => void;
  mapsLoaded?: boolean;
}

export function ComparisonPanel({ currentScore, onLocationSelect, mapsLoaded = false }: ComparisonPanelProps) {
  const [location1, setLocation1] = useState<HorizonScore | null>(null);
  const [location2, setLocation2] = useState<HorizonScore | null>(null);
  const [activeTab, setActiveTab] = useState<'location1' | 'location2'>('location1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearchLocation = useCallback(async (query: string, tab: 'location1' | 'location2') => {
    if (!query.trim()) {
      setError('Please enter a zip code or address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use manual search (standard input, no autocomplete)
      let score: HorizonScore;
      const isZip = /^\d{5}(-\d{4})?$/.test(query.trim());
      if (isZip) {
        score = await api.getHorizonScoreByZipCode(query.trim());
      } else {
        score = await api.getHorizonScoreByAddress(query);
      }

      if (tab === 'location1') {
        setLocation1(score);
      } else {
        setLocation2(score);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch location data');
      if (import.meta.env.DEV) {
        console.error('Comparison search error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClearLocation = useCallback((tab: 'location1' | 'location2') => {
    if (tab === 'location1') {
      setLocation1(null);
    } else {
      setLocation2(null);
    }
  }, []);

  const handleCompareClick = useCallback(() => {
    if (location1 && location2) {
      // Comparison view will be shown
      setActiveTab('location1'); // Reset to first tab after comparison
    }
  }, [location1, location2]);

  return (
    <div className="comparison-panel">
      <div className="comparison-header">
        <h3>Compare Scores</h3>
        <p className="comparison-description">
          Compare Horizon Scores between two locations to see how affordability factors differ.
        </p>
      </div>

      <ComparisonTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        location1={location1}
        location2={location2}
        onSearch={handleSearchLocation}
        onClear={handleClearLocation}
        isLoading={isLoading}
        error={error}
        mapsLoaded={mapsLoaded}
      />

      {(location1 || location2) && (
        <ComparisonView
          location1={location1}
          location2={location2}
          currentScore={currentScore}
          onLocationSelect={onLocationSelect}
        />
      )}

      {/* Similar Areas Section */}
      <div className="similar-areas-section">
        <SimilarAreasPanel
          currentZipCode={currentScore?.zipCode}
          currentScore={currentScore?.score}
          onAreaSelect={(zipCode) => {
            if (onLocationSelect) {
              onLocationSelect(zipCode);
            }
          }}
        />
      </div>
    </div>
  );
}

