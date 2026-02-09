
import React, { useState, useRef } from 'react';
import { FileInput, AlertCircle, Check, Clipboard, Upload } from 'lucide-react';
import { parseSQL } from '../../utils/sqlParser';
import type { Table, Relationship } from '../types';
import type { DbEngine } from '../../utils/dbDataTypes';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (tables: Table[], rels: Relationship[]) => void;
  dbEngine: DbEngine;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, dbEngine }) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('paste');
  const [sqlContent, setSqlContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProcess = () => {
    try {
      if (!sqlContent.trim()) {
        setError('No SQL content to process.');
        return;
      }

      const { tables, relationships } = parseSQL(sqlContent);

      if (tables.length === 0) {
        setError("No tables found. Ensure your SQL contains standard 'CREATE TABLE' statements.");
        return;
      }

      onImport(tables, relationships);
    } catch (e) {
      console.error(e);
      setError('Failed to parse SQL. Please ensure it is valid syntax.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSqlContent(event.target.result as string);
          setError(null);
        }
      };
      reader.readAsText(file);
    }
  };

  // Helper to display current engine name nicely
  const getEngineName = () => {
      if (dbEngine === 'postgres') return 'PostgreSQL';
      if (dbEngine === 'mssql') return 'SQL Server';
      return 'MySQL';
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-xl">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold">
            <div className="bg-blue-100 dark:bg-blue-900 p-1.5 rounded text-blue-600 dark:text-blue-300">
              <FileInput size={20} />
            </div>
            Import SQL
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
              activeTab === 'paste'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Clipboard size={14} /> Paste SQL
            </div>
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
              activeTab === 'file'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload size={14} /> Upload File
            </div>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 text-xs text-slate-600 dark:text-slate-300">
            <strong className="block mb-1 text-blue-700 dark:text-blue-300">
              Target Engine: {getEngineName()}
            </strong>
            Supports <code>CREATE TABLE</code> with standard syntax. Handles brackets <code>[]</code>,
            backticks <code>`</code>, double quotes <code>"</code>, and <code>GO</code> separators.
          </div>

          {activeTab === 'paste' ? (
            <textarea
              className="flex-1 w-full p-4 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder={`CREATE TABLE "users" (\n  "id" SERIAL PRIMARY KEY,\n  "name" VARCHAR(50)\n);`}
              value={sqlContent}
              onChange={(e) => {
                setSqlContent(e.target.value);
                setError(null);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors p-8">
              <Upload size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                Click to upload .sql or .txt file
              </p>
              <input
                type="file"
                accept=".sql,.txt"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-bold shadow-sm hover:shadow"
              >
                Select File
              </button>
              {fileName && (
                <div className="mt-4 flex items-center gap-2 text-xs text-green-600 font-bold">
                  <Check size={14} /> {fileName} loaded
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleProcess}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors flex items-center gap-2"
          >
            <Check size={16} /> Process & Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
