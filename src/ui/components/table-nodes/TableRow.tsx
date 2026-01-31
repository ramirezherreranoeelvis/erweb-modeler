import React from 'react';
import { Key, Trash2, GripVertical } from 'lucide-react';
import type { Column, ViewOptions } from '../../types';

interface TableRowProps {
  col: Column;
  index: number;
  tableId: string;
  viewMode: string;
  viewOptions: ViewOptions;
  isLocked: boolean;
  isSelected: boolean;
  isConnecting: boolean;
  draggedIndex: number | null;
  editingCell: { colId: string; field: 'name' | 'type' | 'length' } | null;
  editValue: string;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onCompleteConnection: (e: React.PointerEvent, tableId: string, colId: string) => void;
  onStartConnection: (
    e: React.PointerEvent,
    tableId: string,
    colId: string,
    side: 'left' | 'right',
  ) => void;
  onStartEditing: (colId: string, field: 'name' | 'type' | 'length', initialValue: string) => void;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onCancelEdit: () => void;
  onUpdateColumn: (tableId: string, colId: string, field: string, value: any) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
}

const TableRow: React.FC<TableRowProps> = ({
  col,
  index,
  tableId,
  viewMode,
  viewOptions,
  isLocked,
  isSelected,
  isConnecting,
  draggedIndex,
  editingCell,
  editValue,
  onDragStart,
  onDragOver,
  onDrop,
  onCompleteConnection,
  onStartConnection,
  onStartEditing,
  onEditChange,
  onEditSave,
  onCancelEdit,
  onDeleteColumn,
}) => {
  return (
    <div
      draggable={isLocked && !isConnecting}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className={`group/row relative flex items-center px-3 py-1 text-xs h-[28px] hover:bg-blue-50 dark:hover:bg-slate-700 border-b border-transparent hover:border-blue-100 dark:hover:border-slate-600 transition-colors ${
        draggedIndex === index ? 'opacity-30' : ''
      }`}
      onPointerUp={(e) => !col.isFk && onCompleteConnection(e, tableId, col.id)}
    >
      {/* Drag Grip - Visible on Hover only in Edit Mode */}
      {isLocked && (
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 cursor-grab text-slate-300 hover:text-slate-500">
          <GripVertical size={10} />
        </div>
      )}

      {/* Connection Dots: Only show if NOT an FK */}
      {!col.isFk && (
        <>
          <div
            className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white dark:border-slate-800 rounded-full cursor-crosshair shadow-sm z-20 hover:scale-125 transition-all ${
              isSelected ? 'block opacity-100' : 'hidden group-hover/row:block opacity-100'
            }`}
            onPointerDown={(e) => onStartConnection(e, tableId, col.id, 'left')}
          ></div>
          <div
            className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white dark:border-slate-800 rounded-full cursor-crosshair shadow-sm z-20 hover:scale-125 transition-all ${
              isSelected ? 'block opacity-100' : 'hidden group-hover/row:block opacity-100'
            }`}
            onPointerDown={(e) => onStartConnection(e, tableId, col.id, 'right')}
          ></div>
        </>
      )}

      <div className="w-10 shrink-0 flex items-center gap-0.5 ml-2">
        {viewOptions.showPk && col.isPk ? (
          <Key size={12} className="text-amber-500 rotate-45" fill="currentColor" />
        ) : (
          <span className="w-3"></span>
        )}
        {viewOptions.showFk && col.isFk && !col.isPk && (
          <div className="text-[8px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1 rounded border border-slate-200 dark:border-slate-600">
            FK
          </div>
        )}
      </div>

      {/* Column Name with Inline Edit */}
      <div
        className="flex-1 truncate mr-2"
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartEditing(col.id, 'name', col.name);
        }}
      >
        {editingCell?.colId === col.id && editingCell.field === 'name' ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onEditSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave();
              if (e.key === 'Escape') onCancelEdit();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full text-xs p-0 border-b border-blue-500 outline-none bg-transparent text-slate-900 dark:text-slate-100"
          />
        ) : (
          <span
            className={`${
              col.isPk
                ? 'font-bold text-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-300'
            } hover:text-blue-600 dark:hover:text-blue-400 cursor-text`}
          >
            {viewMode === 'physical' ? col.name : col.logicalName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 dark:text-slate-500">
        {viewMode === 'physical' && viewOptions.showTypes && (
          <>
            {/* Column Type with Inline Edit */}
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                onStartEditing(col.id, 'type', col.type);
              }}
            >
              {editingCell?.colId === col.id && editingCell.field === 'type' ? (
                <select
                  autoFocus
                  value={editValue}
                  onChange={(e) => {
                    onEditChange(e.target.value);
                    // Hack to trigger save immediately since select change blurs differently
                    // but we need to update state first in parent.
                    // We'll let the parent handle 'onChange' update then effect?
                    // For now, simpler:
                    setTimeout(() => onEditSave(), 0);
                  }}
                  onBlur={onEditSave}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-[9px] p-0 border border-blue-300 rounded outline-none bg-white dark:bg-slate-700 dark:text-white"
                >
                  {[
                    'INT',
                    'BIGINT',
                    'VARCHAR',
                    'CHAR',
                    'TEXT',
                    'DATETIME',
                    'DATE',
                    'DECIMAL',
                    'BOOLEAN',
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="cursor-pointer hover:text-blue-500 dark:hover:text-blue-400">
                  {col.type}
                </span>
              )}
            </div>

            {/* Column Length with Inline Edit */}
            {viewOptions.showLength && (
              <>
                {editingCell?.colId === col.id && editingCell.field === 'length' ? (
                  <span className="flex items-center">
                    (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => onEditChange(e.target.value)}
                      onBlur={onEditSave}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onEditSave();
                        if (e.key === 'Escape') onCancelEdit();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-6 text-[9px] p-0 border-b border-blue-500 outline-none bg-transparent text-center text-slate-900 dark:text-slate-100"
                    />
                    )
                  </span>
                ) : (
                  (col.length || ['VARCHAR', 'CHAR', 'DECIMAL'].includes(col.type)) && (
                    <span
                      className={`text-slate-300 dark:text-slate-500 ${
                        !['INT', 'BIGINT', 'TEXT', 'DATETIME', 'BOOLEAN', 'DATE'].includes(col.type)
                          ? 'cursor-pointer hover:text-blue-400 dark:hover:text-blue-400'
                          : ''
                      }`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (
                          !['INT', 'BIGINT', 'TEXT', 'DATETIME', 'BOOLEAN', 'DATE'].includes(
                            col.type,
                          )
                        ) {
                          onStartEditing(col.id, 'length', col.length);
                        }
                      }}
                    >
                      ({col.length})
                    </span>
                  )
                )}
              </>
            )}
          </>
        )}
        {viewOptions.showIdentity && col.isIdentity && (
          <span
            className="ml-1 text-[8px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1 rounded border border-purple-200 dark:border-purple-800 font-bold"
            title="Identity"
          >
            ID
          </span>
        )}
        {viewOptions.showUnique && col.isUnique && (
          <span
            className="ml-0.5 text-[8px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1 rounded border border-green-200 dark:border-green-800 font-bold"
            title="Unique"
          >
            UQ
          </span>
        )}
        {viewOptions.showNulls && (
          <span
            className={`ml-1 ${
              col.isNullable
                ? 'text-blue-300 dark:text-blue-700'
                : 'text-slate-300 dark:text-slate-500 font-bold'
            }`}
          >
            {col.isNullable ? 'NULL' : 'NN'}
          </span>
        )}
      </div>

      {/* Delete Column Button - Always Visible on Hover (Desktop) or if row is interacted */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDeleteColumn(tableId, col.id);
        }}
        className="absolute right-0 top-0 bottom-0 w-7 flex items-center justify-center bg-white/90 dark:bg-slate-800/90 opacity-0 group-hover/row:opacity-100 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer transition-all border-l border-slate-100 dark:border-slate-700"
      >
        <Trash2 size={12} />
      </div>
    </div>
  );
};

export default TableRow;
