import React from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

interface ChartDataItem {
  name: string;
  value: number;
}

interface BarChartComponentProps {
  data: ChartDataItem[];
  colors: string[];
  title: string;
  valueFormatter: (value: number) => string;
}

const BarChartComponent = ({
  data,
  colors,
  title,
  valueFormatter
}: BarChartComponentProps): JSX.Element => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="text-lg font-medium text-gray-900 mb-6">{title}</h3>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          {/* @ts-ignore */}
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            {/* @ts-ignore */}
            <CartesianGrid strokeDasharray="3 3" />
            {/* @ts-ignore */}
            <XAxis
              dataKey="name"
              tick={{ fill: '#6B7280', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            {/* @ts-ignore */}
            <YAxis
              tickFormatter={valueFormatter}
              tick={{ fill: '#6B7280', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            {/* @ts-ignore */}
            <Tooltip
              formatter={(value: number) => [valueFormatter(value), title]}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
              contentStyle={{
                backgroundColor: 'white',
                borderRadius: '0.375rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                border: 'none'
              }}
            />
            {/* @ts-ignore */}
            <Legend />
            {/* @ts-ignore */}
            <Bar dataKey="value" name={title} radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                /* @ts-ignore */
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BarChartComponent;
