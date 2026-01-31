import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { WarningData } from '../types';

interface WarningModalProps {
  data: WarningData;
  onCancel: () => void;
  onConfirm: () => void;
}

const WarningModal: React.FC<WarningModalProps> = ({ data, onCancel, onConfirm }) => {
  if (!data.isOpen) return null;

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
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            The target column{' '}
            <span className="font-bold text-slate-800 dark:text-white">
              {data.pendingData.targetCol.name}
            </span>{' '}
            has different properties than source{' '}
            <span className="font-bold text-slate-800 dark:text-white">
              {data.pendingData.sourceCol.name}
            </span>
            .
          </p>
          <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Source:</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {data.pendingData.sourceCol.type}({data.pendingData.sourceCol.length})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target:</span>
              <span className="text-red-500 font-bold line-through">
                {data.pendingData.targetCol.type}({data.pendingData.targetCol.length})
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Continuing will{' '}
            <strong className="text-amber-600 dark:text-amber-400">overwrite</strong> target
            properties.
          </p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-b-lg flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
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
