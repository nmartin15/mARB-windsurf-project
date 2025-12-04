import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendAnalysisProps {
  data: {
    range: string;
    count: number;
  }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const count = payload[0].value;
    const range = label;

    let color = '#22c55e'; // green for 0-30
    if (range === '31-60' || range === '61-90') {
      color = '#eab308'; // yellow for 31-90
    } else if (range === '90+') {
      color = '#ef4444'; // red for 90+
    }

    return (
      <div className="bg-white p-3 shadow-lg rounded-lg border">
        <p className="text-sm font-medium" style={{ color }}>
          {range} days: {count} claims
        </p>
      </div>
    );
  }
  return null;
};

const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  let color = '#ef4444';
  if (payload.value === '0-30') color = '#22c55e';
  if (payload.value === '31-60' || payload.value === '61-90') color = '#eab308';

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill={color} fontSize={12}>
        {payload.value}
      </text>
    </g>
  );
};

export function TrendAnalysisChart({ data }: TrendAnalysisProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">Historic Trend Analysis</h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                <stop offset="33%" stopColor="#22c55e" stopOpacity={0.8} />
                <stop offset="33%" stopColor="#eab308" stopOpacity={0.8} />
                <stop offset="66%" stopColor="#eab308" stopOpacity={0.8} />
                <stop offset="66%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="range"
              tick={<CustomXAxisTick />}
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="url(#colorGradient)"
              fill="url(#colorGradient)"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex justify-center gap-6">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
          <span className="text-sm text-gray-600">0-30 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
          <span className="text-sm text-gray-600">31-90 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
          <span className="text-sm text-gray-600">90+ days</span>
        </div>
      </div>
    </div>
  );
}