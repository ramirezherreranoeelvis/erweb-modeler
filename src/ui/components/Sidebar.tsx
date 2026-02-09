import React from 'react';
import { Plus, Trash2, Eye, Edit3, Lock } from 'lucide-react';
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
      bg-white dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-700 
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
            : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
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
              : 'border-slate-200 dark:border-slate-700  text-slate-500 dark:text-slate-400 cursor-not-allowed'
          }`}
        >
          <Trash2 size={20} /> <span className="text-[10px] font-bold">Delete</span>
        </button>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700/50"></div>
      <div>
        {/* CheckBox */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
            <Eye size={12} /> View Options
          </h3>
          {Object.entries(viewOptions).map(([key, val]) => {
            // Filter out internal/visual configs, keep only data toggles
            if (
              key === 'lineStyle' ||
              key === 'gridStyle' ||
              key === 'connectionMode' ||
              key === 'snapToGrid' ||
              key === 'interactionMode'
            )
              return null;
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
                  className="rounded w-4 h-4 border-[0.5px] border-solid
                  border-slate-300- text-blue-600 focus:ring-blue-500 border-[#475569]
                  checked:bg-surface-dark
                  "
                />
                {key
                  .replace(/^show/, '')
                  .replace(/([A-Z])/g, ' $1')
                  .trim()}
              </label>
            );
          })}
        </div>

        {/* Helper Note */}
        <div className="mt-8 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-[10px] text-slate-400 dark:text-slate-500 italic">
          Tip: Right-click on the canvas to change Grid, Line Style, View Mode and Database Engine.
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
