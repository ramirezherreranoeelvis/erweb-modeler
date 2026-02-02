import React from 'react';
import { RotateCcw, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';

interface RelationshipMenuProps {
  x: number;
  y: number;
  currentName: string;
  onUpdateName: (name: string) => void;
  onUpdateType: (type: string) => void;
  onResetRouting: () => void;
  onSetRouting: (source: 'left' | 'right', target: 'left' | 'right') => void;
  onDelete: () => void;
}

const RelationshipMenu: React.FC<RelationshipMenuProps> = ({
  x,
  y,
  currentName,
  onUpdateName,
  onUpdateType,
  onResetRouting,
  onSetRouting,
  onDelete,
}) => {
  return (
    <div
      className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-1 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-100 w-56"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[10px] font-bold text-slate-400 px-2 py-1 border-b border-slate-100 dark:border-slate-700 uppercase tracking-wider">
        Relationship
      </div>

      <div className="px-2 py-1">
        <input
          type="text"
          className="w-full text-xs p-1 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded font-mono text-slate-700 dark:text-slate-300 focus:border-blue-400 outline-none"
          value={currentName}
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder="Relationship Name"
          autoFocus
        />
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-0.5"></div>

      <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
        Cardinality
      </div>

      <button
        onClick={() => onUpdateType('1:1')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
      >
        <span>One to One (1:1)</span>
      </button>

      <button
        onClick={() => onUpdateType('1:0..1')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
      >
        <span>One to Zero-or-One (1:0..1)</span>
      </button>

      <button
        onClick={() => onUpdateType('1:N')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
      >
        <span>One to Many (1:N)</span>
      </button>

      <button
        onClick={() => onUpdateType('1:0..N')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
      >
        <span>One to Zero-or-Many (1:0..N)</span>
      </button>

      <button
        onClick={() => onUpdateType('N:M')}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
      >
        <span>Many to Many (N:M)</span>
      </button>

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-0.5"></div>

      <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
        Routing
      </div>

      <div className="flex gap-1 px-2 py-1">
        {/* Right -> Right */}
        <button
          onClick={() => onSetRouting('right', 'right')}
          className="flex-1 flex items-center justify-center py-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600 transition-all"
          title="Right → Right"
        >
          <ArrowRight size={14} />
        </button>

        {/* Right -> Left */}
        <button
          onClick={() => onSetRouting('right', 'left')}
          className="flex-1 flex items-center justify-center py-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600 transition-all"
          title="Right → Left"
        >
          <div className="flex -space-x-1">
            <ArrowRight size={12} />
            <ArrowLeft size={12} />
          </div>
        </button>

        {/* Left -> Left */}
        <button
          onClick={() => onSetRouting('left', 'left')}
          className="flex-1 flex items-center justify-center py-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600 transition-all"
          title="Left → Left"
        >
          <ArrowLeft size={14} />
        </button>

        {/* Left -> Right */}
        <button
          onClick={() => onSetRouting('left', 'right')}
          className="flex-1 flex items-center justify-center py-1.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600 transition-all"
          title="Left → Right"
        >
          <div className="flex -space-x-1">
            <ArrowLeft size={12} />
            <ArrowRight size={12} />
          </div>
        </button>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-0.5"></div>

      <button
        onClick={onResetRouting}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
      >
        <RotateCcw size={14} /> <span>Reset to Auto</span>
      </button>

      <button
        onClick={onDelete}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs text-red-600 dark:text-red-400 rounded text-left font-medium transition-colors"
      >
        <Trash2 size={14} /> Delete Relationship
      </button>
    </div>
  );
};

export default RelationshipMenu;
