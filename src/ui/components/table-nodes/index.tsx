import React from 'react';
import { Plus } from 'lucide-react';
import type { Table, ViewOptions, TempConnection } from '../../types';
import { TABLE_WIDTH } from '../../../utils/geometry';
import TableHeader from './TableHeader';
import TableBody from './TableBody';

interface TableNodeProps {
  table: Table;
  tables: Table[];
  isSelected: boolean;
  viewMode: string;
  viewOptions: ViewOptions;
  isConnecting: boolean;
  tempConnection: TempConnection | null;
  zoom: number;
  globalEditable: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onStartConnection: (
    e: React.PointerEvent,
    tableId: string,
    colId: string,
    side: 'left' | 'right',
  ) => void;
  onCompleteConnection: (e: React.PointerEvent, tableId: string, colId: string) => void;
  onCompleteNewColConnection: (e: React.PointerEvent, tableId: string) => void;
  onAddColumn: (tableId: string) => void;
  onUpdateTable: (id: string, field: string, value: any) => void;
  onUpdateColumn: (tableId: string, colId: string, field: string, value: any) => void;
  onMoveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onConfig: () => void;
}

const TableNode: React.FC<TableNodeProps> = ({
  table,
  tables,
  isSelected,
  viewMode,
  viewOptions,
  isConnecting,
  tempConnection,
  globalEditable,
  onPointerDown,
  onStartConnection,
  onCompleteConnection,
  onCompleteNewColConnection,
  onAddColumn,
  onUpdateTable,
  onUpdateColumn,
  onMoveColumn,
  onDeleteColumn,
  onConfig,
}) => {
  const isLocked = globalEditable || table.isManuallyEditable;

  return (
    <div
      onPointerDown={(e) => onPointerDown(e, table.id)}
      className={`absolute bg-white dark:bg-slate-800 border shadow-sm rounded-lg overflow-visible select-none transition-colors duration-200 group/table ${
        isSelected
          ? 'border-blue-500 shadow-xl ring-2 ring-blue-100 dark:ring-blue-900 z-10'
          : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 z-0'
      }`}
      style={{
        left: table.x,
        top: table.y,
        width: TABLE_WIDTH,
        cursor: isLocked ? 'default' : 'move',
      }}
    >
      <TableHeader
        table={table}
        tables={tables}
        viewMode={viewMode}
        isSelected={isSelected}
        isLocked={!!isLocked}
        onUpdateTable={onUpdateTable}
        onConfig={onConfig}
      />

      <TableBody
        table={table}
        viewMode={viewMode}
        viewOptions={viewOptions}
        isLocked={!!isLocked}
        isSelected={isSelected}
        isConnecting={isConnecting}
        tempConnection={tempConnection}
        onUpdateColumn={onUpdateColumn}
        onDeleteColumn={onDeleteColumn}
        onMoveColumn={onMoveColumn}
        onCompleteConnection={onCompleteConnection}
        onStartConnection={onStartConnection}
        onCompleteNewColConnection={onCompleteNewColConnection}
      />

      {/* Quick Add Column Button (Bottom Center) - Visible on hover OR when selected (Mobile friendly) */}
      <div
        className={`absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-200 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover/table:opacity-100'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAddColumn(table.id);
        }}
      >
        <div
          className="bg-blue-600 dark:bg-blue-500 text-white rounded-full p-1 shadow-md border-2 border-white dark:border-slate-700 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
          title="Quick Add Column"
        >
          <Plus size={14} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
};

export default TableNode;
