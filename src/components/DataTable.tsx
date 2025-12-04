import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnDef,
  FilterFn,
  ColumnFiltersState,
  getPaginationRowModel,
  PaginationState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, Search, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useDebounce } from 'use-debounce';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ data, columns, onRowClick }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<Record<string, boolean>>({});
  const [uniqueValues, setUniqueValues] = useState<Record<string, Set<string>>>({});
  
  // Debounce filters to prevent excessive re-renders
  const [debouncedGlobalFilter] = useDebounce(globalFilter, 300);

  // Pagination state
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const pagination = useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize]
  );

  // Memoize the data to prevent unnecessary re-renders
  const memoizedData = useMemo(() => data, [data]);

  // Extract unique values for each column for predictive filtering
  useEffect(() => {
    const newUniqueValues: Record<string, Set<string>> = {};
    
    columns.forEach(column => {
      const accessorKey = column.accessorKey as string | undefined;
      if (typeof accessorKey === 'string') {
        const values = new Set<string>();
        
        data.forEach(row => {
          const value = (row as any)[accessorKey];
          if (value !== null && value !== undefined) {
            values.add(String(value));
          }
        });
        
        newUniqueValues[accessorKey] = values;
      }
    });
    
    setUniqueValues(newUniqueValues);
  }, [data, columns]);

  // Memoize the filter function to prevent recreating on every render
  const fuzzyFilter: FilterFn<any> = useMemo(
    () => (row: any, columnId: string, value: string) => {
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

  const table = useReactTable({
    data: memoizedData,
    columns,
    state: {
      sorting,
      globalFilter: debouncedGlobalFilter,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const newState = updater(pagination);
        setPageIndex(newState.pageIndex);
        setPageSize(newState.pageSize);
      } else {
        setPageIndex(updater.pageIndex);
        setPageSize(updater.pageSize);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    globalFilterFn: fuzzyFilter,
    enableFilters: true,
    manualFiltering: false,
  });

  const toggleFilterDropdown = useCallback((columnId: string) => {
    setFilterDropdownOpen((prev: Record<string, boolean>) => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  }, []);

  const handleColumnFilterChange = useCallback((columnId: string, value: string) => {
    table.getColumn(columnId)?.setFilterValue(value);
  }, [table]);

  const clearColumnFilter = useCallback((columnId: string) => {
    table.getColumn(columnId)?.setFilterValue('');
  }, [table]);

  const clearAllFilters = useCallback(() => {
    setColumnFilters([]);
    setGlobalFilter('');
  }, []);

  const getFilteredOptions = useCallback((columnId: string, inputValue: string) => {
    const values = uniqueValues[columnId];
    if (!values) return [];
    
    const searchValue = inputValue.toLowerCase();
    return Array.from(values)
      .filter(value => value.toLowerCase().includes(searchValue))
      .sort()
      .slice(0, 10); // Limit to 10 options for performance
  }, [uniqueValues]);

  // Memoize the header rendering function
  const renderHeader = useCallback((header: any) => (
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
          <div className="flex items-center">
            <input
              type="text"
              value={(header.column.getFilterValue() as string) || ''}
              onChange={e => handleColumnFilterChange(header.column.id, e.target.value)}
              placeholder="Filter..."
              className="w-full px-2 py-1 text-xs border rounded-l focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={() => toggleFilterDropdown(header.column.id)}
              className="px-2 py-1 text-xs border border-l-0 rounded-r bg-gray-50 hover:bg-gray-100"
            >
              <Filter className="h-3 w-3" />
            </button>
          </div>
          
          {filterDropdownOpen[header.column.id] && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
              {getFilteredOptions(header.column.id, (header.column.getFilterValue() as string) || '').map((option: string) => (
                <div
                  key={option}
                  className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    handleColumnFilterChange(header.column.id, option);
                    toggleFilterDropdown(header.column.id);
                  }}
                >
                  {option}
                </div>
              ))}
              {getFilteredOptions(header.column.id, (header.column.getFilterValue() as string) || '').length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-500">No options found</div>
              )}
            </div>
          )}
          
          {header.column.getFilterValue() && (
            <button
              onClick={() => clearColumnFilter(header.column.id)}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </th>
  ), [filterDropdownOpen, handleColumnFilterChange, toggleFilterDropdown, clearColumnFilter, getFilteredOptions]);

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
        {(columnFilters.length > 0 || globalFilter) && (
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
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              {[10, 20, 30, 50].map(size => (
                <option key={size} value={size}>
                  Show {size}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-700">
              Page {pageIndex + 1} of {table.getPageCount()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={`p-1 rounded ${
                !table.getCanPreviousPage()
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className={`p-1 rounded ${
                !table.getCanNextPage()
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}