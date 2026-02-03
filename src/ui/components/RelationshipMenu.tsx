import React, { useEffect, useState } from 'react';
import { RotateCcw, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import type { Relationship } from '../types';

interface RelationshipMenuProps {
  x: number;
  y: number;
  currentName: string;
  currentType: Relationship['type'];
  targetColNullable: boolean;
  onUpdateName: (name: string) => void;
  onUpdateCardinality: (type: Relationship['type'], isNullable: boolean) => void;
  onResetRouting: () => void;
  onSetRouting: (source: 'left' | 'right', target: 'left' | 'right') => void;
  onDelete: () => void;
}

type LeftOption = '1' | '0..1' | 'N';
type RightOption = '1' | '0..1' | '1..N' | '0..N' | 'N';

const RelationshipMenu: React.FC<RelationshipMenuProps> = ({
  x,
  y,
  currentName,
  currentType,
  targetColNullable,
  onUpdateName,
  onUpdateCardinality,
  onResetRouting,
  onSetRouting,
  onDelete,
}) => {
  const [leftSide, setLeftSide] = useState<LeftOption>('1');
  const [rightSide, setRightSide] = useState<RightOption>('1..N');

  // Sync state with props when menu opens or active rel changes
  useEffect(() => {
    // Determine Left Side (Source Nullability)
    if (currentType === 'N:M') {
      setLeftSide('N');
    } else {
      setLeftSide(targetColNullable ? '0..1' : '1');
    }

    // Determine Right Side (Target Type/Uniqueness)
    if (currentType === 'N:M') {
      setRightSide('N');
    } else if (currentType === '1:1') {
      setRightSide('1');
    } else if (currentType === '1:0..1') {
      setRightSide('0..1');
    } else if (currentType === '1:N') {
      setRightSide('1..N');
    } else if (currentType === '1:0..N') {
      setRightSide('0..N');
    }
  }, [currentType, targetColNullable]);

  const handleUpdate = (newLeft: LeftOption, newRight: RightOption) => {
    setLeftSide(newLeft);
    setRightSide(newRight);

    // If "Many" is selected on BOTH sides, or implicitly via N:M type selection
    if (newLeft === 'N' || newRight === 'N') {
      // If user sets either side to N, we assume N:M for now
      // Or we can enforce "N on both sides" rule.
      // Based on typical UI, if one side becomes N and the other was 1, it might be 1:N or N:1.
      // But this app stores 1:N.
      // If user explicitly chooses "Many-to-Many (N)", it triggers N:M.
      
      if (newLeft === 'N' && newRight === 'N') {
         onUpdateCardinality('N:M', false); // Nullability irrelevant for N:M
         return;
      }
      
      // If user sets Left=N but Right is standard, it's weird.
      // Let's assume if they select N on the Left, they want N:M.
      if (newLeft === 'N') {
          setRightSide('N');
          onUpdateCardinality('N:M', false);
          return;
      }
       if (newRight === 'N') {
          setLeftSide('N');
          onUpdateCardinality('N:M', false);
          return;
      }
    }

    // Calculate Is Nullable (Left Selector)
    const isNullable = newLeft === '0..1';

    // Calculate Type string (Right Selector)
    let type: Relationship['type'] = '1:N';
    
    switch (newRight) {
      case '1':
        type = '1:1';
        break;
      case '0..1':
        type = '1:0..1';
        break;
      case '1..N':
        type = '1:N';
        break;
      case '0..N':
        type = '1:0..N';
        break;
    }

    onUpdateCardinality(type, isNullable);
  };

  return (
    <div
      className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-1 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-100 w-80"
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

      <div className="flex items-center gap-2 px-2 pb-2">
        {/* Left / Source Selector */}
        <div className="flex-1 flex flex-col gap-1">
           <label className="text-[9px] text-slate-500 font-bold text-center">Origin (From)</label>
           <select 
              value={leftSide}
              onChange={(e) => handleUpdate(e.target.value as LeftOption, rightSide)}
              className="w-full text-xs p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
           >
              <option value="1">One (1)</option>
              <option value="0..1">Zero or One (0..1)</option>
              <option value="N">Many (N:M)</option>
           </select>
        </div>

        <div className="pt-4 text-xs font-bold text-slate-400">OR</div>

        {/* Right / Target Selector */}
        <div className="flex-1 flex flex-col gap-1">
           <label className="text-[9px] text-slate-500 font-bold text-center">Target (To)</label>
           <select 
              value={rightSide}
              onChange={(e) => handleUpdate(leftSide, e.target.value as RightOption)}
              className="w-full text-xs p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
           >
              <option value="1">One (1)</option>
              <option value="0..1">Zero or One (0..1)</option>
              <option value="1..N">One or Many (1..N)</option>
              <option value="0..N">Zero or One or Many (0..N)</option>
              <option value="N">Many (N:M)</option>
           </select>
        </div>
      </div>

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