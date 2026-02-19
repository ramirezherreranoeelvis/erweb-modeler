import { Component, inject, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

// Main UI Components
import { Toolbar } from './components/toolbar/toolbar';
import { Sidebar } from './components/sidebar/sidebar';
import { PropertiesPanel } from './components/properties-panel/properties-panel';
import { DiagramCanvas } from './components/canvas-diagram/canvas-diagram';
import { SchemaService } from './components/canvas-diagram/services/schema.service';
import { ViewOptions } from './components/canvas-diagram/types/view-options';
import { DbEngine } from './components/canvas-diagram/utils/dbDataTypes';

@Component({
      selector: 'app-root',
      imports: [CommonModule, Toolbar, Sidebar, PropertiesPanel, DiagramCanvas],
      templateUrl: './app.html',
})
export class App {
      schema = inject(SchemaService);
      panelDiagram = viewChild(DiagramCanvas);

      // --- UI State ---
      theme = signal<'light' | 'dark'>('light');
      viewOptions = signal<ViewOptions>({
            showTypes: true,
            showLength: true,
            showNulls: true,
            showPk: true,
            showFk: true,
            showUnique: true,
            showIdentity: true,
            showDefaultValue: false,
            showCardinality: true,
            showCardinalityNumeric: false,
            showRelationshipNames: false,
            showMinimap: false,
            showZoomControls: false,
            snapToGrid: true,
            gridStyle: 'none',
            lineStyle: 'orthogonal',
            connectionMode: 'table',
            interactionMode: 'pan',
      });

      isSidebarOpen = signal(true);

      // Selection State (Read from PanelDiagram)
      activeTableId = signal<string | null>(null);
      propertiesPanelWidth = signal(300);

      globalEditable = signal(false);

      // Modal Control Signals
      pendingDbEngine = signal<DbEngine | null>(null);

      constructor() {
            this.detectTheme();
      }

      detectTheme() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                  this.theme.set('dark');
            }
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                  this.theme.set(e.matches ? 'dark' : 'light');
            });
      }

      // --- Handlers ---

      handleTableSelection(id: string | null) {
            this.activeTableId.set(id);
      }

      handleViewModeChange(mode: string) {
            this.panelDiagram()?.setViewMode(mode);
      }

      closePropertiesPanel() {
            // Logic: User clicked 'X' on Properties Panel.
            // We must tell PanelDiagram to clear its selection so the UI syncs up.
            this.panelDiagram()?.clearSelection();
      }

      // Handles both the initial request AND clean up
      handleDbEngineRequest(newEngine: DbEngine) {
            this.pendingDbEngine.set(newEngine);
      }

      // Called when PanelDiagram is done with the request (either cancelled or applied)
      handleRequestHandled() {
            this.pendingDbEngine.set(null);
      }

      handleToggleSidebar() {
            this.isSidebarOpen.update((v) => !v);
      }

      handleUpdateViewOption(option: { key: keyof ViewOptions; value: any }) {
            this.viewOptions.update((v) => ({ ...v, [option.key]: option.value }));
      }

      handleImportClick() {
            this.panelDiagram()?.openImport();
      }

      handleExport(includeLayout: boolean) {
            this.panelDiagram()?.exportSQL(includeLayout);
      }

      handleReset() {
            this.panelDiagram()?.reset();
      }

      handleAddTable() {
            this.isSidebarOpen.set(false);
            this.panelDiagram()?.addTable();
      }

      handleDeleteTable() {
            this.panelDiagram()?.deleteTable();
      }
}
