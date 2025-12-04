import React from 'react';
import { Icon } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ElementType;
  trend?: number;
  trendLabel?: string;
  iconColor?: string;
  valueColor?: string;
}

const SummaryCard = ({
  title,
  value,
  description,
  icon: IconComponent,
  trend,
  trendLabel,
  iconColor = 'text-blue-500',
  valueColor = 'text-gray-900'
}: SummaryCardProps) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center">
        {IconComponent && (
          <div className={`rounded-full p-3 mr-4 ${iconColor} bg-opacity-10`}>
            <IconComponent className="h-6 w-6" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <div className="flex items-center mt-1">
            <span className={`text-2xl font-semibold ${valueColor}`}>{value}</span>
            {trend !== undefined && (
              <span className={`ml-2 flex items-center text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                {trendLabel && <span className="ml-1 text-gray-500">{trendLabel}</span>}
              </span>
            )}
          </div>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
      </div>
    </div>
  );
};

export default SummaryCard;
