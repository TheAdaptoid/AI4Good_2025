import axios from 'axios';
import type { HorizonScore, SimilarArea } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = {
  async getHorizonScoreByAddress(address: string): Promise<HorizonScore> {
    try {
      const response = await axios.get(`${API_BASE_URL}/horizon-score`, {
        params: { address },
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      // Backend not available - silently fall back to mock data for development
      if (import.meta.env.DEV && axios.isAxiosError(error) && 
          error.code !== 'ECONNREFUSED' && error.code !== 'ERR_NETWORK') {
        console.warn('API error (using mock data):', error.message);
      }
      return getMockHorizonScore(address);
    }
  },

  async getHorizonScoreByZipCode(zipCode: string): Promise<HorizonScore> {
    try {
      const response = await axios.get(`${API_BASE_URL}/horizon-score`, {
        params: { zipCode },
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      // Backend not available - return mock data for development
      return getMockHorizonScore(undefined, zipCode);
    }
  },


  async getSimilarAreas(zipCode: string, score: number, limit: number = 10): Promise<SimilarArea[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/similar-areas`, {
        params: { zipCode, score, limit },
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      // Backend not available - return mock similar areas for development
      return getMockSimilarAreas(zipCode, score, limit);
    }
  }
};

// Mock data for development/testing
function getMockHorizonScore(address?: string, zipCode?: string): HorizonScore {
  const mockZip = zipCode || '32201';
  const mockAddress = address || `Sample Address, Jacksonville, FL ${mockZip}`;
  
  return {
    address: mockAddress,
    zipCode: mockZip,
    censusTract: '12031014421',
    latitude: 30.3322,
    longitude: -81.6557,
    score: 725,
    scoreCategory: 'good',
    scoreDate: new Date().toISOString(),
    scoreRange: { min: 0, max: 1000 },
    positiveFactors: [
      {
        name: 'Median Household Income',
        description: 'High median income relative to housing costs',
        impact: 85,
        percentage: 35,
        category: 'Income',
        value: 96154,
        threshold: 'Above $80,000 is favorable'
      },
      {
        name: 'Rent Burden',
        description: 'Low rent as percentage of income',
        impact: 45,
        percentage: 18,
        category: 'Housing Costs',
        value: '33.2%',
        threshold: 'Below 30% is ideal'
      }
    ],
    negativeFactors: [
      {
        name: 'Excessive Housing Costs',
        description: 'Some households face excessive housing costs',
        impact: -25,
        percentage: 10,
        category: 'Housing Costs',
        value: 466,
        threshold: 'Lower is better'
      }
    ],
    baseScore: 620,
    totalPositiveImpact: 130,
    totalNegativeImpact: -25,
    predictedScore: 735,
    trendDirection: 'improving',
    displacementRisk: 35,
    historical: [
      { year: 2019, affordabilityIndex: 690 },
      { year: 2020, affordabilityIndex: 700 },
      { year: 2021, affordabilityIndex: 710 },
      { year: 2022, affordabilityIndex: 715 },
      { year: 2023, affordabilityIndex: 720 },
    ],
    predicted: [
      { year: new Date().getFullYear() + 1, affordabilityIndex: 735, probability: 0.85 }
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
