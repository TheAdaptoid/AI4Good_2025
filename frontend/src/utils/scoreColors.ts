/**
 * Shared utility for score color calculations
 * Ensures consistent color usage across all components
 */

/**
 * Get color for a given Horizon Score (0-1000 scale)
 * Uses the six-category color scheme:
 * - Excellent (850-1000): Purple (#9c27b0)
 * - Good (700-850): Blue (#2196F3)
 * - Fair (550-700): Green (#4caf50)
 * - Moderate (400-550): Yellow (#ffeb3b)
 * - Poor (250-400): Orange (#ff9800)
 * - Critical (0-250): Red (#f44336)
 * - Not Available (-1): Gray (#9e9e9e)
 */
export function getScoreColor(score: number): string {
  // Handle -1 (not available)
  if (score === -1) return '#9e9e9e'; // Gray - Not Available
  
  // Six categories with color scheme
  // Excellent (850-1000): Purple
  if (score >= 850) return '#9c27b0'; // Purple
  // Good (700-850): Blue
  if (score >= 700) return '#2196F3'; // Blue
  // Fair (550-700): Green
  if (score >= 550) return '#4caf50'; // Green
  // Moderate (400-550): Yellow
  if (score >= 400) return '#ffeb3b'; // Yellow
  // Poor (250-400): Orange
  if (score >= 250) return '#ff9800'; // Orange
  // Critical (0-250): Red
  return '#f44336'; // Red
}

