import React, { useState, useEffect } from 'react';
import { Key, CopyPlus, Plus, Trash2, GripVertical, Edit3, Settings } from 'lucide-react';
import type { Table, ViewOptions, TempConnection } from '../types';
import { TABLE_WIDTH } from '../utils/geometry';

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
  onStartConnection: (e: React.PointerEvent, tableId: string, colId: string, side: 'left' | 'right') => void;
  onCompleteConnection: (e: React.MouseEvent, tableId: string, colId: string) => void;
  onCompleteNewColConnection: (e: React.MouseEvent, tableId: string) => void;
  onAddColumn: (tableId: string) => void;
  onUpdateTable: (id: string, field: string, value: any) => void;
  onUpdateColumn: (tableId: string, colId: string, field: string, value: any) => void;
  onMoveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onConfig: () => void;
}

interface EditingCell {
  colId: string;
  field: 'name' | 'type' | 'length';
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
  onConfig
}) => {
  const [isEditingTableName, setIsEditingTableName] = useState(false);
  const [editTableNameValue, setEditTableNameValue] = useState(table.name);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Column Inline Editing State
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');

  // Determine if this specific table is editable/locked (Blue Pencil Mode or Global Mode)
  // If Locked (Edit Mode): Table Position Locked. 
  // ONLY Column Dragging requires this to be true.
  const isLocked = globalEditable || table.isManuallyEditable;

  useEffect(() => {
    if (!isEditingTableName) {
      setEditTableNameValue(table.name);
    }
  }, [table.name, isEditingTableName]);

  // Handle Table Name
  const handleTableNameSubmit = () => {
    if (editTableNameValue.trim() && !isDuplicateName(editTableNameValue)) {
      onUpdateTable(table.id, 'name', editTableNameValue.toUpperCase());
    } else {
       setEditTableNameValue(table.name); 
    }
    setIsEditingTableName(false);
  };

  const isDuplicateName = (name: string) => {
    return tables.some(t => t.id !== table.id && t.name.toLowerCase() === name.toLowerCase());
  };

  // Handle Column Inline Editing
  const startEditingColumn = (colId: string, field: 'name' | 'type' | 'length', initialValue: string) => {
    setEditingCell({ colId, field });
    setEditValue(initialValue);
  };

  const handleColumnSave = () => {
    if (editingCell) {
        onUpdateColumn(table.id, editingCell.colId, editingCell.field, editValue);
        setEditingCell(null);
    }
  };

  return (
    <div 
      onPointerDown={(e) => onPointerDown(e, table.id)} 
      // Changed transition-all to transition-colors and transition-shadow to avoid animating 'left' and 'top' which causes drag lag
      className={`absolute bg-white dark:bg-slate-800 border shadow-sm rounded-lg overflow-visible select-none transition-colors duration-200 group/table ${isSelected ? 'border-blue-500 shadow-xl ring-2 ring-blue-100 dark:ring-blue-900 z-10' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 z-0'}`} 
      style={{ 
          left: table.x, 
          top: table.y, 
          width: TABLE_WIDTH,
          cursor: isLocked ? 'default' : 'move' 
      }}
    >
      <div 
         className={`px-3 py-2 border-b border-slate-200 dark:border-slate-700 rounded-t-lg flex justify-between items-center ${isSelected ? 'bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-800' : 'bg-slate-50 dark:bg-slate-800'}`}
         onDoubleClick={(e) => {
            e.stopPropagation();
            if (viewMode === 'physical') {
                setIsEditingTableName(true);
            }
         }}
      >
        <div className="flex-1 min-w-0 mr-2">
            {isEditingTableName ? (
            <input 
                autoFocus
                value={editTableNameValue}
                onChange={(e) => setEditTableNameValue(e.target.value)}
                onBlur={handleTableNameSubmit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTableNameSubmit();
                    if (e.key === 'Escape') {
                        setEditTableNameValue(table.name);
                        setIsEditingTableName(false);
                    }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={`w-full text-sm font-bold bg-white dark:bg-slate-900 border rounded px-1 outline-none ${isDuplicateName(editTableNameValue) ? 'border-red-500 text-red-600' : 'border-blue-400 text-slate-800 dark:text-slate-100'}`}
            />
            ) : (
            <div 
                className={`font-bold text-sm truncate leading-tight cursor-text ${isLocked ? 'text-blue-800 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`} 
                title={isLocked ? "Table locked. Double click to rename" : "Double click to rename"}
            >
                {viewMode === 'physical' ? table.name : table.logicalName}
            </div>
            )}
            
            {viewMode === 'logical' && <div className="text-[10px] text-slate-400 font-mono truncate">{table.name}</div>}
        </div>
        
        <div className="flex items-center gap-1">
            {/* Settings Button - Only visible on mobile (hidden on md and up) */}
            <button
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={(e) => {
                e.stopPropagation(); 
                onConfig();
            }}
            className={`md:hidden p-1 rounded-md transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700`}
            title="Configure Table"
            >
            <Settings size={12} />
            </button>

            {/* Local Edit Toggle Button */}
            <button
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={(e) => {
                e.stopPropagation(); 
                onUpdateTable(table.id, 'isManuallyEditable', !table.isManuallyEditable);
            }}
            className={`p-1 rounded-md transition-colors ${table.isManuallyEditable ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            title={table.isManuallyEditable ? "Editable (Table Locked, Columns Reorderable)" : "Read-only (Table Draggable, Columns Fixed)"}
            >
            <Edit3 size={12} />
            </button>
        </div>
      </div>
      
      <div className="flex flex-col bg-white dark:bg-slate-800 rounded-b-lg pb-1 relative">
         {table.columns.map((col, index) => (
            <div 
              key={col.id} 
              draggable={isLocked && !isConnecting} // Only draggable in Edit Mode
              onDragStart={(e) => {
                if (isConnecting || !isLocked) {
                    e.preventDefault();
                    return;
                }
                e.stopPropagation(); 
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                 e.preventDefault();
                 e.stopPropagation();
              }}
              onDrop={(e) => {
                 e.stopPropagation();
                 if (isLocked && draggedIndex !== null && draggedIndex !== index) {
                    onMoveColumn(table.id, draggedIndex, index);
                 }
                 setDraggedIndex(null);
              }}
              className={`group/row relative flex items-center px-3 py-1 text-xs h-[28px] hover:bg-blue-50 dark:hover:bg-slate-700 border-b border-transparent hover:border-blue-100 dark:hover:border-slate-600 transition-colors ${draggedIndex === index ? 'opacity-30' : ''}`} 
              onMouseUp={(e) => !col.isFk && onCompleteConnection(e, table.id, col.id)}
            >
               {/* Drag Grip - Visible on Hover only in Edit Mode */}
               {isLocked && (
                   <div className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 cursor-grab text-slate-300 hover:text-slate-500">
                      <GripVertical size={10} />
                   </div>
               )}

               {/* Connection Dots: Only show if NOT an FK */}
               {/* MODIFIED: Used onPointerDown and conditional opacity based on isSelected for Mobile support */}
               {!col.isFk && (
                 <>
                   <div 
                    className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white dark:border-slate-800 rounded-full cursor-crosshair shadow-sm z-20 hover:scale-125 transition-all ${isSelected ? 'block opacity-100' : 'hidden group-hover/row:block opacity-100'}`} 
                    onPointerDown={(e) => onStartConnection(e, table.id, col.id, 'left')}
                   ></div>
                   <div 
                    className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white dark:border-slate-800 rounded-full cursor-crosshair shadow-sm z-20 hover:scale-125 transition-all ${isSelected ? 'block opacity-100' : 'hidden group-hover/row:block opacity-100'}`} 
                    onPointerDown={(e) => onStartConnection(e, table.id, col.id, 'right')}
                   ></div>
                 </>
               )}
               
               <div className="w-10 shrink-0 flex items-center gap-0.5 ml-2">
                  {viewOptions.showPk && col.isPk ? <Key size={12} className="text-amber-500 rotate-45" fill="currentColor" /> : <span className="w-3"></span>}
                  {viewOptions.showFk && col.isFk && !col.isPk && <div className="text-[8px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1 rounded border border-slate-200 dark:border-slate-600">FK</div>}
               </div>
               
               {/* Column Name with Inline Edit */}
               <div className="flex-1 truncate mr-2" onDoubleClick={(e) => { e.stopPropagation(); startEditingColumn(col.id, 'name', col.name); }}>
                 {editingCell?.colId === col.id && editingCell.field === 'name' ? (
                     <input 
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleColumnSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleColumnSave();
                            if (e.key === 'Escape') setEditingCell(null);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full text-xs p-0 border-b border-blue-500 outline-none bg-transparent text-slate-900 dark:text-slate-100"
                     />
                 ) : (
                     <span className={`${col.isPk ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'} hover:text-blue-600 dark:hover:text-blue-400 cursor-text`}>
                        {viewMode === 'physical' ? col.name : col.logicalName}
                     </span>
                 )}
               </div>
               
               <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 dark:text-slate-500">
                 {viewMode === 'physical' && viewOptions.showTypes && (
                   <>
                     {/* Column Type with Inline Edit */}
                     <div onDoubleClick={(e) => { e.stopPropagation(); startEditingColumn(col.id, 'type', col.type); }}>
                        {editingCell?.colId === col.id && editingCell.field === 'type' ? (
                            <select 
                                autoFocus
                                value={editValue}
                                onChange={(e) => { setEditValue(e.target.value); setTimeout(() => handleColumnSave(), 0); }} // Save immediately on selection
                                onBlur={handleColumnSave}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-[9px] p-0 border border-blue-300 rounded outline-none bg-white dark:bg-slate-700 dark:text-white"
                            >
                                {['INT', 'BIGINT', 'VARCHAR', 'CHAR', 'TEXT', 'DATETIME', 'DATE', 'DECIMAL', 'BOOLEAN'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        ) : (
                            <span className="cursor-pointer hover:text-blue-500 dark:hover:text-blue-400">{col.type}</span>
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
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleColumnSave}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleColumnSave();
                                        if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="w-6 text-[9px] p-0 border-b border-blue-500 outline-none bg-transparent text-center text-slate-900 dark:text-slate-100"
                                />
                                )
                            </span>
                         ) : (
                            (col.length || ['VARCHAR', 'CHAR', 'DECIMAL'].includes(col.type)) && (
                                <span 
                                    className={`text-slate-300 dark:text-slate-500 ${!['INT', 'BIGINT', 'TEXT', 'DATETIME', 'BOOLEAN', 'DATE'].includes(col.type) ? 'cursor-pointer hover:text-blue-400 dark:hover:text-blue-400' : ''}`}
                                    onDoubleClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (!['INT', 'BIGINT', 'TEXT', 'DATETIME', 'BOOLEAN', 'DATE'].includes(col.type)) {
                                            startEditingColumn(col.id, 'length', col.length); 
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
                 {viewOptions.showIdentity && col.isIdentity && <span className="ml-1 text-[8px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1 rounded border border-purple-200 dark:border-purple-800 font-bold" title="Identity">ID</span>}
                 {viewOptions.showUnique && col.isUnique && <span className="ml-0.5 text-[8px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1 rounded border border-green-200 dark:border-green-800 font-bold" title="Unique">UQ</span>}
                 {viewOptions.showNulls && <span className={`ml-1 ${col.isNullable ? 'text-blue-300 dark:text-blue-700' : 'text-slate-300 dark:text-slate-500 font-bold'}`}>{col.isNullable ? 'NULL' : 'NN'}</span>}
               </div>

               {/* Delete Column Button - Always Visible on Hover */}
               <div 
                 onMouseDown={(e) => e.stopPropagation()}
                 onClick={(e) => { e.stopPropagation(); onDeleteColumn(table.id, col.id); }}
                 className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center bg-white/80 dark:bg-slate-800/80 opacity-0 group-hover/row:opacity-100 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer transition-all"
               >
                  <Trash2 size={12} />
               </div>
            </div>
         ))}
         
         {/* DROP ZONE FOR NEW COLUMN */}
         {isConnecting && tempConnection && tempConnection.sourceTableId !== table.id && (
           <div 
             className="flex items-center justify-center h-[28px] mx-1 mb-1 mt-1 bg-green-50 dark:bg-green-900/20 border border-dashed border-green-300 dark:border-green-700 rounded hover:bg-green-100 dark:hover:bg-green-900/40 cursor-copy transition-colors animate-pulse"
             onMouseUp={(e) => onCompleteNewColConnection(e, table.id)}
             title="Drop to create new FK column automatically"
           >
              <CopyPlus size={14} className="text-green-600 dark:text-green-400 mr-1.5" />
              <span className="text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-tight">New FK Column</span>
           </div>
         )}
      </div>

      {/* Quick Add Column Button (Bottom Center) - Always available */}
      <div 
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/table:opacity-100 transition-opacity duration-200"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAddColumn(table.id);
        }}
      >
        <div className="bg-blue-600 dark:bg-blue-500 text-white rounded-full p-1 shadow-md border-2 border-white dark:border-slate-700 hover:scale-110 active:scale-95 transition-transform cursor-pointer" title="Quick Add Column">
          <Plus size={14} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
};

export default TableNode;