import React, { useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Data structure for the payment velocity chart
 */
interface PaymentVelocityData {
  month: string;
  disputes_closed?: number;
  days_to_payment?: number;
  amount?: number;
}

/**
 * Props for the PaymentVelocityChart component
 */
interface PaymentVelocityProps {
  data: PaymentVelocityData[];
  onPeriodChange?: (period: string) => void;
}

/**
 * Props for the custom tooltip component
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    dataKey: string;
  }>;
  label?: string;
}

/**
 * Type for the time period selection
 */
type TimePeriod = '1D' | '1W' | '1M' | '3M' | 'YTD';

/**
 * Custom tooltip component for the payment velocity chart
 */
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 shadow-lg rounded-lg border">
        <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
        <div className="space-y-1">
          <p className="text-sm text-blue-600">
            Disputes Closed: {payload[0]?.value || 0}
          </p>
          <p className="text-sm text-green-600">
            Avg. Days to Payment: {payload[1]?.value != null ? Math.max(0, payload[1].value).toFixed(1) : 0} days
          </p>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * PaymentVelocityChart displays the number of disputes closed and the average days to payment over time.
 * It allows filtering the data by different time periods.
 */
export function PaymentVelocityChart({ data, onPeriodChange }: PaymentVelocityProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('YTD');

  /**
   * Handle period change and call the onPeriodChange callback if provided
   */
  const handlePeriodChange = (period: TimePeriod) => {
    setSelectedPeriod(period);
    if (onPeriodChange) {
      onPeriodChange(period);
    }
  };

  /**
   * Calculate how many months of data to display based on the selected period
   */
  const getMonthsBack = (): number => {
    switch (selectedPeriod) {
      case '1D':
      case '1W':
        return 1; // Show at least a month of data
      case '1M':
        return 1;
      case '3M':
        return 3;
      case 'YTD': {
        const now = new Date();
        return now.getMonth() + 1; // Current month index + 1
      }
      default:
        return 1;
    }
  };

  // Use a simpler filtering approach that doesn't rely on parsing string months as dates
  const filteredData = data.length > getMonthsBack() 
    ? data.slice(-getMonthsBack()) // Get last N months if we have enough data
    : data; // Otherwise show all data

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Payment Velocity</h2>
        <div className="flex gap-2">
          {(['1D', '1W', '1M', '3M', 'YTD'] as TimePeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="month"
              tick={{ fill: '#6B7280', fontSize: 12 }}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fill: '#6B7280', fontSize: 12 }}
              label={{ 
                value: 'Disputes Closed',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#6B7280', fontSize: 12 }
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#6B7280', fontSize: 12 }}
              domain={[0, 'auto']}
              label={{ 
                value: 'Days to Payment',
                angle: 90,
                position: 'insideRight',
                style: { fill: '#6B7280', fontSize: 12 }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="left"
              dataKey="disputes_closed"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
              name="Disputes Closed"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="days_to_payment"
              stroke="#22C55E"
              strokeWidth={2}
              dot={false}
              name="Days to Payment"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}