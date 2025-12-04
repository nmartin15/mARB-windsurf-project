import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ReportFilters } from '../../types/reports';

interface FilterBarProps {
  filters: ReportFilters;
  onFilterChange: (filters: ReportFilters) => void;
  providers: Array<{ id: string; name: string }>;
  payers: Array<{ id: string; name: string }>;
  procedureCodes?: Array<{ code: string; description: string }>;
  showProcedureFilter?: boolean;
  showAmountFilter?: boolean;
  showClaimCountFilter?: boolean;
}

export function FilterBar({
  filters,
  onFilterChange,
  providers,
  payers,
  procedureCodes,
  showProcedureFilter = false,
  showAmountFilter = false,
  showClaimCountFilter = false,
}: FilterBarProps) {
  const handleChange = (key: keyof ReportFilters, value: any) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date Range
          </label>
          <div className="flex gap-2">
            <DatePicker
              selected={filters.startDate}
              onChange={(date) => handleChange('startDate', date)}
              className="w-full px-3 py-2 border rounded-md"
              placeholderText="Start Date"
            />
            <DatePicker
              selected={filters.endDate}
              onChange={(date) => handleChange('endDate', date)}
              className="w-full px-3 py-2 border rounded-md"
              placeholderText="End Date"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider
          </label>
          <select
            value={filters.providerId || ''}
            onChange={(e) => handleChange('providerId', e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">All Providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payer
          </label>
          <select
            value={filters.payerId || ''}
            onChange={(e) => handleChange('payerId', e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">All Payers</option>
            {payers.map((payer) => (
              <option key={payer.id} value={payer.id}>
                {payer.name}
              </option>
            ))}
          </select>
        </div>

        {showProcedureFilter && procedureCodes && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Procedure Code
            </label>
            <select
              value={filters.procedureCode || ''}
              onChange={(e) => handleChange('procedureCode', e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">All Procedures</option>
              {procedureCodes.map((proc) => (
                <option key={proc.code} value={proc.code}>
                  {proc.code} - {proc.description}
                </option>
              ))}
            </select>
          </div>
        )}

        {showAmountFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Amount
            </label>
            <input
              type="number"
              value={filters.minAmount || ''}
              onChange={(e) => handleChange('minAmount', Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Enter minimum amount"
            />
          </div>
        )}

        {showClaimCountFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Claims
            </label>
            <input
              type="number"
              value={filters.minClaimCount || ''}
              onChange={(e) => handleChange('minClaimCount', Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Enter minimum claims"
            />
          </div>
        )}
      </div>
    </div>
  );
}