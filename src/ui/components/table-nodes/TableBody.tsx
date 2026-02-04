import React, { useState } from 'react';
import { CopyPlus } from 'lucide-react';
import type { Table, ViewOptions, TempConnection } from '../../types';
import TableRow from './TableRow';
import { DbEngine } from '../../../utils/dbDataTypes';

interface TableBodyProps {
  table: Table;
  viewMode: string;
  viewOptions: ViewOptions;
  isLocked: boolean;
  isSelected: boolean;
  isConnecting: boolean;
  tempConnection: TempConnection | null;
  dbEngine: DbEngine;
  onUpdateColumn: (tableId: string, colId: string, field: string, value: any) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onMoveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  onCompleteConnection: (e: React.PointerEvent, tableId: string, colId: string) => void;
  onStartConnection: (
    e: React.PointerEvent,
    tableId: string,
    colId: string,
    side: 'left' | 'right',
  ) => void;
  onCompleteNewColConnection: (e: React.PointerEvent, tableId: string) => void;
}

interface EditingCell {
  colId: string;
  field: 'name' | 'type' | 'length';
}

const TableBody: React.FC<TableBodyProps> = ({
  table,
  viewMode,
  viewOptions,
  isLocked,
  isSelected,
  isConnecting,
  tempConnection,
  dbEngine,
  onUpdateColumn,
  onDeleteColumn,
  onMoveColumn,
  onCompleteConnection,
  onStartConnection,
  onCompleteNewColConnection,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEditing = (
    colId: string,
    field: 'name' | 'type' | 'length',
    initialValue: string,
  ) => {
    setEditingCell({ colId, field });
    setEditValue(initialValue);
  };

  const handleEditSave = () => {
    if (editingCell) {
      onUpdateColumn(table.id, editingCell.colId, editingCell.field, editValue);
      setEditingCell(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isConnecting || !isLocked) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    if (isLocked && draggedIndex !== null && draggedIndex !== index) {
      onMoveColumn(table.id, draggedIndex, index);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800 rounded-b-lg pb-1 relative">
      {table.columns.map((col, index) => (
        <TableRow
          key={col.id}
          col={col}
          index={index}
          tableId={table.id}
          viewMode={viewMode}
          viewOptions={viewOptions}
          isLocked={isLocked}
          isSelected={isSelected}
          isConnecting={isConnecting}
          draggedIndex={draggedIndex}
          editingCell={editingCell}
          editValue={editValue}
          dbEngine={dbEngine}
          onDragStart={handleDragStart}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={handleDrop}
          onCompleteConnection={onCompleteConnection}
          onStartConnection={onStartConnection}
          onStartEditing={handleStartEditing}
          onEditChange={setEditValue}
          onEditSave={handleEditSave}
          onCancelEdit={() => setEditingCell(null)}
          onUpdateColumn={onUpdateColumn}
          onDeleteColumn={onDeleteColumn}
        />
      ))}

      {/* DROP ZONE FOR NEW COLUMN */}
      {isConnecting && tempConnection && tempConnection.sourceTableId !== table.id && (
        <div
          className="flex items-center justify-center h-[28px] mx-1 mb-1 mt-1 bg-green-50 dark:bg-green-900/20 border border-dashed border-green-300 dark:border-green-700 rounded hover:bg-green-100 dark:hover:bg-green-900/40 cursor-copy transition-colors animate-pulse"
          onPointerUp={(e) => onCompleteNewColConnection(e, table.id)}
          title="Drop to create new FK column automatically"
        >
          <CopyPlus size={14} className="text-green-600 dark:text-green-400 mr-1.5" />
          <span className="text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-tight">
            New FK Column
          </span>
        </div>
      )}
    </div>
  );
};

export default TableBody;