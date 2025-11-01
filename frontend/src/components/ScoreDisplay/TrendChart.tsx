import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { HorizonScore } from '../../types';
import './TrendChart.css';

interface TrendChartProps {
  score: HorizonScore;
}

interface ChartDataPoint {
  year: number;
  historical?: number;
  predicted?: number;
  label: string;
}

export function TrendChart({ score }: TrendChartProps) {
  // Build historical data points (if available)
  const historicalData: ChartDataPoint[] = [];
  if (score.historical && score.historical.length > 0) {
    score.historical.forEach(point => {
      historicalData.push({
        year: point.year,
        historical: point.affordabilityIndex,
        label: `Historical ${point.year}`
      });
    });
  }
  
  // Add current year point
  const currentYear = new Date().getFullYear();
  historicalData.push({
    year: currentYear,
    historical: score.score,
    label: 'Current'
  });
  
  // Build predicted data points
  const predictedData: ChartDataPoint[] = [];
  if (score.predicted && score.predicted.length > 0) {
    score.predicted.forEach(point => {
      predictedData.push({
        year: point.year,
        predicted: point.affordabilityIndex,
        label: `Predicted ${point.year}`
      });
    });
  }
  
  // Combine for display (separate charts as per plan)
  const allData: ChartDataPoint[] = [...historicalData, ...predictedData].sort((a, b) => a.year - b.year);
  
  const getTrendIcon = () => {
    if (score.trendDirection === 'improving') return '↑';
    if (score.trendDirection === 'declining') return '↓';
    return '→';
  };
  
  const getTrendColor = () => {
    if (score.trendDirection === 'improving') return '#4caf50';
    if (score.trendDirection === 'declining') return '#f44336';
    return '#ff9800';
  };

  return (
    <div className="trend-chart-container">
      <div className="trend-header">
        <h3>Trend Prediction</h3>
        <div className="trend-indicator" style={{ color: getTrendColor() }}>
          <span className="trend-icon">{getTrendIcon()}</span>
          <span className="trend-label">{score.trendDirection.toUpperCase()}</span>
        </div>
      </div>
      
      <div className="trend-comparison">
        <div className="current-vs-predicted">
          <div className="score-comparison-item">
            <div className="comparison-label">Current Score</div>
            <div className="comparison-value">{score.score}</div>
          </div>
          <div className="score-comparison-item">
            <div className="comparison-label">Predicted (1 year)</div>
            <div className="comparison-value predicted">{score.predictedScore}</div>
          </div>
        </div>
      </div>

      {/* Historical Chart */}
      {historicalData.length > 1 && (
        <div className="chart-section">
          <h4>Historical Trend</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historicalData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={['auto', 'auto']}
                tick={{ fontSize: 12 }}
                label={{ value: 'Score', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: number) => [`${value}`, 'Historical Score']}
                labelFormatter={(label) => `Year: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="historical" 
                stroke="#2196F3" 
                strokeWidth={2}
                dot={{ fill: '#2196F3', r: 4 }}
                name="Historical Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Predicted Chart */}
      {predictedData.length > 0 && (
        <div className="chart-section">
          <h4>Predicted Trend</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={[...historicalData.slice(-1), ...predictedData]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                domain={['auto', 'auto']}
                tick={{ fontSize: 12 }}
                label={{ value: 'Score', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: number) => [`${value}`, 'Predicted Score']}
                labelFormatter={(label) => `Year: ${label}`}
              />
              <ReferenceLine 
                x={currentYear} 
                stroke="#666" 
                strokeDasharray="3 3" 
                label={{ value: 'Now', position: 'top' }}
              />
              <Line 
                type="monotone" 
                dataKey="historical" 
                stroke="#2196F3" 
                strokeWidth={2}
                strokeDasharray="0"
                dot={{ fill: '#2196F3', r: 4 }}
                name="Current"
              />
              <Line 
                type="monotone" 
                dataKey="predicted" 
                stroke="#4caf50" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#4caf50', r: 4 }}
                name="Predicted"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

