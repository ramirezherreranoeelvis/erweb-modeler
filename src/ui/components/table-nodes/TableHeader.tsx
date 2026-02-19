
import React, { useState, useEffect } from 'react';
import { Settings, Edit3, Maximize2, Minimize2 } from 'lucide-react';
import type { Table } from '../../types';

interface TableHeaderProps {
  table: Table;
  tables: Table[];
  viewMode: string;
  isSelected: boolean;
  isLocked: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onUpdateTable: (id: string, field: string, value: any) => void;
  onConfig: () => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  table,
  tables,
  viewMode,
  isSelected,
  isLocked,
  isExpanded = false,
  onToggleExpand,
  onUpdateTable,
  onConfig,
}) => {
  const [isEditingTableName, setIsEditingTableName] = useState(false);
  const [editTableNameValue, setEditTableNameValue] = useState(
    viewMode === 'physical' ? table.name : table.logicalName,
  );

  useEffect(() => {
    if (!isEditingTableName) {
      setEditTableNameValue(viewMode === 'physical' ? table.name : table.logicalName);
    }
  }, [table.name, table.logicalName, viewMode, isEditingTableName]);

  const isDuplicateName = (name: string) => {
    return tables.some((t) => t.id !== table.id && t.name.toLowerCase() === name.toLowerCase());
  };

  const handleTableNameSubmit = () => {
    const trimmedVal = editTableNameValue.trim();
    if (!trimmedVal) {
      setEditTableNameValue(viewMode === 'physical' ? table.name : table.logicalName);
      setIsEditingTableName(false);
      return;
    }

    if (viewMode === 'physical') {
      if (!isDuplicateName(trimmedVal)) {
        onUpdateTable(table.id, 'name', trimmedVal.toUpperCase());
      } else {
        setEditTableNameValue(table.name);
      }
    } else {
      onUpdateTable(table.id, 'logicalName', trimmedVal);
    }
    setIsEditingTableName(false);
  };

  return (
    <div
      className={`px-3 py-2 border-b border-slate-200 dark:border-slate-700 rounded-t-lg flex justify-between items-center ${
        isSelected
          ? 'bg-linear-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-800'
          : 'bg-slate-50 dark:bg-[#111b33]'
      }`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditingTableName(true);
        setEditTableNameValue(viewMode === 'physical' ? table.name : table.logicalName);
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
                setEditTableNameValue(viewMode === 'physical' ? table.name : table.logicalName);
                setIsEditingTableName(false);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`w-full text-sm font-bold bg-white dark:bg-slate-900 border rounded px-1 outline-none ${
              viewMode === 'physical' && isDuplicateName(editTableNameValue)
                ? 'border-red-500 text-red-600'
                : 'border-blue-400 text-slate-800 dark:text-slate-100'
            }`}
          />
        ) : (
          <div
            className={`font-bold text-sm truncate leading-tight cursor-text ${
              isLocked ? 'text-blue-800 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'
            }`}
            title={isLocked ? 'Table locked. Double click to rename' : 'Double click to rename'}
          >
            {viewMode === 'physical' ? table.name : table.logicalName}
          </div>
        )}

        {viewMode === 'logical' && (
          <div className="text-[10px] text-slate-400 font-mono truncate">{table.name}</div>
        )}
      </div>

      <div
        className={`flex items-center gap-1 transition-opacity duration-200 ${
          isSelected || isExpanded ? 'opacity-100' : 'opacity-0 group-hover/table:opacity-100'
        }`}
      >
        {onToggleExpand && (
            <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
            }}
            className={`p-1.5 rounded-md transition-colors ${
                isExpanded 
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title={isExpanded ? "Collapse Table" : "Expand Table"}
            >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
        )}

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onConfig();
          }}
          className="md:hidden p-1.5 rounded-md transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          title="Configure Table"
        >
          <Settings size={14} />
        </button>

        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onUpdateTable(table.id, 'isManuallyEditable', !table.isManuallyEditable);
          }}
          className={`p-1.5 rounded-md transition-colors ${
            table.isManuallyEditable
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
              : 'text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title={
            table.isManuallyEditable
              ? 'Editable (Table Locked, Columns Reorderable)'
              : 'Read-only (Table Draggable, Columns Fixed)'
          }
        >
          <Edit3 size={14} />
        </button>
      </div>
    </div>
  );
};

export default TableHeader;
