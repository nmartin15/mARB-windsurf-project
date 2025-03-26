import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnDef,
  FilterFn,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import { useDebounce } from 'use-debounce';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ data, columns, onRowClick }: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<Record<string, string>>({});
  const [globalFilter, setGlobalFilter] = React.useState('');
  
  // Debounce filters to prevent excessive re-renders
  const [debouncedColumnFilters] = useDebounce(columnFilters, 300);
  const [debouncedGlobalFilter] = useDebounce(globalFilter, 300);

  // Memoize the filter function to prevent recreating on every render
  const fuzzyFilter: FilterFn<any> = React.useMemo(
    () => (row, columnId, value) => {
      const searchValue = value.toLowerCase();
      const cellValue = row.getValue(columnId);
      
      // Handle null/undefined values
      if (cellValue == null) return false;
      
      // Convert to string for comparison
      const stringValue = String(cellValue).toLowerCase();
      
      // Check if the cell value contains the search value
      return stringValue.includes(searchValue);
    },
    []
  );

  // Memoize the data to prevent unnecessary re-renders
  const memoizedData = React.useMemo(() => data, [data]);

  const table = useReactTable({
    data: memoizedData,
    columns,
    state: {
      sorting,
      globalFilter: debouncedGlobalFilter,
      columnFilters: Object.entries(debouncedColumnFilters).map(([id, value]) => ({
        id,
        value: value || '',
      })),
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    globalFilterFn: fuzzyFilter,
    enableFilters: true,
    manualFiltering: false,
  });

  const handleColumnFilterChange = React.useCallback((columnId: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnId]: value,
    }));
  }, []);

  const clearColumnFilter = React.useCallback((columnId: string) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnId];
      return newFilters;
    });
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setColumnFilters({});
    setGlobalFilter('');
  }, []);

  // Memoize the header and row rendering functions
  const renderHeader = React.useCallback((header: any) => (
    <th
      key={header.id}
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
    >
      <div className="space-y-2">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={header.column.getToggleSortingHandler()}
        >
          {flexRender(
            header.column.columnDef.header,
            header.getContext()
          )}
          {header.column.getIsSorted() === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : header.column.getIsSorted() === 'desc' ? (
            <ChevronDown className="h-4 w-4" />
          ) : null}
        </div>
        
        <div className="relative">
          <input
            type="text"
            value={columnFilters[header.column.id] || ''}
            onChange={e => handleColumnFilterChange(header.column.id, e.target.value)}
            placeholder="Filter..."
            className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          {columnFilters[header.column.id] && (
            <button
              onClick={() => clearColumnFilter(header.column.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </th>
  ), [columnFilters, handleColumnFilterChange, clearColumnFilter]);

  return (
    <div className="w-full flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search all columns..."
            className="pl-10 pr-4 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>
        {(Object.keys(columnFilters).length > 0 || globalFilter) && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>
      
      <div className="relative">
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(renderHeader)}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-6 py-4 text-center text-gray-500 text-sm"
                    >
                      No results found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}