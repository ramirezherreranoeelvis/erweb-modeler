
import React from 'react';
import { Plus, Trash2, Eye, GitMerge, Edit3, Lock, Grid, Table2, List } from 'lucide-react';
import type { ViewOptions } from '../types';

interface SidebarProps {
  isOpen: boolean;
  globalEditable: boolean;
  setGlobalEditable: (value: boolean) => void;
  onAddTable: () => void;
  onDeleteTable: () => void;
  selectedId: string | null;
  viewOptions: ViewOptions;
  setViewOptions: (options: ViewOptions) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  globalEditable,
  setGlobalEditable,
  onAddTable,
  onDeleteTable,
  selectedId,
  viewOptions,
  setViewOptions,
}) => {
  return (
    <aside
      className={`
      fixed top-14 bottom-0 left-0 w-64 md:w-56 z-30
      bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 
      flex flex-col p-3 shadow-xl md:shadow-sm md:static shrink-0 gap-4 overflow-y-auto transition-transform duration-300
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}
    >
      {/* Global Edit Mode Checkbox */}
      <button
        onClick={() => setGlobalEditable(!globalEditable)}
        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
          globalEditable
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
        }`}
      >
        <div
          className={`p-2 rounded-full ${
            globalEditable
              ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
          }`}
        >
          {globalEditable ? <Edit3 size={16} /> : <Lock size={16} />}
        </div>
        <div className="text-left">
          <div
            className={`text-xs font-bold ${
              globalEditable
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Global Edit Mode
          </div>
          <div className="text-[9px] text-slate-400 leading-none mt-0.5">
            {globalEditable ? 'All tables unlocked' : 'Manual selection'}
          </div>
        </div>
      </button>

      {/* Desktop-only Buttons */}
      <div className="hidden md:grid grid-cols-2 gap-2">
        <button
          onClick={onAddTable}
          className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-blue-700 dark:text-blue-300 transition-all gap-1 group"
        >
          <Plus size={20} /> <span className="text-[10px] font-bold">New Table</span>
        </button>
        <button
          onClick={onDeleteTable}
          disabled={!selectedId}
          className={`flex flex-col items-center justify-center p-3 border rounded-lg transition-all gap-1 ${
            selectedId
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
        >
          <Trash2 size={20} /> <span className="text-[10px] font-bold">Delete</span>
        </button>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700"></div>
      <div>
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
          <Eye size={12} /> View Options
        </h3>
        <div className="space-y-2">
          {Object.entries(viewOptions).map(([key, val]) => {
            // REMOVED snapToGrid from display
            if (key === 'lineStyle' || key === 'gridStyle' || key === 'connectionMode' || key === 'snapToGrid') return null;
            return (
              <label
                key={key}
                className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400"
              >
                <input
                  type="checkbox"
                  checked={val as boolean}
                  onChange={(e) =>
                    setViewOptions({
                      ...viewOptions,
                      [key]: e.target.checked,
                    })
                  }
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                {key
                  .replace(/^show/, '')
                  .replace(/([A-Z])/g, ' $1')
                  .trim()}
              </label>
            );
          })}
        </div>

        {/* Connection Mode */}
        <div className="mt-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
             <List size={12} /> Connection Mode
          </h3>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded border border-slate-200 dark:border-slate-600">
             <button
                onClick={() => setViewOptions({ ...viewOptions, connectionMode: 'column' })}
                className={`flex-1 py-1 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                  viewOptions.connectionMode === 'column'
                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
             >
                <List size={10} /> Column
             </button>
             <button
                onClick={() => setViewOptions({ ...viewOptions, connectionMode: 'table' })}
                className={`flex-1 py-1 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                  viewOptions.connectionMode === 'table'
                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
             >
                <Table2 size={10} /> Table
             </button>
          </div>
        </div>

        {/* Grid Style Selector */}
        <div className="mt-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Grid size={12} /> Grid Style
          </h3>
          <select
            value={viewOptions.gridStyle}
            onChange={(e) => setViewOptions({ ...viewOptions, gridStyle: e.target.value as any })}
            className="w-full text-xs p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
          >
            <option value="none">None</option>
            <option value="dots">Dots</option>
            <option value="squares">Squares</option>
          </select>
        </div>

        <div className="mt-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <GitMerge size={12} /> Line Style
          </h3>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded border border-slate-200 dark:border-slate-600">
            <button
              onClick={() =>
                setViewOptions({
                  ...viewOptions,
                  lineStyle: 'curved',
                })
              }
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                viewOptions.lineStyle === 'curved'
                  ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Curved
            </button>
            <button
              onClick={() =>
                setViewOptions({
                  ...viewOptions,
                  lineStyle: 'orthogonal',
                })
              }
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                viewOptions.lineStyle === 'orthogonal'
                  ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Quadratic
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
