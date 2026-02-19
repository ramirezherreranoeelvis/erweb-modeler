
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Table, ViewOptions, TempConnection } from '../../types';
import { TABLE_WIDTH } from '../../../utils/geometry';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import type { DbEngine } from '../../../utils/dbDataTypes';

interface TableNodeProps {
  table: Table;
  tables: Table[];
  isSelected: boolean;
  viewMode: string;
  viewOptions: ViewOptions;
  isConnecting: boolean;
  tempConnection: TempConnection | null;
  zoom: number;
  dbEngine: DbEngine;
  globalEditable: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onStartConnection: (
    e: React.PointerEvent,
    tableId: string,
    colId: string,
    side: 'left' | 'right' | 'top' | 'bottom',
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
  dbEngine,
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
  const [isExpanded, setIsExpanded] = useState(false);
  const isLocked = globalEditable || table.isManuallyEditable;

  // Handler for Table-Level Connection Points (Source)
  const handleTableConnectionStart = (
    e: React.PointerEvent,
    side: 'left' | 'right' | 'top' | 'bottom',
  ) => {
    e.stopPropagation();
    const pkCol = table.columns.find((c) => c.isPk);
    if (pkCol) {
      onStartConnection(e, table.id, pkCol.id, side);
    }
  };

  // Handler for Table-Level Drop (Target)
  const handleTableConnectionDrop = (e: React.PointerEvent) => {
    if (isConnecting && tempConnection && tempConnection.sourceTableId !== table.id) {
      e.stopPropagation();
      onCompleteNewColConnection(e, table.id);
    }
  };

  const currentMode = viewOptions.connectionMode || 'table';
  const showTableConnectors = currentMode === 'table' && !table.id.startsWith('virt_');

  const pointConnectionClass = `absolute w-3 h-3 bg-blue-500 border-2 border-white dark:border-slate-800 rounded-full cursor-crosshair shadow-sm z-50 transition-all duration-200 hover:scale-125 ${
    isSelected
      ? 'opacity-100 scale-100'
      : 'opacity-0 scale-50 group-hover/table:opacity-100 group-hover/table:scale-100'
  }`;

  return (
    <div
      onPointerDown={(e) => onPointerDown(e, table.id)}
      onPointerUp={handleTableConnectionDrop}
      onContextMenu={(e) => {
        // Prevent default context menu ONLY if Ctrl/Meta is held,
        // allowing the user to use Ctrl+Right Click for selection if they wish.
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
        }
      }}
      className={`absolute bg-white dark:bg-slate-800 border shadow-sm rounded-lg overflow-visible select-none group/table ${
        isSelected
          ? 'border-blue-500 shadow-xl ring-2 ring-blue-100 dark:ring-blue-900 z-30'
          : isExpanded 
            ? 'border-slate-300 dark:border-slate-600 z-20' 
            : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 z-10'
      }`}
      style={{
        left: table.x,
        top: table.y,
        width: isExpanded ? 'auto' : TABLE_WIDTH,
        minWidth: TABLE_WIDTH,
        maxWidth: '600px', // Prevent it from getting absurdly wide
        cursor: isLocked ? 'default' : 'move',
      }}
    >
      <TableHeader
        table={table}
        tables={tables}
        viewMode={viewMode}
        isSelected={isSelected}
        isLocked={!!isLocked}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
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
        isExpanded={isExpanded}
        tempConnection={tempConnection}
        dbEngine={dbEngine}
        onUpdateColumn={onUpdateColumn}
        onDeleteColumn={onDeleteColumn}
        onMoveColumn={onMoveColumn}
        onCompleteConnection={onCompleteConnection}
        onStartConnection={onStartConnection}
        onCompleteNewColConnection={onCompleteNewColConnection}
      />

      {/* TABLE LEVEL CONNECTION POINTS (Only in Table Mode) */}
      {table.columns.length > 0 && showTableConnectors && (
        <>
          <div
            className={`${pointConnectionClass} -left-1.5 top-1/2 -translate-y-1/2`}
            onPointerDown={(e) => handleTableConnectionStart(e, 'left')}
            title="Connect (Source: PK)"
          />
          <div
            className={`${pointConnectionClass} -right-1.5 top-1/2 -translate-y-1/2`}
            onPointerDown={(e) => handleTableConnectionStart(e, 'right')}
            title="Connect (Source: PK)"
          />
          <div
            className={`${pointConnectionClass} left-1/2 -top-1.5 -translate-x-1/2`}
            onPointerDown={(e) => handleTableConnectionStart(e, 'top')}
            title="Connect (Source: PK)"
          />
          <div
            className={`${pointConnectionClass} left-1/2 -bottom-1.5 -translate-x-1/2`}
            onPointerDown={(e) => handleTableConnectionStart(e, 'bottom')}
            title="Connect (Source: PK)"
          />
        </>
      )}

      {/* Quick Add Column Button */}
      {isLocked && (
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
      )}
    </div>
  );
};

export default TableNode;
