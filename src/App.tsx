import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ViewOptions, WarningData } from './ui/types';
import { useSchemaData } from './ui/hooks/useSchemaData';
import Toolbar from './ui/components/Toolbar';
import Sidebar from './ui/components/Sidebar';
import PropertiesPanel from './ui/components/PropertiesPanel';
import WarningModal from './ui/components/WarningModal';
import DiagramCanvas from './ui/components/DiagramCanvas';
import RelationshipMenu from './ui/components/RelationshipMenu';

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
    showCardinalityNumeric: true,
    showRelationshipNames: true,
    gridStyle: 'none',
    lineStyle: 'orthogonal',
  });

  const [viewMode, setViewMode] = useState<string>('physical');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [globalEditable, setGlobalEditable] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const handleConfigTable = (id: string) => {
    setSelectedId(id);
    setIsPropertiesPanelOpen(true);
  };

  const selectedTable = viewTables.find((t) => t.id === selectedId);

  // Active Relationship for Menu
  const activeRel = useMemo(
    () => (relMenu ? relationships.find((r) => r.id === relMenu.id) : null),
    [relMenu, relationships],
  );

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
            onConfirm={() => {
              actions.applyConnection(
                warningModal.pendingData.sourceTId,
                warningModal.pendingData.sourceCId,
                warningModal.pendingData.targetTId,
                warningModal.pendingData.targetCId,
              );
              setWarningModal(null);
            }}
          />
        )}

        <Toolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          zoom={zoom}
          setZoom={setZoom}
          theme={theme}
          setTheme={setTheme}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
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
              const newId = actions.addTable(sidebarWidth, pan, zoom, selectedId);
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
          />

          {/* Floating Action Buttons (FABs) */}
          <div className="md:hidden fixed bottom-6 right-6 z-40">
            <button
              onClick={() => {
                const newId = actions.addTable(0, pan, zoom, null);
                setSelectedId(newId);
                setIsPropertiesPanelOpen(true);
              }}
              className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              title="Add New Table"
            >
              <Plus size={28} />
            </button>
          </div>

          {selectedId && !selectedId.startsWith('virt_') && (
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
              onUpdateName={(name) => actions.updateRelName(activeRel.id, name)}
              onUpdateType={(type) => {
                actions.updateRelType(activeRel.id, type);
                setRelMenu(null);
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
