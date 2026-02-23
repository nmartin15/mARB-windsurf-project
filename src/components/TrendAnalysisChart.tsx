import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  TooltipProps,
  Cell
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface TrendData {
  range: string;
  count: number;
  avgDays?: number;
}

interface TrendAnalysisProps {
  data: TrendData[];
}

// Define color coding based on days range
// Blue: 0-30 days, Green: 30-60 days, Yellow: 60-90 days, Red: 90+ days
const getDayRangeColor = (range: string, avgDays?: number): string => {
  // If we have avgDays, use that for more accurate coloring
  if (avgDays !== undefined) {
    if (avgDays <= 30) return '#3b82f6'; // Blue
    if (avgDays <= 60) return '#10b981'; // Green
    if (avgDays <= 90) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red for 90+ days
  }
  
  // Otherwise, parse from range string
  if (range.includes('+')) {
    const start = parseInt(range.replace('+', ''), 10);
    if (start >= 90) return '#ef4444'; // Red
    if (start >= 60) return '#f59e0b'; // Yellow
    if (start >= 30) return '#10b981'; // Green
    return '#3b82f6'; // Blue
  }
  
  if (range.includes('-')) {
    const [start, end] = range.split('-').map(Number);
    const mid = (start + end) / 2;
    if (mid <= 30) return '#3b82f6'; // Blue
    if (mid <= 60) return '#10b981'; // Green
    if (mid <= 90) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  }
  
  return '#3b82f6'; // Default to blue
};

// Custom tooltip component to display both claim count and average days
const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
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
      <div className="h-80 flex items-center justify-center" role="status" aria-live="polite">
        <p className="text-gray-600">No trend data available for the selected period.</p>
      </div>
    );
  }

  // Use the data as is - we're already sorting it in the Dashboard component
  // Add color property to each data point
  const chartData = data.map(item => ({
    ...item,
    color: getDayRangeColor(item.range, item.avgDays)
  }));

  return (
    <div>
      <div className="h-80" role="img" aria-label="Claim aging distribution by day range">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Claims">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex justify-center gap-6">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
          <span className="text-sm text-gray-600">0-30 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          <span className="text-sm text-gray-600">30-60 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
          <span className="text-sm text-gray-600">60-90 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
          <span className="text-sm text-gray-600">90+ days</span>
        </div>
      </div>
    </div>
  );
}