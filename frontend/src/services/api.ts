import axios from 'axios';
import type { HorizonScore, SimilarArea, HAIRequest, HAIResponse, SimilarityRequest, SimilarityResponse } from '../types';
import { transformHAIToHorizonScore, transformSimilarityToSimilarAreas } from '../utils/adapters';

// Backend API base URL (FastAPI runs on port 8000)
// In development, uses proxy through /api (configured in vite.config.ts)
// In production, can be set via VITE_API_URL environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Convert zip code string to number (handles 5-digit and 9-digit zip codes)
 */
function zipCodeToNumber(zipCode: string): number {
  // Remove any dashes and take first 5 digits
  const cleaned = zipCode.replace(/-/g, '').substring(0, 5);
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid zip code: ${zipCode}`);
  }
  return num;
}

export const api = {
  /**
   * Get HAI score by zip code from backend
   * Note: Backend currently only supports zip code lookup
   */
  async getHorizonScoreByAddress(address: string): Promise<HorizonScore> {
    // Backend doesn't support address lookup yet, try to extract zip code from address
    // For now, return mock data - can be enhanced later
    if (import.meta.env.DEV) {
      console.warn('Address lookup not yet supported by backend, using mock data');
    }
    return getMockHorizonScore(address);
  },

  /**
   * Get HAI score by zip code from backend
   * @param zipCode Zip code as string (e.g., "32201")
   * @param geoInfo Optional geographic information to enhance the response
   */
  async getHorizonScoreByZipCode(
    zipCode: string,
    geoInfo?: { latitude?: number; longitude?: number; address?: string }
  ): Promise<HorizonScore> {
    try {
      const zipcodeNumber = zipCodeToNumber(zipCode);
      
      const request: HAIRequest = { zipcode: zipcodeNumber };
      
      const response = await axios.post<HAIResponse>(`${API_BASE_URL}/score`, request, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Transform backend response to frontend format
      // Merge zipCode with optional geoInfo
      return transformHAIToHorizonScore(response.data, { 
        zipCode, 
        ...geoInfo 
      });
    } catch (error) {
      // Backend not available - return mock data for development
      if (import.meta.env.DEV) {
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
            console.warn('Backend not available, using mock data');
          } else {
            console.warn('API error (using mock data):', error.message);
          }
        }
      }
      return getMockHorizonScore(geoInfo?.address, zipCode);
    }
  },

  /**
   * Get similar regions from backend
   */
  async getSimilarAreas(zipCode: string, score: number, limit: number = 10): Promise<SimilarArea[]> {
    try {
      const zipcodeNumber = zipCodeToNumber(zipCode);
      
      const request: SimilarityRequest = { 
        zipcode: zipcodeNumber,
        n_regions: limit 
      };
      
      const response = await axios.post<SimilarityResponse>(`${API_BASE_URL}/similar`, request, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Transform backend response to frontend format
      return transformSimilarityToSimilarAreas(response.data, zipCode, score);
    } catch (error) {
      // Backend not available - return mock similar areas for development
      if (import.meta.env.DEV) {
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
            console.warn('Backend not available, using mock data for similar areas');
          } else {
            console.warn('API error (using mock data):', error.message);
          }
        }
      }
      return getMockSimilarAreas(zipCode, score, limit);
    }
  }
};

// Mock data for development/testing
function getMockHorizonScore(address?: string, zipCode?: string): HorizonScore {
  const mockZip = zipCode || '32201';
  const mockAddress = address || `Sample Address, Jacksonville, FL ${mockZip}`;
  
  // Mock backend scores (0-1 scale)
  const mockPcaScore = 0.72;
  const mockLinScore = 0.68;
  const mockAnnScore = 0.74;
  const mockAvgScore = (mockPcaScore + mockLinScore + mockAnnScore) / 3;
  
  return {
    address: mockAddress,
    zipCode: mockZip,
    censusTract: '12031014421',
    latitude: 30.3322,
    longitude: -81.6557,
    score: Math.round(mockAvgScore * 1000), // Horizon score (0-1000)
    scoreCategory: 'good',
    scoreDate: new Date().toISOString(),
    scoreRange: { min: 0, max: 1000 },
    // Backend model scores
    backendScores: {
      pca_score: mockPcaScore,
      lin_score: mockLinScore,
      ann_score: mockAnnScore,
      avg_score: mockAvgScore
    },
    positiveFactors: [
      {
        name: 'PC1',
        description: 'Principal component PC1 with positive influence on affordability',
        impact: 80,
        percentage: 35,
        category: 'Economic Factors',
        value: '0.800',
        threshold: 'Higher values indicate better affordability'
      },
      {
        name: 'PC2',
        description: 'Principal component PC2 with positive influence',
        impact: 45,
        percentage: 18,
        category: 'Housing Costs',
        value: '0.450',
        threshold: 'Higher values indicate better affordability'
      }
    ],
    negativeFactors: [
      {
        name: 'PC3',
        description: 'Principal component PC3 with negative influence on affordability',
        impact: -25,
        percentage: 10,
        category: 'Transportation',
        value: '-0.250',
        threshold: 'Higher values indicate affordability challenges'
      }
    ],
    baseScore: Math.round(mockPcaScore * 1000),
    totalPositiveImpact: 125,
    totalNegativeImpact: -25,
    predictedScore: Math.round(mockAnnScore * 1000),
    trendDirection: 'improving',
    displacementRisk: 35,
    historical: [
      { year: new Date().getFullYear() - 2, affordabilityIndex: mockPcaScore },
      { year: new Date().getFullYear() - 1, affordabilityIndex: mockLinScore },
      { year: new Date().getFullYear(), affordabilityIndex: mockAvgScore }
    ],
    predicted: [
      { year: new Date().getFullYear() + 1, affordabilityIndex: mockAnnScore, probability: 0.85 }
    ]
  };
}


// Mock similar areas for development/testing
function getMockSimilarAreas(zipCode: string, score: number, limit: number): SimilarArea[] {
  const mockZips = ['32256', '32207', '32204', '32216', '32217', '32223', '32224', '32225', '32246', '32257'];
  
  return mockZips
    .filter(zip => zip !== zipCode)
    .slice(0, limit)
    .map((zip, index) => {
      const scoreDiff = (Math.random() * 40) - 20;
      const similarScore = Math.round(score + scoreDiff);
      const distance = 2 + (index * 1.5) + (Math.random() * 3);
      
      const similarityCategories = ['Income Level', 'Housing Costs', 'Rent Burden', 'Employment', 'Transportation'];
      const keySimilarities = similarityCategories
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
      
      return {
        zipCode: zip,
        neighborhoodName: `Neighborhood ${index + 1}`,
        score: similarScore,
        scoreDifference: Math.round(scoreDiff),
        distance: parseFloat(distance.toFixed(1)),
        keySimilarities,
        latitude: 30.3322 + (Math.random() - 0.5) * 0.3,
        longitude: -81.6557 + (Math.random() - 0.5) * 0.3
      };
    })
    .sort((a, b) => {
      const diffA = Math.abs(a.score - score);
      const diffB = Math.abs(b.score - score);
      if (diffA !== diffB) {
        return diffA - diffB;
      }
      return a.distance - b.distance;
    });
}
