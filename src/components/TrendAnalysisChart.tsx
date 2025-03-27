import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { parse } from 'date-fns';

interface TrendData {
  range: string;
  count: number;
  avgDays?: number;
}

interface TrendAnalysisProps {
  data: TrendData[];
}

// Custom tooltip component to display both claim count and average days
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const count = payload[0].value;
    const avgDays = payload[0].payload.avgDays || 0;
    
    return (
      <div className="bg-white p-3 shadow-lg rounded-lg border">
        <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
        <p className="text-sm text-gray-700">Claims: <span className="font-medium">{count}</span></p>
        {avgDays > 0 && (
          <p className="text-sm text-gray-700">Avg. Days: <span className="font-medium">{avgDays}</span></p>
        )}
      </div>
    );
  }
  return null;
};

export function TrendAnalysisChart({ data }: TrendAnalysisProps) {
  // Check if we have data to display
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Historic Trend Analysis</h2>
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">No trend data available for the selected period.</p>
        </div>
      </div>
    );
  }

  // Sort data to ensure it's in sequential order by date
  const sortedData = [...data].sort((a, b) => {
    try {
      // Parse month-year format (e.g., "Jan 2023") correctly
      const aDate = parse(a.range, 'MMM yyyy', new Date());
      const bDate = parse(b.range, 'MMM yyyy', new Date());
      
      // If both are valid dates, compare them
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return aDate.getTime() - bDate.getTime();
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
    
    // Fallback to string comparison if date parsing fails
    return a.range.localeCompare(b.range);
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">Historic Trend Analysis</h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sortedData}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="range" 
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              fill="url(#colorGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex justify-center gap-6">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
          <span className="text-sm text-gray-600">Claims</span>
        </div>
      </div>
    </div>
  );
}