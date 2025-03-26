import React from 'react';
import { useNavigate } from 'react-router-dom';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  type: 'paid' | 'receivables' | 'negotiation' | 'unpaid';
}

export function MetricCard({ title, value, subtitle, type }: MetricCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/claims/${type}`);
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-sm p-6 cursor-pointer transition-all hover:shadow-md"
      onClick={handleClick}
    >
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}