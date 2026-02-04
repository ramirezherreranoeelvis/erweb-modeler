import React from 'react';
import { Plus } from 'lucide-react';
import type { Table, ViewOptions, TempConnection } from '../../types';
import { TABLE_WIDTH } from '../../../utils/geometry';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import { DbEngine } from '../../../utils/dbDataTypes';

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
  const isLocked = globalEditable || table.isManuallyEditable;

  // Handler for Table-Level Connection Points (Source)
  // Logic: Automatically finds the PK to start the connection
  const handleTableConnectionStart = (e: React.PointerEvent, side: 'left' | 'right' | 'top' | 'bottom') => {
      e.stopPropagation();
      const pkCol = table.columns.find(c => c.isPk);
      if (pkCol) {
          onStartConnection(e, table.id, pkCol.id, side);
      }
  };

  // Handler for Table-Level Drop (Target)
  const handleTableConnectionDrop = (e: React.PointerEvent) => {
      // Only trigger if we are connecting AND the source is a different table
      if (isConnecting && tempConnection && tempConnection.sourceTableId !== table.id) {
          e.stopPropagation();
          onCompleteNewColConnection(e, table.id);
      }
  };

  // Fallback to 'table' mode if undefined to handle HMR or initial state edge cases
  const currentMode = viewOptions.connectionMode || 'table';
  const showTableConnectors = currentMode === 'table' && !table.id.startsWith('virt_');
  
  // Style for the connector dots - Larger (w-5 h-5) and z-[100] to force visibility
  const dotClass = `absolute w-5 h-5 bg-blue-500 border-2 border-white dark:border-slate-800 rounded-full cursor-crosshair z-[100] shadow-md transition-transform duration-200 hover:scale-125`;
  
  return (
    <div
      onPointerDown={(e) => onPointerDown(e, table.id)}
      onPointerUp={handleTableConnectionDrop} 
      className={`absolute bg-white dark:bg-slate-800 border shadow-sm rounded-lg overflow-visible select-none transition-colors duration-200 group/table ${
        isSelected
          ? 'border-blue-500 shadow-xl ring-2 ring-blue-100 dark:ring-blue-900 z-30'
          : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 z-10'
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
        dbEngine={dbEngine}
        onUpdateColumn={onUpdateColumn}
        onDeleteColumn={onDeleteColumn}
        onMoveColumn={onMoveColumn}
        onCompleteConnection={onCompleteConnection}
        onStartConnection={onStartConnection}
        onCompleteNewColConnection={onCompleteNewColConnection}
      />

      {/* TABLE LEVEL CONNECTION POINTS (Only in Table Mode) */}
      {/* Moved to bottom of JSX to ensuring stacking on top */}
      {showTableConnectors && (
          <>
             {/* Left - Centered on border (-left-2.5 = -10px for 20px dot) */}
             <div 
                className={`${dotClass} -left-2.5 top-1/2 -translate-y-1/2`}
                onPointerDown={(e) => handleTableConnectionStart(e, 'left')}
                title="Connect (Source: PK)"
             />

             {/* Right - Centered on border (-right-2.5) */}
             <div 
                className={`${dotClass} -right-2.5 top-1/2 -translate-y-1/2`}
                onPointerDown={(e) => handleTableConnectionStart(e, 'right')}
                title="Connect (Source: PK)"
             />

             {/* Top - Centered on border (-top-2.5) */}
             <div 
                className={`${dotClass} left-1/2 -top-2.5 -translate-x-1/2`}
                onPointerDown={(e) => handleTableConnectionStart(e, 'top')}
                title="Connect (Source: PK)"
             />

             {/* Bottom - Centered on border (-bottom-2.5) */}
             <div 
                className={`${dotClass} left-1/2 -bottom-2.5 -translate-x-1/2`}
                onPointerDown={(e) => handleTableConnectionStart(e, 'bottom')}
                title="Connect (Source: PK)"
             />
          </>
      )}

      {/* Quick Add Column Button (Bottom Center) - Only Visible when Locked (Editable) */}
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