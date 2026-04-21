'use client';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  keyField?: string;
}

export default function DataTable<T extends Record<string, unknown>>({ columns, data, onRowClick, keyField = 'id' }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map(col => (
              <th key={col.key} className={`text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={String(item[keyField])} onClick={() => onRowClick?.(item)}
                className={`border-b border-gray-200 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} transition`}>
              {columns.map(col => (
                <td key={col.key} className={`py-3 px-4 text-gray-600 ${col.className || ''}`}>
                  {col.render ? col.render(item) : String(item[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
