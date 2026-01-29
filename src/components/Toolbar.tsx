import React from "react";
import { Database, ZoomIn, ZoomOut, Save, Moon, Sun, Menu } from "lucide-react";

interface ToolbarProps {
      viewMode: string;
      setViewMode: (mode: string) => void;
      zoom: number;
      setZoom: React.Dispatch<React.SetStateAction<number>>;
      theme: "light" | "dark";
      setTheme: React.Dispatch<React.SetStateAction<"light" | "dark">>;
      onToggleSidebar: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
      viewMode,
      setViewMode,
      zoom,
      setZoom,
      theme,
      setTheme,
      onToggleSidebar,
}) => {
      return (
            <header className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 shadow-sm z-10 shrink-0 transition-colors duration-200 relative">
                  <div className="flex items-center gap-3">
                        <button
                              onClick={onToggleSidebar}
                              className="p-1.5 md:hidden text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                        >
                              <Menu size={20} />
                        </button>
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-1.5 rounded text-white shadow-sm">
                              <Database size={20} />
                        </div>
                        <div>
                              <h1 className="font-bold text-base text-slate-700 dark:text-slate-100 leading-tight hidden sm:block">
                                    ERWeb Modeler
                              </h1>
                              <h1 className="font-bold text-base text-slate-700 dark:text-slate-100 leading-tight sm:hidden">
                                    ERWeb
                              </h1>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium hidden sm:block">
                                    Professional Database Design
                              </p>
                        </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button
                              onClick={() => setViewMode("logical")}
                              className={`px-2 sm:px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${viewMode === "logical" ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                        >
                              Logical
                        </button>
                        <button
                              onClick={() => setViewMode("physical")}
                              className={`px-2 sm:px-4 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${viewMode === "physical" ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                        >
                              Physical
                        </button>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                        <button
                              onClick={() =>
                                    setTheme(
                                          theme === "light" ? "dark" : "light",
                                    )
                              }
                              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                              {theme === "light" ? (
                                    <Moon size={18} />
                              ) : (
                                    <Sun size={18} />
                              )}
                        </button>

                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 border border-slate-200 dark:border-slate-600 hidden sm:flex">
                              <button
                                    onClick={() =>
                                          setZoom((z) => Math.max(0.5, z - 0.1))
                                    }
                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                    <ZoomOut size={16} />
                              </button>
                              <span className="px-2 py-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 select-none w-12 text-center">
                                    {Math.round(zoom * 100)}%
                              </span>
                              <button
                                    onClick={() =>
                                          setZoom((z) => Math.min(2, z + 0.1))
                                    }
                                    className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                    <ZoomIn size={16} />
                              </button>
                        </div>
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 dark:bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-700 text-white rounded shadow text-xs font-bold transition-colors">
                              <Save size={14} />
                              <span className="hidden sm:inline">
                                    Export SQL
                              </span>
                        </button>
                  </div>
            </header>
      );
};

export default Toolbar;
