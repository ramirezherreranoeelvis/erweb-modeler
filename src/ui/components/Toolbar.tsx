import React, { useState } from 'react';
import { Save, Menu, Server, Check } from 'lucide-react';
import { DB_ENGINES } from '../../utils/dbDataTypes';
import type { DbEngine } from '../../utils/dbDataTypes';

interface ToolbarProps {
  viewMode: string;
  setViewMode: (mode: string) => void;
  dbEngine: DbEngine;
  setDbEngine: (engine: DbEngine) => void;
  onToggleSidebar: () => void;
  onExport: (includeLayout: boolean) => void;
  onImportClick: () => void;
  onReset: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  viewMode,
  setViewMode,
  dbEngine,
  setDbEngine,
  onToggleSidebar,
  onExport,
  onImportClick,
  onReset,
}) => {
  const className =
    'dark:bg-slate-800- border-slate-200- dark:border-slate-700- glass-panel border-b border-slate-200 dark:border-white/10 shrink-0 bg-white/70 dark:bg-slate-900/70';
  return (
    <header
      className={`${className} h-16 border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0`}
    >
      <LeftContent onToggleSidebar={onToggleSidebar} onReset={onReset} />
      <RightContent
        viewMode={viewMode}
        setViewMode={setViewMode}
        dbEngine={dbEngine}
        setDbEngine={setDbEngine}
        onExport={onExport}
        onImportClick={onImportClick}
      />
    </header>
  );
};

export default Toolbar;

const RightContent = ({
  viewMode,
  setViewMode,
  dbEngine,
  setDbEngine,
  onExport,
  onImportClick,
}: any) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [includeLayout, setIncludeLayout] = useState(true);
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* DB Engine Selector - Hidden on LG and below */}
      <div className="hidden lg:flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 max-w-[120px] sm:max-w-none">
        <Server size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
        <select
          value={dbEngine}
          onChange={(e) => setDbEngine(e.target.value as DbEngine)}
          className="bg-transparent border-none outline-none text-xs font-medium text-slate-700 dark:text-slate-300 focus:ring-0 cursor-pointer py-1 pr-8 pl-5"
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

      {/* View Mode Selector - Hidden on screens < 500px */}
      <div className="hidden max-[500px]:hidden items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50 sm:flex">
        <button
          onClick={() => setViewMode('logical')}
          className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all cursor-pointer
            ${
              viewMode === 'logical'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }
            `}
        >
          Logical
        </button>
        <button
          onClick={() => setViewMode('physical')}
          className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all cursor-pointer
            ${
              viewMode === 'physical'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }
            `}
        >
          Physical
        </button>
      </div>
      <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

      {/* Import Button */}
      <button
        onClick={onImportClick}
        className="font-inter flex items-center gap-2 px-3 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded shadow text-sm font-bold transition-colors border border-slate-200 dark:border-slate-700"
        title="Import SQL"
      >
        <span className="material-icons-round text-sm">upload</span>
        <span className="hidden md:inline">Import</span>
      </button>

      {/* Export Button */}
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 dark:bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-700 text-white rounded shadow text-xs font-bold transition-colors"
        >
          <Save size={14} />
          <span className="hidden lg:inline">Export</span>
        </button>

        {showExportMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
            <div className="absolute right-0 mt-2 w-48  bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                <label className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${includeLayout ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'}`}
                  >
                    {includeLayout && <Check size={10} className="text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={includeLayout}
                    onChange={(e) => setIncludeLayout(e.target.checked)}
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                    Include Positions
                  </span>
                </label>
              </div>
              <button
                onClick={() => {
                  onExport(includeLayout);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-4 py-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Download SQL
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const LeftContent = ({ onToggleSidebar }: any) => {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 md:hidden text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
      >
        <Menu size={20} />
      </button>
      <div className="size-8 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-neon shrink-0">
        <span className="material-icons-round text-white text-lg p-1.5">schema</span>
      </div>
      <div className="hidden sm:block">
        <h1 className="font-bold text-base text-slate-700 dark:text-slate-100 leading-tight">
          ERWeb Modeler
        </h1>
      </div>
    </div>
  );
};
