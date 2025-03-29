import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

// Interface for our formatted data that will be used in the chart
interface FormattedTrendData {
  date: string;
  amount: number;
  count: number;
  avgDays: number;
  color: string;
}

// Define the possible response data structures
interface TrendDataResponse {
  range?: string;
  count?: number;
  avgDays?: number;
  date?: string | Date;
  amount?: number;
  [key: string]: string | number | boolean | null | undefined | Date;
}

interface TrendChartProps {
  title?: string;
  period?: '1M' | '3M' | '6M' | '1Y';
  height?: number;
}

// Define color coding based on days range
const getDayRangeColor = (days: number): string => {
  if (days < 15) return '#3b82f6'; // Blue
  if (days < 30) return '#10b981'; // Green
  if (days < 60) return '#f59e0b'; // Yellow
  return '#ef4444'; // Red
};

// Helper function to extract the average days from a range string (e.g., "0-30" -> 15)
const getAvgDaysFromRange = (range: string): number => {
  if (range.includes('-')) {
    const [start, end] = range.split('-').map(Number);
    return (start + end) / 2;
  }
  if (range.includes('+')) {
    const start = parseInt(range.replace('+', ''), 10);
    return start + 30; // Estimate: for "90+" use 120
  }
  return 0; // Default
};

/**
 * TrendChart component displays historical trend data for claims processing
 * with color-coded bars based on processing time ranges
 */
export function TrendChart({ title = 'Claims Trend', period = '3M', height = 300 }: TrendChartProps) {
  const [data, setData] = useState<FormattedTrendData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Fallback to hardcoded data from the SQL function
  const getHardcodedData = () => {
    // This matches the exact data in the get_trend_data function
    const hardcodedData = [
      { range: '0-30', count: 45, avgDays: 15.0 },
      { range: '31-60', count: 32, avgDays: 45.0 },
      { range: '61-90', count: 18, avgDays: 75.0 },
      { range: '91+', count: 12, avgDays: 105.0 }
    ];
    
    // Format the data for the chart with color coding
    const formattedData = hardcodedData.map(item => {
      const avgDays = item.avgDays;
      return {
        date: item.range,
        amount: avgDays * 100, // Convert avgDays to a monetary amount for visualization
        count: item.count,
        avgDays,
        color: getDayRangeColor(avgDays)
      };
    });
    
    setData(formattedData);
    return formattedData;
  };

  const fetchTrendData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      // First attempt: Try the RPC call
      const result = await supabase.rpc('get_trend_data', { period });
      
      // Log the raw result for debugging in development only
      if (process.env.NODE_ENV === 'development') {
        setDebugInfo(JSON.stringify(result, null, 2));
      }
      
      // If the RPC call fails, use hardcoded data
      if (result.error) {
        setError(`Note: Using sample data because the API call failed: ${result.error.message}`);
        getHardcodedData();
        return;
      }
      
      if (result.data && result.data.length > 0) {
        // Try to determine the data structure
        const firstItem = result.data[0] as TrendDataResponse;
        
        let formattedData: FormattedTrendData[];
        
        // Check if it matches V1 structure
        if ('date' in firstItem && 'amount' in firstItem && 'count' in firstItem) {
          formattedData = result.data.map((item: TrendDataResponse) => {
            // For V1 structure, estimate avgDays from the amount
            const avgDays = ((item.amount as number) || 0) / 100;
            return {
              date: typeof item.date === 'string' ? item.date : format(new Date(String(item.date)), 'MMM dd'),
              amount: typeof item.amount === 'number' ? item.amount : Number(item.amount),
              count: typeof item.count === 'number' ? item.count : Number(item.count),
              avgDays,
              color: getDayRangeColor(avgDays)
            };
          });
        }
        // Check if it matches V2 structure
        else if ('range' in firstItem && 'count' in firstItem && 'avgDays' in firstItem) {
          formattedData = result.data.map((item: TrendDataResponse) => {
            const avgDays = item.avgDays as number;
            return {
              date: item.range as string,
              amount: avgDays * 100, // Convert avgDays to a monetary amount for visualization
              count: item.count as number,
              avgDays,
              color: getDayRangeColor(avgDays)
            };
          });
        }
        // Unknown structure - try to adapt
        else {
          // Try our best to adapt to an unknown structure
          // Log keys only in development mode
          if (process.env.NODE_ENV === 'development') {
            setDebugInfo(prev => `${prev || ''}\nKeys in first item: ${Object.keys(firstItem).join(', ')}`);
          }
          
          formattedData = result.data.map((item: TrendDataResponse) => {
            const keys = Object.keys(item);
            const date = String(item[keys[0]] || 'Unknown');
            // Try to extract average days from the range string or use a default value
            const avgDays = 'range' in item 
              ? getAvgDaysFromRange(item.range as string)
              : ('avgDays' in item ? Number(item.avgDays) : 30);
            
            return {
              date,
              amount: typeof item[keys[1]] === 'number' ? item[keys[1]] : 0,
              count: typeof item[keys[2]] === 'number' ? item[keys[2]] : 0,
              avgDays,
              color: getDayRangeColor(avgDays)
            };
          });
        }
        
        setData(formattedData);
      } else {
        getHardcodedData();
        setError('No data returned from the API. Showing sample data instead.');
      }
    } catch (error) {
      setError(`An error occurred while fetching trend data: ${error instanceof Error ? error.message : String(error)}`);
      getHardcodedData();
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading trend data...</div>;
  }

  // Custom tooltip interface that extends Recharts tooltip props
  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
      payload: FormattedTrendData;
    }>;
  }
  
  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-md rounded">
          <p className="font-medium">{`Range: ${item.date}`}</p>
          <p className="text-sm">{`Average Days: ${item.avgDays.toFixed(1)}`}</p>
          <p className="text-sm">{`Claims Count: ${item.count}`}</p>
          <p className="text-sm">{`Amount: $${item.amount.toLocaleString()}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="flex justify-end mb-2">
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
            <span>0-15 days</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
            <span>15-30 days</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-1"></div>
            <span>30-60 days</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
            <span>60+ days</span>
          </div>
        </div>
      </div>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {debugInfo && process.env.NODE_ENV === 'development' && (
        <details className="mb-4 text-xs">
          <summary className="cursor-pointer text-gray-500">Debug Information</summary>
          <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
            {debugInfo}
          </pre>
        </details>
      )}
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="amount" name="Amount">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
