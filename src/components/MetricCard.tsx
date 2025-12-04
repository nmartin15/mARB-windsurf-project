import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Users, FileText, AlertCircle, TrendingUp } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  type: 'paid' | 'receivables' | 'negotiation' | 'unpaid';
}

const CARD_CONFIG = {
  paid: {
    icon: DollarSign,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-500',
  },
  receivables: {
    icon: TrendingUp,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-500',
  },
  negotiation: {
    icon: FileText,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-500',
  },
  unpaid: {
    icon: AlertCircle,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-500',
  },
};

export function MetricCard({ title, value, subtitle, type }: MetricCardProps) {
  const navigate = useNavigate();
  const config = CARD_CONFIG[type];
  const Icon = config.icon;

  const handleClick = () => {
    navigate(`/claims/${type}`);
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-6 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1 border-t-4 ${config.border}`}
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${config.bg}`}>
          <Icon className={`h-6 w-6 ${config.color}`} />
        </div>
      </div>
      {subtitle && (
        <div className="mt-4 flex items-center">
          <span className="text-sm font-medium text-gray-500">{subtitle}</span>
        </div>
      )}
    </div>
  );
}