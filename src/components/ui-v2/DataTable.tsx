import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui-v2/EmptyState";

export type DataTableColumn<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No records found.",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-eiq-border bg-eiq-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-eiq-border">
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 font-medium text-eiq-text-secondary">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-eiq-border last:border-0 hover:bg-eiq-bg">
              {columns.map((col) => (
                <td key={col.header} className={col.className ?? "px-4 py-3 text-eiq-text-primary"}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
