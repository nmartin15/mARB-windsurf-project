import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface ReportFilters {
  startDate: Date;
  endDate: Date;
  providerId?: string;
  payerId?: string;
  procedureCode?: string;
  denialReason?: string;
  minAmount?: number;
  minClaimCount?: number;
}

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

// Type assertion for DatePicker component
const TypedDatePicker = DatePicker as any;

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

  // Parse and format the minimum amount value for display
  const formatMinAmountDisplay = (value?: number): string => {
    if (!value) return '';
    return (value / 1000).toString();
  };

  // Parse the input value and convert to actual amount in dollars
  const parseMinAmountInput = (value: string): number | undefined => {
    const numValue = parseFloat(value);
    if (value === '' || isNaN(numValue)) {
      return undefined;
    }
    return numValue * 1000; // Convert from K to actual amount
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date Range
          </label>
          <div className="flex items-center space-x-2">
            <TypedDatePicker
              selected={filters.startDate}
              onChange={(date: Date) => handleChange('startDate', date)}
              selectsStart
              startDate={filters.startDate}
              endDate={filters.endDate}
              className="w-full px-3 py-2 border rounded-md"
              dateFormat="MMM d, yyyy"
            />
            <span className="text-gray-500">to</span>
            <TypedDatePicker
              selected={filters.endDate}
              onChange={(date: Date) => handleChange('endDate', date)}
              selectsEnd
              startDate={filters.startDate}
              endDate={filters.endDate}
              minDate={filters.startDate}
              className="w-full px-3 py-2 border rounded-md"
              dateFormat="MMM d, yyyy"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider
          </label>
          <select
            value={filters.providerId || ''}
            onChange={(e) => handleChange('providerId', e.target.value || undefined)}
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
            onChange={(e) => handleChange('payerId', e.target.value || undefined)}
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
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="text"
                value={formatMinAmountDisplay(filters.minAmount)}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  handleChange('minAmount', parseMinAmountInput(value));
                }}
                className="w-full px-3 py-2 pl-7 border rounded-md"
                placeholder="Enter amount (k)"
              />
              <span className="absolute right-3 top-2 text-gray-500">k</span>
            </div>
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