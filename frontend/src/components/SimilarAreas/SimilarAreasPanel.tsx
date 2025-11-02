import { useEffect, useState } from 'react';
import { SimilarAreasList } from './SimilarAreasList';
import { api } from '../../services/api';
import type { SimilarArea } from '../../types';
import './SimilarAreasPanel.css';

interface SimilarAreasPanelProps {
  currentZipCode?: string;
  currentScore?: number;
  currentViewType?: 'zip' | 'city' | 'county';
  currentViewName?: string | null;
  onAreaSelect: (zipCode: string) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function SimilarAreasPanel({
  currentZipCode,
  currentScore,
  currentViewType = 'zip',
  currentViewName = null,
  onAreaSelect,
  onLoadingChange
}: SimilarAreasPanelProps) {
  const [similarAreas, setSimilarAreas] = useState<SimilarArea[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Need either zip code (for zip view) or view name (for city/county view)
    if (!currentZipCode && !currentViewName) {
      setSimilarAreas([]);
      setIsLoading(false);
      if (onLoadingChange) {
        onLoadingChange(false);
      }
      return;
    }

    // Need score for similarity calculation
    if (!currentScore) {
      // If we have the identifier but no score yet, we're still loading
      setIsLoading(true);
      if (onLoadingChange) {
        onLoadingChange(true);
      }
      return;
    }

    const loadSimilarAreas = async () => {
      setIsLoading(true);
      if (onLoadingChange) {
        onLoadingChange(true);
      }
      try {
        // Store current score for use in expanded view calculations
        (window as any).currentSimilarScore = currentScore;
        
        let areas;
        if (currentViewType === 'city' || currentViewType === 'county') {
          // Fetch similar cities/counties (limit to top 3)
          areas = await api.getSimilarCitiesOrCounties(
            currentViewName || currentZipCode || '',
            currentScore,
            currentViewType,
            3 // Limit to top 3 for faster load times
          );
        } else {
          // Fetch similar zip codes (default, limit to top 3)
          areas = await api.getSimilarAreas(currentZipCode || '', currentScore, 3);
        }
        
        // Pre-fetch full score data for ALL areas BEFORE showing them
        // This ensures expand/collapse is instant and all data is ready
        const preloadedAreas = await Promise.all(
          areas.map(async (area) => {
            try {
              let fullScore: import('../../types').HorizonScore;
              const zipCode = area.zipCode || '';
              
              if (area.areaType === 'city' || area.areaType === 'county') {
                // For cities/counties, use representative zip code's full score
                if (zipCode) {
                  fullScore = await api.getHorizonScoreByZipCode(zipCode);
                  
                  // Store expanded data (available for instant expand)
                  return {
                    ...area,
                    expandedData: {
                      ...fullScore,
                      positiveFactors: fullScore.positiveFactors || [],
                      negativeFactors: fullScore.negativeFactors || [],
                      address: area.areaType === 'city' ? (area.cityName || '') : (area.countyName || '')
                    }
                  };
                }
              } else {
                // For zip codes, fetch full score
                if (zipCode) {
                  fullScore = await api.getHorizonScoreByZipCode(zipCode);
                  
                  // Store expanded data (available for instant expand)
                  return {
                    ...area,
                    expandedData: {
                      ...fullScore,
                      positiveFactors: fullScore.positiveFactors || [],
                      negativeFactors: fullScore.negativeFactors || [],
                      address: fullScore.address || zipCode
                    }
                  };
                }
              }
              
              // Return area as-is if no zip code available
              return area;
            } catch (error) {
              // If pre-loading fails, return area without expandedData
              // It will be fetched on-demand if user expands
              if (import.meta.env.DEV) {
                console.warn('Failed to pre-fetch expanded data for area:', area, error);
              }
              return area;
            }
          })
        );
        
        // Set areas only after ALL data is loaded
        setSimilarAreas(preloadedAreas);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error loading similar areas:', error);
        }
        setSimilarAreas([]);
      } finally {
        // Only set loading to false after ALL data (including expanded data) is loaded
        setIsLoading(false);
        if (onLoadingChange) {
          onLoadingChange(false);
        }
      }
    };

    loadSimilarAreas();
  }, [currentZipCode, currentScore, currentViewType, currentViewName]);

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

