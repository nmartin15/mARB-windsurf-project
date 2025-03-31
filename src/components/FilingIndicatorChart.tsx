import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../utils/format';

interface FilingIndicatorSummary {
  originalName: string;
  displayName: string;
  count: number;
  total_amount: number;
  average_amount: number;
}

interface FilingIndicatorChartProps {
  data: FilingIndicatorSummary[];
}

// Colors for the filing indicator chart
const GRADIENTS = [
  ['#3b82f6', '#1d4ed8'], // Blue (primary color)
  ['#22c55e', '#15803d'], // Green
  ['#f59e0b', '#b45309'], // Amber
  ['#ec4899', '#be185d'], // Pink
  ['#8b5cf6', '#6d28d9'], // Purple
];

// Format currency without decimals
const formatCurrencyWithoutDecimals = (value: number) => {
  return formatCurrency(Math.round(value)).split('.')[0];
};

export function FilingIndicatorChart({ data }: FilingIndicatorChartProps) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="displayName" 
            angle={-45} 
            textAnchor="end" 
            tick={{ fontSize: 12 }}
            height={60}
          />
          <YAxis 
            tickFormatter={(value) => formatCurrencyWithoutDecimals(value)}
          />
          <Tooltip 
            formatter={(value: number, name: string) => {
              if (name === 'total_amount') return formatCurrencyWithoutDecimals(value);
              return value;
            }}
            labelFormatter={(label: string) => `Category: ${label}`}
          />
          <Bar 
            dataKey="total_amount" 
            name="Total Amount" 
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={`url(#gradient-${index})`} 
              />
            ))}
          </Bar>
          {/* Define gradients for bars */}
          <defs>
            {data.map((entry, index) => {
              const colorIndex = index % GRADIENTS.length;
              const [startColor, endColor] = GRADIENTS[colorIndex];
              return (
                <linearGradient 
                  key={`gradient-${index}`} 
                  id={`gradient-${index}`} 
                  x1="0" y1="0" x2="0" y2="1"
                >
                  <stop offset="0%" stopColor={startColor} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={endColor} stopOpacity={0.8} />
                </linearGradient>
              );
            })}
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
