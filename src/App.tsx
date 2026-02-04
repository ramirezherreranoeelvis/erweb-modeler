import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
    showCardinality: true,
    showCardinalityNumeric: false,
    showRelationshipNames: false,
    snapToGrid: true,
    gridStyle: 'none',
    lineStyle: 'orthogonal',
    connectionMode: 'table', // Default to table mode as requested
  });

  const [viewMode, setViewMode] = useState<string>('physical');
  const [dbEngine, setDbEngine] = useState<DbEngine>('mysql');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  } = useSchemaData(viewMode);

  // --- Keyboard Shortcuts (Delete/Backspace & N for New Table) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (relMenu) {
          e.preventDefault();
          // Priority: If a relationship menu is active, delete that relationship
          actions.deleteRel(relMenu.id);
          setRelMenu(null);
        } else if (selectedId) {
          e.preventDefault();
          // Otherwise, if a table is selected, delete the table
          actions.deleteTable(selectedId);
          setSelectedId(null);
          setIsPropertiesPanelOpen(false);
        }
      }

      // 'N' for New Table
      if (e.key.toLowerCase() === 'n') {
        const newId = actions.addTable(sidebarWidth, pan, zoom);
        setSelectedId(newId);
        setIsPropertiesPanelOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, relMenu, actions, sidebarWidth, pan, zoom]);

  const handleConfigTable = (id: string) => {
    setSelectedId(id);
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
    // Check viewTables because it might be a virtual table
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
                // This logic is specifically for Table Mode collisions
                if (action === 'create_new') {
                  // Pass a dummy targetCId which triggers "create new" logic in app (or we call a specific method)
                  // Actually, DiagramCanvas has logic to create new if no column matches.
                  // We need to simulate the "create new column" logic.
                  // We can use actions.applyConnection to specific column OR actions.addColumn + actions.applyConnection?
                  // Simpler: The DiagramCanvas logic for "Complete Connection to New Column"
                  // essentially calls actions.applyConnection but generates the col first.
                  // Let's implement a specific handler here or call DiagramCanvas logic?
                  // No, `actions` has all we need.
                  // We can replicate logic:
                  const sourceTable = tables.find((t) => t.id === warningModal.data.sourceTId);
                  const sourceCol = sourceTable?.columns.find(
                    (c) => c.id === warningModal.data.sourceCId,
                  );
                  const targetTable = tables.find((t) => t.id === warningModal.data.targetTId);

                  if (sourceTable && sourceCol && targetTable) {
                    // Generate new name
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

                    // Add Column first
                    // Problem: actions.addColumn adds a generic column. We need to add specific column.
                    // Let's manually manipulate state or enhance useSchemaData?
                    // Actually, simpler: call `actions.applyConnection` but trick it? No.
                    // Let's manually trigger the creation using setTables/setRelationships via DiagramCanvas logic...
                    // OR - better - create a dedicated action in useSchemaData for "AddFKColumnAndLink"
                    // Since we don't have that yet, let's just trigger applyConnection to a NEW ID if we could...
                    // BUT wait, applyConnection expects targetCId to exist.

                    // RE-USE existing logic: Just close modal and call the `onCompleteNewColConnection` equivalent?
                    // We can't access DiagramCanvas internal methods here.
                    // Let's use the DiagramCanvas logic: we'll call applyConnection with a NON-EXISTENT targetCId?
                    // No, applyConnection fails if col doesn't exist.

                    // FIX: We will just call actions.applyConnection to the TARGET table but with a "magic" flag? No.
                    // Let's just create the column manually here using setTables exposed via actions (it is not exposed).
                    // Ok, let's use `actions.addColumn` then `actions.updateColumn` then `actions.applyConnection`.

                    // 1. Add Column (generic)
                    // We can't easily get the ID of the new column synchronously.

                    // BACKTRACK: DiagramCanvas has logic `completeConnectionToNewColumn`.
                    // We should move that logic to `useSchemaData` as `actions.createFkConnection`?
                    // For now, let's use the `onApplyConnection` prop in DiagramCanvas which IS `actions.applyConnection`.
                    // That function ADDS the FK property to existing column.

                    // Let's implement `createFkConnection` in useSchemaData in next step if needed?
                    // Actually, let's look at `actions.applyConnection` implementation in `useSchemaData.ts`.
                    // It sets `isFk: true`. It does NOT create columns.

                    // Solution: We will pass a callback from DiagramCanvas to App that handles "force create new".
                    // But App renders WarningModal.

                    // Let's implement the logic right here in App.tsx using setTables/setRelationships directly?
                    // We have them!

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
                                type: sourceCol.type,
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
                  // Just link to existing. applyConnection handles updating type/isFk
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
          zoom={zoom}
          setZoom={setZoom}
          theme={theme}
          setTheme={setTheme}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onExport={handleExportSQL}
          onImportClick={() => setIsImportModalOpen(true)}
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
              setIsPropertiesPanelOpen(true);
            }}
            onDeleteTable={() => {
              actions.deleteTable(selectedId);
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
            viewMode={viewMode}
            theme={theme}
            dbEngine={dbEngine}
            globalEditable={globalEditable}
            setSelectedId={setSelectedId}
            setIsPropertiesPanelOpen={setIsPropertiesPanelOpen}
            setRelMenu={setRelMenu}
            setWarningModal={setWarningModal}
            selectedId={selectedId}
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
          />

          {/* Floating Action Buttons (FABs) */}
          <div className="md:hidden fixed bottom-6 right-6 z-40">
            <button
              onClick={() => {
                const newId = actions.addTable(0, pan, zoom);
                setSelectedId(newId);
                setIsPropertiesPanelOpen(true);
              }}
              className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              title="Add New Table"
            >
              <Plus size={28} />
            </button>
          </div>

          {selectedId && (
            <div className="md:hidden fixed bottom-6 left-6 z-40">
              <button
                onClick={() => {
                  actions.deleteTable(selectedId);
                  setSelectedId(null);
                  setIsPropertiesPanelOpen(false);
                }}
                className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                title="Delete Selected Table"
              >
                <Trash2 size={24} />
              </button>
            </div>
          )}

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
                // Don't close menu immediately so user can see changes or adjust routing
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
