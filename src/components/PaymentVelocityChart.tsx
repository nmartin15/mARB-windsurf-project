import React, { useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, subMonths, startOfYear } from 'date-fns';

interface PaymentVelocityProps {
  data: {
    month: string;
    disputes_closed: number;
    days_to_payment: number;
  }[];
  onPeriodChange: (period: string) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 shadow-lg rounded-lg border">
        <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
        <div className="space-y-1">
          <p className="text-sm text-blue-600">
            Disputes Closed: {payload[0].value}
          </p>
          <p className="text-sm text-green-600">
            Avg. Days to Payment: {payload[1].value.toFixed(1)} days
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function PaymentVelocityChart({ data, onPeriodChange }: PaymentVelocityProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('1M');

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    onPeriodChange(period);
  };

  const getDateRange = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case '1D':
        return subDays(now, 1);
      case '1W':
        return subDays(now, 7);
      case '1M':
        return subMonths(now, 1);
      case '3M':
        return subMonths(now, 3);
      case 'YTD':
        return startOfYear(now);
      default:
        return subMonths(now, 1);
    }
  };

  const filteredData = data.filter(item => {
    const itemDate = new Date(item.month);
    return itemDate >= getDateRange();
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Payment Velocity</h2>
        <div className="flex gap-2">
          {['1D', '1W', '1M', '3M', 'YTD'].map((period) => (
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