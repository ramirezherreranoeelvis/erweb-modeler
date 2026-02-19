
import React from 'react';
import { AlertTriangle, CopyPlus, Link2, ArrowRight } from 'lucide-react';
import type { WarningData } from '../types';

interface WarningModalProps {
  data: WarningData;
  onCancel: () => void;
  onConfirmIntegrity: () => void;
  onResolveCollision: (action: 'create_new' | 'use_existing') => void;
}

const WarningModal: React.FC<WarningModalProps> = ({ 
  data, 
  onCancel, 
  onConfirmIntegrity, 
  onResolveCollision 
}) => {
  if (!data.isOpen) return null;

  // --- SCENARIO 1: NAME COLLISION (Table Mode Logic) ---
  if (data.type === 'collision') {
    const { sourceCol, targetCol } = data.data;
    const isTypeMismatch = targetCol && (sourceCol.type !== targetCol.type || sourceCol.length !== targetCol.length);

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20">
            <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full text-blue-600 dark:text-blue-400">
              <Link2 size={24} />
            </div>
            <div>
               <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                 Column Name Conflict
               </h3>
               <p className="text-xs text-slate-500 dark:text-slate-400">
                 The target table already has a column named <strong>{sourceCol.name}</strong>.
               </p>
            </div>
          </div>
          
          <div className="p-6 grid gap-4">
             {/* Option 1: Use Existing */}
             <button 
               onClick={() => onResolveCollision('use_existing')}
               className="flex items-start gap-4 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-all text-left group"
             >
                <div className="mt-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-slate-600 dark:text-slate-300 group-hover:text-blue-600 group-hover:bg-blue-100">
                   <Link2 size={20} />
                </div>
                <div className="flex-1">
                   <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                     Link to Existing Column
                   </h4>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                     Create a relationship using the existing <code>{sourceCol.name}</code> column as the Foreign Key.
                   </p>
                   {isTypeMismatch && (
                     <div className="mt-2 text-xs flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-100 dark:border-amber-800/50">
                        <AlertTriangle size={12} />
                        <span>
                           Warning: Type will change from <strong>{targetCol?.type}</strong> to <strong>{sourceCol.type}</strong>.
                        </span>
                     </div>
                   )}
                </div>
             </button>

             {/* Option 2: Create New */}
             <button 
               onClick={() => onResolveCollision('create_new')}
               className="flex items-start gap-4 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-slate-700/50 transition-all text-left group"
             >
                <div className="mt-1 bg-slate-100 dark:bg-slate-700 p-2 rounded text-slate-600 dark:text-slate-300 group-hover:text-green-600 group-hover:bg-green-100">
                   <CopyPlus size={20} />
                </div>
                <div className="flex-1">
                   <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-green-600 dark:group-hover:text-green-400">
                     Create New Column
                   </h4>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                     Keep the existing column as-is and create a new column (e.g., <code>{sourceCol.name}_1</code>) for this relationship.
                   </p>
                </div>
             </button>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Cancel Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- SCENARIO 2: TYPE INTEGRITY WARNING (Column Mode Logic) ---
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/30 rounded-t-lg">
          <div className="bg-amber-100 dark:bg-amber-800 p-2 rounded-full text-amber-600 dark:text-amber-400">
            <AlertTriangle size={24} />
          </div>
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
            Integrity Warning
          </h3>
        </div>
        
        {data.data.targetCol && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              The target column{' '}
              <span className="font-bold text-slate-800 dark:text-white">
                {data.data.targetCol.name}
              </span>{' '}
              has different properties than source{' '}
              <span className="font-bold text-slate-800 dark:text-white">
                {data.data.sourceCol.name}
              </span>
              .
            </p>
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Source:</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {data.data.sourceCol.type}({data.data.sourceCol.length})
                </span>
              </div>
              <div className="flex justify-center my-1 text-slate-300">
                 <ArrowRight size={12} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Target:</span>
                <span className="text-red-500 font-bold line-through decoration-2">
                  {data.data.targetCol.type}({data.data.targetCol.length})
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Continuing will <strong className="text-amber-600 dark:text-amber-400">overwrite</strong> target properties.
            </p>
          </div>
        )}

        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-b-lg flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmIntegrity}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors"
          >
            Sync & Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarningModal;
