import React, { useState } from 'react';
import { Settings, X, Lock, Key, Trash2, GripVertical, AlertTriangle } from 'lucide-react';
import type { Table, Relationship } from '../types';
import type { DbEngine } from '../../utils/dbDataTypes';
import { DB_DATA_TYPES, shouldShowLength, isTypeValid } from '../../utils/dbDataTypes';

interface PropertiesPanelProps {
  selectedTable: Table;
  relationships: Relationship[];
  onClose: () => void;
  onUpdateTable: (id: string, field: string, value: string) => void;
  onAddColumn: (tableId: string) => void;
  onUpdateColumn: (tableId: string, colId: string, field: string, value: any) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onMoveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  width: number;
  onWidthChange: (width: number) => void;
  dbEngine: DbEngine;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedTable,
  relationships,
  onClose,
  onUpdateTable,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn,
  onMoveColumn,
  width,
  onWidthChange,
  dbEngine,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Get available types based on selected engine
  const availableTypes = DB_DATA_TYPES[dbEngine] || DB_DATA_TYPES['mysql'];

  return (
    <aside
      className="bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col shadow-xl z-20 shrink-0 transition-none h-full relative w-full md:w-auto"
      style={{ width: window.innerWidth >= 768 ? width : '100%' }}
    >
      {/* Resize Handle - Hidden on Mobile */}
      <div
        className="hidden md:block absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors z-50 -ml-0.5"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            const newWidth = Math.max(300, window.innerWidth - e.clientX);
            onWidthChange(newWidth);
          }
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      />

      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
        <h2 className="font-bold text-slate-700 dark:text-slate-100 text-sm flex items-center gap-2">
          <Settings size={16} /> Table Properties
        </h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Physical Name
            </span>
            <input
              type="text"
              value={selectedTable.name}
              onChange={(e) =>
                onUpdateTable(selectedTable.id, 'name', e.target.value.toUpperCase())
              }
              className="mt-1 block w-full rounded border-slate-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs py-2 px-2 border font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Logical Name
            </span>
            <input
              type="text"
              value={selectedTable.logicalName}
              onChange={(e) => onUpdateTable(selectedTable.id, 'logicalName', e.target.value)}
              className="mt-1 block w-full rounded border-slate-300 dark:border-slate-600 shadow-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs py-2 px-2 border"
            />
          </label>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2 border-b border-slate-100 dark:border-slate-700 pb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Columns
            </span>
            <button
              onClick={() => onAddColumn(selectedTable.id)}
              className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-3 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 font-bold border border-blue-100 dark:border-blue-800 transition-colors"
            >
              + ADD COLUMN
            </button>
          </div>

          <div className="space-y-3">
            {selectedTable.columns.map((col, index) => {
              const isLinkedFk = relationships.some(
                (r) => r.toTable === selectedTable.id && r.toCol === col.id,
              );
              const showLength = shouldShowLength(col.type);
              const isValid = isTypeValid(col.type, dbEngine);

              // Check if the exact string exists in options
              const isExactMatch = availableTypes.includes(col.type);

              return (
                <div
                  key={col.id}
                  draggable
                  onDragStart={() => setDraggedIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedIndex !== null && draggedIndex !== index) {
                      onMoveColumn(selectedTable.id, draggedIndex, index);
                    }
                    setDraggedIndex(null);
                  }}
                  className={`p-3 rounded border group relative hover:shadow-sm transition-all ${
                    draggedIndex === index ? 'opacity-50' : 'opacity-100'
                  } ${
                    isValid
                      ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600'
                      : 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-700'
                  }`}
                >
                  {/* Drag Handle */}
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300 p-1">
                    <GripVertical size={12} />
                  </div>

                  <div className="pl-4">
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-400 font-bold mb-0.5 block">
                          Physical
                        </label>
                        <input
                          value={col.name}
                          onChange={(e) =>
                            onUpdateColumn(selectedTable.id, col.id, 'name', e.target.value)
                          }
                          className="w-full text-xs p-1.5 border border-slate-300 dark:border-slate-600 rounded font-mono text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:border-blue-400 outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-400 font-bold mb-0.5 block">
                          Logical
                        </label>
                        <input
                          value={col.logicalName}
                          onChange={(e) =>
                            onUpdateColumn(selectedTable.id, col.id, 'logicalName', e.target.value)
                          }
                          className="w-full text-xs p-1.5 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:border-blue-400 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 items-end">
                      <div className="w-24 shrink-0 relative">
                        <label className="text-[9px] text-slate-400 font-bold mb-0.5 flex items-center gap-1">
                          Type 
                          {isLinkedFk && <Lock size={8} className="text-amber-500" />}
                          {!isValid && <AlertTriangle size={8} className="text-red-500" />}
                        </label>
                        <select
                          value={col.type}
                          disabled={isLinkedFk}
                          onChange={(e) =>
                            onUpdateColumn(selectedTable.id, col.id, 'type', e.target.value)
                          }
                          className={`w-full text-[10px] py-1.5 px-0.5 border rounded outline-none ${
                            isLinkedFk
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-300 dark:border-slate-600'
                              : isValid 
                                ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                                : 'bg-red-50 dark:bg-slate-800 text-red-600 border-red-400 font-bold'
                          }`}
                        >
                          {/* If the current type is not exactly in the list, add it as a preservation option */}
                          {!isExactMatch && (
                            <option 
                              value={col.type} 
                              className={isValid ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700 font-bold'}
                            >
                              {col.type} {isValid ? '' : '(Invalid)'}
                            </option>
                          )}
                          
                          {availableTypes.map((t, idx) => (
                            <option key={`${t}-${idx}`} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      {showLength && (
                        <div className="w-10 shrink-0 relative">
                          <label className="text-[9px] text-slate-400 font-bold mb-0.5 flex items-center gap-1">
                            Len
                          </label>
                          <input
                            placeholder={col.type.includes('CHAR') ? '255' : ''}
                            value={col.length}
                            disabled={isLinkedFk}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, 'length', e.target.value)
                            }
                            className={`w-full text-[10px] p-1.5 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-200 focus:border-blue-400 outline-none ${isLinkedFk ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`}
                          />
                        </div>
                      )}

                      <div className="flex flex-1 justify-end items-center gap-1.5 pb-0.5">
                        <label
                          className={`flex flex-col items-center group/chk ${col.isIdentity || col.isPk ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          title="Not Null"
                        >
                          <span className="text-[8px] font-bold text-slate-400 mb-0.5 group-hover/chk:text-blue-500">
                            NN
                          </span>
                          <input
                            type="checkbox"
                            checked={!col.isNullable}
                            disabled={col.isIdentity || col.isPk}
                            onChange={(e) =>
                              onUpdateColumn(
                                selectedTable.id,
                                col.id,
                                'isNullable',
                                !e.target.checked,
                              )
                            }
                            className={`w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 dark:bg-slate-700 ${col.isIdentity || col.isPk ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'cursor-pointer'}`}
                          />
                        </label>

                        <label
                          className="flex flex-col items-center cursor-pointer group/chk"
                          title="Unique"
                        >
                          <span className="text-[8px] font-bold text-slate-400 mb-0.5 group-hover/chk:text-green-600">
                            UQ
                          </span>
                          <input
                            type="checkbox"
                            checked={col.isUnique}
                            onChange={(e) =>
                              onUpdateColumn(selectedTable.id, col.id, 'isUnique', e.target.checked)
                            }
                            className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-green-600 focus:ring-0 cursor-pointer dark:bg-slate-700"
                          />
                        </label>

                        <label
                          className={`flex flex-col items-center group/chk ${col.isNullable || col.isFk ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          title={
                            col.isFk
                              ? `Foreign Keys cannot be ${dbEngine === 'mysql' ? 'Auto Increment' : 'Identity'}`
                              : (dbEngine === 'mysql' ? 'Auto Increment' : 'Identity')
                          }
                        >
                          <span className="text-[8px] font-bold text-slate-400 mb-0.5 group-hover/chk:text-purple-600">
                            {dbEngine === 'mysql' ? 'AI' : 'ID'}
                          </span>
                          <input
                            type="checkbox"
                            checked={col.isIdentity}
                            disabled={col.isNullable || col.isFk}
                            onChange={(e) =>
                              onUpdateColumn(
                                selectedTable.id,
                                col.id,
                                'isIdentity',
                                e.target.checked,
                              )
                            }
                            className={`w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-0 dark:bg-slate-700 ${col.isNullable || col.isFk ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'cursor-pointer'}`}
                          />
                        </label>

                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

                        <button
                          onClick={() =>
                            !col.isNullable &&
                            onUpdateColumn(selectedTable.id, col.id, 'isPk', !col.isPk)
                          }
                          disabled={col.isNullable}
                          className={`flex flex-col items-center justify-center w-8 h-8 rounded border transition-all ${col.isPk ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-500' : col.isNullable ? 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-500 hover:border-amber-300 hover:text-amber-400'}`}
                          title="Primary Key"
                        >
                          <Key size={14} fill={col.isPk ? 'currentColor' : 'none'} />
                          <span className="text-[7px] font-bold mt-0.5">PK</span>
                        </button>

                        <button
                          onClick={() => onDeleteColumn(selectedTable.id, col.id)}
                          className="flex flex-col items-center justify-center w-8 h-8 rounded border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default PropertiesPanel;