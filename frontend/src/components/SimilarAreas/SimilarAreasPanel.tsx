import { useEffect, useState } from 'react';
import { SimilarAreasList } from './SimilarAreasList';
import { api } from '../../services/api';
import type { SimilarArea } from '../../types';
import './SimilarAreasPanel.css';

interface SimilarAreasPanelProps {
  currentZipCode?: string;
  currentScore?: number;
  onAreaSelect: (zipCode: string) => void;
}

export function SimilarAreasPanel({
  currentZipCode,
  currentScore,
  onAreaSelect
}: SimilarAreasPanelProps) {
  const [similarAreas, setSimilarAreas] = useState<SimilarArea[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentZipCode || !currentScore) {
      setSimilarAreas([]);
      return;
    }

    const loadSimilarAreas = async () => {
      setIsLoading(true);
      try {
        const areas = await api.getSimilarAreas(currentZipCode, currentScore);
        setSimilarAreas(areas);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error loading similar areas:', error);
        }
        setSimilarAreas([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSimilarAreas();
  }, [currentZipCode, currentScore]);

  return (
    <div className="similar-areas-panel">
      <SimilarAreasList
        areas={similarAreas}
        currentZipCode={currentZipCode}
        onAreaClick={onAreaSelect}
        isLoading={isLoading}
      />
    </div>
  );
}

