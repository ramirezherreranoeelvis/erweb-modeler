import { useState, useMemo, useEffect } from 'react';
import type { ViewOptions, WarningData, Table, Relationship } from './ui/types';
import { useSchemaData } from './ui/hooks/useSchemaData';
import Toolbar from './ui/components/Toolbar';
import Sidebar from './ui/components/Sidebar';
import PropertiesPanel from './ui/components/PropertiesPanel';
import WarningModal from './ui/components/WarningModal';
import DiagramCanvas from './ui/components/DiagramCanvas';
import RelationshipMenu from './ui/components/RelationshipMenu';
import ImportModal from './ui/components/ImportModal';
import type { DbEngine } from './utils/dbDataTypes';
import { generateSQL } from './utils/sqlGenerator';
import { getCanonicalType } from './utils/dbDataTypes';

const App = () => {
  // --- Theme State ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const [viewOptions, setViewOptions] = useState<ViewOptions>({
    showTypes: true,
    showLength: true,
    showNulls: true,
    showPk: true,
    showFk: true,
    showUnique: true,
    showIdentity: true,
    showDefaultValue: false, // Default off to keep UI clean initially
    showCardinality: true,
    showCardinalityNumeric: false,
    showRelationshipNames: false,
    showMinimap: true,
    snapToGrid: true,
    gridStyle: 'none',
    lineStyle: 'orthogonal',
    connectionMode: 'table',
    interactionMode: 'pan', // Default to Pan/Move mode
  });

  const [viewMode, setViewMode] = useState<string>('physical');
  const [dbEngine, setDbEngine] = useState<DbEngine>('mysql');

  // Selection State
  const [selectedId, setSelectedId] = useState<string | null>(null); // Primary selection (for Properties Panel)
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set()); // Multi-selection (for Visuals/Batch Actions)

  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [globalEditable, setGlobalEditable] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // UI State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Connection State
  const [relMenu, setRelMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [warningModal, setWarningModal] = useState<WarningData | null>(null);

  // --- Logic & Data ---
  const {
    tables,
    setTables,
    relationships,
    setRelationships,
    viewTables,
    viewRelationships,
    actions,
  } = useSchemaData(dbEngine);

  const handleReset = () => {
    actions.resetSchema();
    setSelectedId(null);
    setSelectedTableIds(new Set());
    setIsPropertiesPanelOpen(false);
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl + A (Select All)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allIds = new Set(tables.map((t) => t.id));
        setSelectedTableIds(allIds);
        // Set the last table as the "primary" one for the panel
        if (tables.length > 0) {
          const lastId = tables[tables.length - 1].id;
          setSelectedId(lastId);
          setIsPropertiesPanelOpen(true);
        }
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (relMenu) {
          e.preventDefault();
          actions.deleteRel(relMenu.id);
          setRelMenu(null);
        } else if (selectedTableIds.size > 0) {
          // Batch Delete
          e.preventDefault();
          selectedTableIds.forEach((id) => actions.deleteTable(id));
          setSelectedTableIds(new Set());
          setSelectedId(null);
          setIsPropertiesPanelOpen(false);
        } else if (selectedId) {
          // Fallback single delete
          e.preventDefault();
          actions.deleteTable(selectedId);
          setSelectedId(null);
          setIsPropertiesPanelOpen(false);
        }
      }

      // 'N' for New Table
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        const newId = actions.addTable(sidebarWidth, pan, zoom);
        setSelectedId(newId);
        setSelectedTableIds(new Set([newId]));
        setIsPropertiesPanelOpen(true);
      }

      // Zoom Shortcuts (Ctrl + / Ctrl -)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoom((prev) => Math.min(prev + 0.1, 2));
        }
        if (e.key === '-') {
          e.preventDefault();
          setZoom((prev) => Math.max(prev - 0.1, 0.1));
        }
        if (e.key === '0') {
          e.preventDefault();
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedTableIds, relMenu, actions, sidebarWidth, pan, zoom, tables]);

  const handleConfigTable = (id: string) => {
    setSelectedId(id);
    setSelectedTableIds(new Set([id]));
    setIsPropertiesPanelOpen(true);
  };

  const handleExportSQL = (includeLayout: boolean) => {
    const sql = generateSQL(tables, relationships, dbEngine, includeLayout);
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erweb_export_${dbEngine}_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSQL = (importedTables: Table[], importedRels: Relationship[]) => {
    setTables(importedTables);
    setRelationships(importedRels);
    setIsImportModalOpen(false);
    // Reset View
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const selectedTable = viewTables.find((t) => t.id === selectedId);

  // Active Relationship for Menu
  const activeRel = useMemo(
    () => (relMenu ? viewRelationships.find((r) => r.id === relMenu.id) : null),
    [relMenu, viewRelationships],
  );

  // Determine Nullability of Target Column for Active Rel
  const targetColNullable = useMemo(() => {
    if (!activeRel) return false;
    const tTable = viewTables.find((t) => t.id === activeRel.toTable);
    const tCol = tTable?.columns.find((c) => c.id === activeRel.toCol);
    return tCol?.isNullable || false;
  }, [activeRel, viewTables]);

  return (
    <div
      className={`${theme} w-full min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200`}
    >
      <div
        className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200"
        onClick={() => setRelMenu(null)}
      >
        {warningModal && (
          <WarningModal
            data={warningModal}
            onCancel={() => setWarningModal(null)}
            onConfirmIntegrity={() => {
              if (warningModal.type === 'integrity' && warningModal.data.targetCId) {
                actions.applyConnection(
                  warningModal.data.sourceTId,
                  warningModal.data.sourceCId,
                  warningModal.data.targetTId,
                  warningModal.data.targetCId,
                );
                setWarningModal(null);
              }
            }}
            onResolveCollision={(action) => {
              if (warningModal.type === 'collision') {
                if (action === 'create_new') {
                  const sourceTable = tables.find((t) => t.id === warningModal.data.sourceTId);
                  const sourceCol = sourceTable?.columns.find(
                    (c) => c.id === warningModal.data.sourceCId,
                  );
                  const targetTable = tables.find((t) => t.id === warningModal.data.targetTId);

                  if (sourceTable && sourceCol && targetTable) {
                    let newName = sourceCol.name;
                    let newLogicalName = sourceCol.logicalName;
                    let counter = 2;
                    while (
                      targetTable.columns.some(
                        (c) => c.name.toLowerCase() === newName.toLowerCase(),
                      )
                    ) {
                      newName = `${sourceCol.name}${counter}`;
                      newLogicalName = `${sourceCol.logicalName} ${counter}`;
                      counter++;
                    }

                    // Automatically map types based on engine (e.g., Postgres: BIGSERIAL -> BIGINT)
                    const targetType = getCanonicalType(sourceCol.type, dbEngine);

                    const newColId = Math.random().toString(36).substr(2, 9);
                    setTables((prev) =>
                      prev.map((t) => {
                        if (t.id === warningModal.data.targetTId) {
                          return {
                            ...t,
                            columns: [
                              ...t.columns,
                              {
                                id: newColId,
                                name: newName,
                                logicalName: newLogicalName,
                                type: targetType,
                                length: sourceCol.length,
                                isPk: false,
                                isFk: true,
                                isNullable: sourceCol.isNullable,
                                isUnique: false,
                                isIdentity: false,
                              },
                            ],
                          };
                        }
                        return t;
                      }),
                    );

                    const relId = Math.random().toString(36).substr(2, 9);
                    const relName =
                      `fk_${sourceTable.name}_${sourceCol.name}_${targetTable.name}_${newName}`.toLowerCase();

                    setRelationships((prev) => [
                      ...prev,
                      {
                        id: relId,
                        name: relName,
                        fromTable: warningModal.data.sourceTId,
                        fromCol: warningModal.data.sourceCId,
                        toTable: warningModal.data.targetTId,
                        toCol: newColId,
                        type: '1:N',
                      },
                    ]);
                  }
                } else if (action === 'use_existing' && warningModal.data.targetCId) {
                  actions.applyConnection(
                    warningModal.data.sourceTId,
                    warningModal.data.sourceCId,
                    warningModal.data.targetTId,
                    warningModal.data.targetCId,
                  );
                }
                setWarningModal(null);
              }
            }}
          />
        )}

        {isImportModalOpen && (
          <ImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImport={handleImportSQL}
            dbEngine={dbEngine}
          />
        )}

        <Toolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          dbEngine={dbEngine}
          setDbEngine={setDbEngine}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onExport={handleExportSQL}
          onImportClick={() => setIsImportModalOpen(true)}
          onReset={handleReset}
        />

        <div className="flex flex-1 overflow-hidden relative">
          {isSidebarOpen && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-20 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            ></div>
          )}

          <Sidebar
            isOpen={isSidebarOpen}
            globalEditable={globalEditable}
            setGlobalEditable={setGlobalEditable}
            onAddTable={() => {
              setIsSidebarOpen(false);
              const newId = actions.addTable(sidebarWidth, pan, zoom);
              setSelectedId(newId);
              setSelectedTableIds(new Set([newId]));
              setIsPropertiesPanelOpen(true);
            }}
            onDeleteTable={() => {
              if (selectedTableIds.size > 0) {
                selectedTableIds.forEach((id) => actions.deleteTable(id));
                setSelectedTableIds(new Set());
              } else if (selectedId) {
                actions.deleteTable(selectedId);
              }
              setSelectedId(null);
              setIsPropertiesPanelOpen(false);
            }}
            selectedId={selectedId}
            viewOptions={viewOptions}
            setViewOptions={setViewOptions}
          />

          <DiagramCanvas
            tables={tables}
            setTables={setTables}
            relationships={relationships}
            setRelationships={setRelationships}
            viewTables={viewTables}
            viewRelationships={viewRelationships}
            zoom={zoom}
            setZoom={setZoom}
            pan={pan}
            setPan={setPan}
            viewOptions={viewOptions}
            setViewOptions={setViewOptions}
            viewMode={viewMode}
            setViewMode={setViewMode}
            theme={theme}
            dbEngine={dbEngine}
            setDbEngine={setDbEngine}
            globalEditable={globalEditable}
            // Selection Props
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            selectedTableIds={selectedTableIds}
            setSelectedTableIds={setSelectedTableIds}
            setIsPropertiesPanelOpen={setIsPropertiesPanelOpen}
            setRelMenu={setRelMenu}
            setWarningModal={setWarningModal}
            relMenuId={relMenu ? relMenu.id : null}
            onApplyConnection={actions.applyConnection}
            onAddColumn={actions.addColumn}
            onUpdateTable={actions.updateTable}
            onUpdateColumn={actions.updateColumn}
            onMoveColumn={actions.moveColumn}
            onDeleteColumn={actions.deleteColumn}
            onConfigTable={handleConfigTable}
            onAddControlPoint={actions.addControlPoint}
            onUpdateControlPoint={actions.updateControlPoint}
            onDeleteControlPoint={actions.deleteControlPoint}
            onSetControlPoints={actions.setControlPoints}
            // Passing actions for mobile FAB within canvas
            onAddTable={() => {
              const newId = actions.addTable(0, pan, zoom);
              setSelectedId(newId);
              setSelectedTableIds(new Set([newId]));
              setIsPropertiesPanelOpen(true);
            }}
            onDeleteSelected={() => {
              if (selectedTableIds.size > 0) {
                selectedTableIds.forEach((id) => actions.deleteTable(id));
                setSelectedTableIds(new Set());
              } else if (selectedId) {
                actions.deleteTable(selectedId);
              }
              setSelectedId(null);
              setIsPropertiesPanelOpen(false);
            }}
          />

          {/* Relationship Context Menu */}
          {relMenu && activeRel && (
            <RelationshipMenu
              x={relMenu.x}
              y={relMenu.y}
              currentName={activeRel.name}
              currentType={activeRel.type}
              targetColNullable={targetColNullable}
              onUpdateName={(name) => actions.updateRelName(activeRel.id, name)}
              onUpdateCardinality={(type, isNullable) => {
                actions.updateCardinality(activeRel.id, type, isNullable);
              }}
              onResetRouting={() => {
                actions.resetRelRouting(activeRel.id);
                setRelMenu(null);
              }}
              onSetRouting={(source, target) => {
                actions.setRelRouting(activeRel.id, source, target);
                setRelMenu(null);
              }}
              onDelete={() => {
                actions.deleteRel(activeRel.id);
                setRelMenu(null);
              }}
            />
          )}

          {selectedTable && isPropertiesPanelOpen && (
            <div className="fixed inset-0 z-40 md:static md:z-auto md:w-auto bg-white/50 dark:bg-black/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none flex flex-col justify-end md:block">
              <PropertiesPanel
                width={sidebarWidth}
                onWidthChange={setSidebarWidth}
                selectedTable={selectedTable}
                relationships={relationships}
                dbEngine={dbEngine}
                onClose={() => setIsPropertiesPanelOpen(false)}
                onUpdateTable={actions.updateTable}
                onAddColumn={actions.addColumn}
                onUpdateColumn={actions.updateColumn}
                onDeleteColumn={actions.deleteColumn}
                onMoveColumn={actions.moveColumn}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
