
import React from 'react';
import { Plus, Trash2, Eye, GitMerge, Edit3, Lock, Grid, Table2, List, Server, Hand, MousePointer2 } from 'lucide-react';
import type { ViewOptions } from '../types';
import type { DbEngine } from '../../utils/dbDataTypes';
import { DB_ENGINES } from '../../utils/dbDataTypes';

interface SidebarProps {
  isOpen: boolean;
  globalEditable: boolean;
  setGlobalEditable: (value: boolean) => void;
  onAddTable: () => void;
  onDeleteTable: () => void;
  selectedId: string | null;
  viewOptions: ViewOptions;
  setViewOptions: (options: ViewOptions) => void;
  dbEngine?: DbEngine;
  setDbEngine?: (engine: DbEngine) => void;
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
  dbEngine,
  setDbEngine,
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

      {/* Database Engine Selector - Visible only between 500px and LG breakpoints */}
      {/* Hidden below 500px (moved to floating), Hidden above LG (in toolbar) */}
      {dbEngine && setDbEngine && (
        <div className="hidden min-[500px]:block lg:hidden">
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Server size={12} /> Database Engine
          </h3>
          <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
            <select
              value={dbEngine}
              onChange={(e) => setDbEngine(e.target.value as DbEngine)}
              className="w-full bg-transparent border-none outline-none text-xs font-medium text-slate-700 dark:text-slate-300 focus:ring-0 cursor-pointer"
            >
              {DB_ENGINES.map((engine) => (
                <option
                  key={engine.value}
                  value={engine.value}
                  className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  {engine.label}
                </option>
              ))}
            </select>
          </div>
          <div className="h-px bg-slate-200 dark:bg-slate-700/50 mt-4"></div>
        </div>
      )}

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
            // REMOVED snapToGrid and interactionMode from checkbox list
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

        {/* Connection Mode */}
        <div className="mt-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <List size={12} /> Connection Mode
          </h3>
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded">
            <button
              onClick={() => setViewOptions({ ...viewOptions, connectionMode: 'column' })}
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                viewOptions.connectionMode === 'column'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-slate-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <List size={10} /> Column
            </button>
            <button
              onClick={() => setViewOptions({ ...viewOptions, connectionMode: 'table' })}
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                viewOptions.connectionMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-slate-300 shadow-sm'
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
            className="w-full text-xs p-1.5 rounded bg-slate-50 dark:bg-[#151F33] text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
          >
            <option value="none">None</option>
            <option value="dots">Dots</option>
            <option value="squares">Squares</option>
          </select>
        </div>

        {/* Line Style */}
        <div className="mt-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <GitMerge size={12} /> Line Style
          </h3>
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded">
            <button
              onClick={() =>
                setViewOptions({
                  ...viewOptions,
                  lineStyle: 'curved',
                })
              }
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                viewOptions.lineStyle === 'curved'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-slate-300 shadow-sm'
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
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-slate-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Quadratic
            </button>
          </div>
        </div>

        {/* Interaction Mode */}
        <div className="mt-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <MousePointer2 size={12} /> Cursor Mode
          </h3>
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded">
            <button
              onClick={() => setViewOptions({ ...viewOptions, interactionMode: 'pan' })}
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                viewOptions.interactionMode === 'pan'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-slate-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Hand size={10} /> Move
            </button>
            <button
              onClick={() => setViewOptions({ ...viewOptions, interactionMode: 'select' })}
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1 ${
                viewOptions.interactionMode === 'select'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-slate-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <MousePointer2 size={10} /> Select
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
