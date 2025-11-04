import axios from 'axios';
import type { HorizonScore, SimilarArea, HAIRequest, HAIResponse, SimilarityRequest, SimilarityResponse } from '../types';
import { transformHAIToHorizonScore, transformSimilarityToSimilarAreas } from '../utils/adapters';

// Backend API base URL (FastAPI runs on port 8000)
// In development, calls directly to backend without /api prefix
// In production, can be set via VITE_API_URL environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
      // Silently use mock data when backend is unavailable (expected in development)
      return getMockHorizonScore(geoInfo?.address, zipCode);
    }
  },

  /**
   * Get Horizon scores for multiple zip codes (for city/county aggregation)
   * Returns map of zipCode -> HorizonScore
   */
  async getHorizonScoresForZipCodes(zipCodes: string[]): Promise<Map<string, HorizonScore>> {
    const scoreMap = new Map<string, HorizonScore>();
    
    // Fetch scores for all zip codes in parallel (with some batching to avoid overwhelming)
    const batchSize = 10;
    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);
      const promises = batch.map(async (zip) => {
        try {
          const score = await this.getHorizonScoreByZipCode(zip);
          return { zip, score };
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn(`Failed to get score for zip ${zip}:`, error);
          }
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      results.forEach((result) => {
        if (result && result.score) {
          scoreMap.set(result.zip, result.score);
        }
      });
    }
    
    return scoreMap;
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
      // Silently use mock data when backend is unavailable (expected in development)
      return getMockSimilarAreas(zipCode, score, limit);
    }
  },

  /**
   * Ask the AI assistant a question with optional location context
   * @param prompts List of user prompts/questions
   * @param data Optional data context (e.g., current location score data)
   */
  async askAI(prompts: string[], data: Record<string, any> = {}): Promise<string> {
    try {
      const response = await axios.post<{ answer: string }>(
        `${API_BASE_URL}/ask`,
        {
          prompts,
          data
        },
        {
          timeout: 30000, // 30 seconds timeout for AI responses
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.answer;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('AI request error:', error);
      }
      throw error;
    }
  },

  /**
   * Get similar cities or counties based on average scores of their zip codes
   */
  async getSimilarCitiesOrCounties(
    cityOrCountyName: string,
    score: number,
    viewType: 'city' | 'county',
    limit: number = 10
  ): Promise<SimilarArea[]> {
    try {
      // Get all cities/counties from GeoJSON data and calculate their scores
      const { getCachedGeoJSON } = await import('../utils/geojsonBoundaries');
      
      // Get all unique cities/counties and their zip codes
      const geoJSON = await getCachedGeoJSON();
      if (!geoJSON) {
        return getMockSimilarCitiesOrCounties(cityOrCountyName, score, viewType, limit);
      }

      const cityCountyMap = new Map<string, { zipCodes: Set<string>; name: string }>();
      
      if (viewType === 'city') {
        // Group zips by city name
        for (const feature of geoJSON.features) {
          const city = feature.properties.PO_NAME || 
                      feature.properties.CITY || 
                      feature.properties.CITY_NAME ||
                      feature.properties.NAME;
          const zip = feature.properties.ZIP || 
                     feature.properties.ZCTA5CE10 || 
                     feature.properties.ZCTA5 ||
                     feature.properties.GEOID?.match(/\d{5}/)?.[0];
          
          if (city && zip) {
            const cityKey = city.toUpperCase().trim();
            if (!cityCountyMap.has(cityKey)) {
              cityCountyMap.set(cityKey, { zipCodes: new Set(), name: city });
            }
            cityCountyMap.get(cityKey)!.zipCodes.add(zip);
          }
        }
      } else {
        // Group zips by county name
        for (const feature of geoJSON.features) {
          const county = feature.properties.COUNTY || 
                        feature.properties.COUNTY_NAME ||
                        feature.properties.GEOCODED_COUNTY;
          const zip = feature.properties.ZIP || 
                     feature.properties.ZCTA5CE10 || 
                     feature.properties.ZCTA5 ||
                     feature.properties.GEOID?.match(/\d{5}/)?.[0];
          
          if (county && zip) {
            const countyKey = county.toUpperCase().trim().replace(/\s+COUNTY\s*$/, '');
            const countyName = county.includes('County') ? county : `${county} County`;
            
            if (!cityCountyMap.has(countyKey)) {
              cityCountyMap.set(countyKey, { zipCodes: new Set(), name: countyName });
            }
            cityCountyMap.get(countyKey)!.zipCodes.add(zip);
          }
        }
      }

      // OPTIMIZATION: Use cached city/county scores if available, otherwise use representative zip score
      // This reduces load time from 2-5s to < 1s for cached results
      
      const cacheKey = `${viewType}-score-cache`;
      let cachedScores: Map<string, number> | null = null;
      
      // Try to load cached scores
      try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (parsed && typeof parsed === 'object') {
            cachedScores = new Map(Object.entries(parsed));
          }
        }
      } catch (error) {
        // Cache unavailable or corrupted, continue without cache
      }

      // Step 1: Get representative zip scores for all cities/counties (use cache when available)
      const cityCountyEstimates: Array<{
        name: string;
        zipCodes: string[];
        estimatedScore: number;
      }> = [];

      // Process all cities/counties in parallel for representative zip scores
      const estimatePromises: Promise<void>[] = [];
      let processedCount = 0;
      const maxToProcess = Math.min(50, cityCountyMap.size); // Process up to 50 at once

      for (const [, data] of cityCountyMap.entries()) {
        if (processedCount >= maxToProcess) break;
        if (data.zipCodes.size === 0) continue;
        
        estimatePromises.push((async () => {
          try {
            let estimatedScore: number;
            
            // Check cache first
            const cacheName = data.name.toUpperCase().trim();
            if (cachedScores && cachedScores.has(cacheName)) {
              estimatedScore = cachedScores.get(cacheName)!;
            } else {
              // Get score for just one representative zip (fast)
              const representativeZip = Array.from(data.zipCodes)[0];
              const representativeScore = await this.getHorizonScoreByZipCode(representativeZip);
              estimatedScore = representativeScore.score;
              
              // Cache the score for future use
              if (!cachedScores) {
                cachedScores = new Map();
              }
              cachedScores.set(cacheName, estimatedScore);
            }
            
            cityCountyEstimates.push({
              name: data.name,
              zipCodes: Array.from(data.zipCodes),
              estimatedScore
            });
          } catch (error) {
            // Skip cities/counties where we can't get scores
            if (import.meta.env.DEV) {
              console.warn(`Failed to get estimate for ${viewType} ${data.name}:`, error);
            }
          }
        })());
        
        processedCount++;
      }

      // Wait for all estimates (batched in parallel)
      await Promise.all(estimatePromises);
      
      // Save cache for future use
      if (cachedScores && cachedScores.size > 0) {
        try {
          const cacheData = Object.fromEntries(cachedScores);
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
          // Cache save failed, continue without caching
        }
      }

      // Step 2: Sort estimates by similarity and take top candidates
      cityCountyEstimates.sort((a, b) => {
        const diffA = Math.abs(a.estimatedScore - score);
        const diffB = Math.abs(b.estimatedScore - score);
        return diffA - diffB;
      });

      const currentNameUpper = cityOrCountyName.toUpperCase().trim();
      const candidates = cityCountyEstimates
        .filter(item => item.name.toUpperCase().trim() !== currentNameUpper)
        .slice(0, limit); // Only get top candidates needed

      // Step 3: Use representative zip scores for initial display (fast!)
      // Full averaging happens lazily when user expands to see details
      const similar = candidates
        .map((item, index) => ({
          areaType: viewType as 'city' | 'county',
          [viewType === 'city' ? 'cityName' : 'countyName']: item.name,
          score: item.estimatedScore, // Use representative score for collapsed view
          scoreDifference: item.estimatedScore - score,
          distance: (index + 1) * 10, // Mock distance for now
          keySimilarities: ['Score Similarity'],
          latitude: 0,
          longitude: 0,
          zipCode: item.zipCodes[0], // Representative zip code
          // Store all zip codes for full calculation on expand
          _allZipCodes: item.zipCodes
        })) as any[];

      return similar;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error getting similar cities/counties:', error);
      }
      return getMockSimilarCitiesOrCounties(cityOrCountyName, score, viewType, limit);
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
        trueValue: 0.87,
        threshold: 'Higher values indicate better affordability'
      },
      {
        name: 'PC2',
        description: 'Principal component PC2 with positive influence',
        impact: 45,
        percentage: 18,
        category: 'Housing Costs',
        value: '0.450',
        trueValue: 0.87,
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
        trueValue: 0.87,
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


// Mock similar cities/counties for development/testing
function getMockSimilarCitiesOrCounties(
  cityOrCountyName: string,
  score: number,
  viewType: 'city' | 'county',
  limit: number
): SimilarArea[] {
  const mockNames = viewType === 'city' 
    ? ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'Tallahassee', 'Gainesville', 'Fort Lauderdale', 'St. Petersburg', 'Clearwater', 'Port St. Lucie']
    : ['Duval County', 'Miami-Dade County', 'Hillsborough County', 'Orange County', 'Pinellas County', 'Palm Beach County', 'Broward County', 'Polk County', 'Brevard County', 'Volusia County'];
  
  return mockNames
    .filter(name => name.toUpperCase() !== cityOrCountyName.toUpperCase())
    .slice(0, limit)
    .map((name, index) => {
      const scoreDiff = (Math.random() * 40) - 20;
      const similarScore = Math.round(score + scoreDiff);
      
      return {
        areaType: viewType,
        [viewType === 'city' ? 'cityName' : 'countyName']: name,
        score: similarScore,
        scoreDifference: Math.round(scoreDiff),
        distance: (index + 1) * 10,
        keySimilarities: ['Average Score Similarity'],
        latitude: 0,
        longitude: 0,
        zipCode: '32201' // Representative zip
      } as SimilarArea;
    })
    .sort((a, b) => {
      const diffA = Math.abs(a.score - score);
      const diffB = Math.abs(b.score - score);
      return diffA - diffB;
    });
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
        areaType: 'zip' as const,
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
