import {
      Component,
      input,
      output,
      signal,
      computed,
      inject,
      effect,
      ElementRef,
      viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaService } from './services/schema.service';
import { ViewOptions } from './types/view-options';
import { DbEngine, areTypesCompatible, getCanonicalType } from './utils/dbDataTypes';
import { WarningData } from './types/warning-data';
import { ConversionChange } from './types/conversion-change';
import { generateId } from './utils/constants';
import { getMappedType, convertDefaultValue } from './utils/type-conversion';
import { Table } from './types/table';
import { Relationship } from './types/relationship';
import { generateSQL } from './utils/sqlGenerator';

// panel diagram
// modals
import { ImportModalComponent } from './modals/import/import';
import { WarningModalComponent } from './modals/warning/warning';
import { TypeConversionModalComponent } from './modals/type-conversion/type-conversion';
// menus
import { MenuRelationship } from './menus/relationship/relationship';
import { MenuContext } from './menus/context/menu-context';
import { PanelCanvas } from './panel-canvas/panel-canvas';

@Component({
      selector: 'canvas-diagram',
      imports: [
            CommonModule,
            PanelCanvas,
            ImportModalComponent,
            WarningModalComponent,
            MenuRelationship,
            MenuContext,
            TypeConversionModalComponent,
      ],
      templateUrl: './canvas-diagram.html',
      host: {
            '(window:keydown)': 'handleKeyDown($event)',
      },
})
export class DiagramCanvas {
      schema = inject(SchemaService);
      el = inject(ElementRef);

      // Access child canvas to get pan/zoom state for adding new tables correctly
      canvas = viewChild(PanelCanvas);

      // --- Inputs from App ---
      viewOptions = input.required<ViewOptions>();
      theme = input.required<'light' | 'dark'>();
      globalEditable = input.required<boolean>();

      // The pending request from the toolbar
      targetDbEngine = input<DbEngine | null>(null);

      // --- Outputs to App ---
      tableSelected = output<string | null>();

      // Passthrough for View Options
      updateViewOption = output<{ key: keyof ViewOptions; value: any }>();
      updateViewMode = output<string>();

      // Events
      updateDbEngineRequest = output<DbEngine>();

      // NEW: Tells parent "I am done processing the engine change request"
      requestHandled = output<void>();

      // --- Internal UI State ---
      selectedId = signal<string | null>(null);
      selectedTableIds = signal<Set<string>>(new Set());

      warningData = signal<WarningData | null>(null);
      showImportModal = signal(false);

      // Menus
      relMenuData = signal<{ id: string; x: number; y: number } | null>(null);
      canvasMenuData = signal<{ x: number; y: number } | null>(null);

      // DB Conversion Logic State
      isConversionModalOpen = signal(false);
      conversionChanges = signal<ConversionChange[]>([]);

      // --- Computeds ---
      activeRel = computed(() => {
            const menu = this.relMenuData();
            if (!menu) return null;
            return this.schema.relationships().find((r) => r.id === menu.id) || null;
      });

      targetColNullable = computed(() => {
            const rel = this.activeRel();
            if (!rel) return false;
            const table = this.schema.tables().find((t) => t.id === rel.toTable);
            const col = table?.columns.find((c) => c.id === rel.toCol);
            return col?.isNullable || false;
      });

      constructor() {
            // Effect to watch for external DB Engine change requests
            effect(
                  () => {
                        const target = this.targetDbEngine();
                        if (target && target !== this.schema.dbEngine()) {
                              this.checkDbEngineConversion(target);
                        }
                  },
                  { allowSignalWrites: true },
            );

            // Effect to sync internal selection with parent via output
            effect(() => {
                  this.tableSelected.emit(this.selectedId());
            });
      }

      // --- Keyboard Shortcuts ---
      handleKeyDown(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                  return;

            // Ctrl+A
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                  e.preventDefault();
                  const allIds = new Set(this.schema.tables().map((t) => t.id));
                  this.selectedTableIds.set(allIds);
                  if (allIds.size > 0) {
                        const lastId = this.schema.tables()[this.schema.tables().length - 1].id;
                        this.selectedId.set(lastId);
                  }
                  return;
            }

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                  if (this.canvas()?.selectedControlPoint()) {
                        return;
                  }
                  this.deleteTable();
            }

            // 'N' for New Table
            if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
                  this.addTable();
            }
      }

      // --- Public Actions (API) ---

      // Called by Parent via ViewChild
      setViewMode(mode: string) {
            this.schema.setViewMode(mode);
      }

      addTable() {
            const rect = this.el.nativeElement.getBoundingClientRect();
            const pan = this.canvas()?.pan() || { x: 0, y: 0 };
            const zoom = this.canvas()?.zoom() || 1;

            const newId = this.schema.addTable(rect.left, pan, zoom);

            // Select the new table
            this.selectedId.set(newId);
            this.selectedTableIds.set(new Set([newId]));
      }

      deleteTable() {
            const ids = this.selectedTableIds();
            if (ids && ids.size > 0) {
                  ids.forEach((id) => this.schema.deleteTable(id));
                  this.selectedTableIds.set(new Set());
            } else if (this.selectedId()) {
                  this.schema.deleteTable(this.selectedId()!);
            }
            this.clearSelection();
      }

      clearSelection() {
            this.selectedId.set(null);
            this.selectedTableIds.set(new Set());
      }

      openImport() {
            this.showImportModal.set(true);
      }

      reset() {
            this.schema.resetSchema();
            this.clearSelection();
      }

      exportSQL(includeLayout: boolean) {
            const sql = generateSQL(
                  this.schema.tables(),
                  this.schema.relationships(),
                  this.schema.dbEngine(),
                  includeLayout,
            );
            const blob = new Blob([sql], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `erweb_export_${this.schema.dbEngine()}_${new Date().toISOString().split('T')[0]}.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
      }

      // --- Internal Logic ---

      private checkDbEngineConversion(newEngine: DbEngine) {
            const changes: ConversionChange[] = [];
            const tables = this.schema.tables();

            for (const table of tables) {
                  for (const col of table.columns) {
                        const mapped = getMappedType(
                              col.type,
                              col.length,
                              newEngine,
                              col.originalType,
                        );
                        const newDefault = convertDefaultValue(
                              col.defaultValue,
                              newEngine,
                              mapped.type,
                        );

                        const typeChanged =
                              mapped.type.toUpperCase() !== col.type.toUpperCase() ||
                              mapped.length !== col.length;
                        const defaultChanged = col.defaultValue && col.defaultValue !== newDefault;

                        if (typeChanged || defaultChanged) {
                              const oldT = col.length ? `${col.type}(${col.length})` : col.type;

                              changes.push({
                                    tableName: table.name,
                                    columnName: col.name,
                                    oldType: oldT,
                                    newType: mapped.type,
                                    newLength: mapped.length,
                                    oldDefault: col.defaultValue,
                                    newDefault: newDefault,
                                    typeOptions: mapped.options,
                              });
                        }
                  }
            }

            if (changes.length > 0) {
                  this.conversionChanges.set(changes);
                  this.isConversionModalOpen.set(true);
            } else {
                  // No changes needed, apply directly
                  this.schema.setDbEngine(newEngine);
                  this.requestHandled.emit();
            }
      }

      // --- Handlers ---

      handleImportData(data: { tables: Table[]; relationships: Relationship[] }) {
            this.schema.importData(data.tables, data.relationships);
            this.showImportModal.set(false);
      }

      handleDeleteRel() {
            const menu = this.relMenuData();
            if (menu) {
                  this.schema.deleteRel(menu.id);
                  this.relMenuData.set(null);
            }
      }

      // --- DB Conversion Handlers ---

      confirmConversion(selectedChanges: ConversionChange[]) {
            const target = this.targetDbEngine();
            if (target) {
                  this.schema.convertDataTypes(target, selectedChanges);
                  this.schema.setDbEngine(target); // Apply change locally
            }
            this.requestHandled.emit(); // Tell parent we are done
            this.closeConversionModal();
      }

      keepAsIs() {
            const target = this.targetDbEngine();
            if (target) {
                  this.schema.setDbEngine(target); // Apply change locally without types
            }
            this.requestHandled.emit();
            this.closeConversionModal();
      }

      abortConversion() {
            this.requestHandled.emit(); // Just clear parent state
            this.closeConversionModal();
      }

      private closeConversionModal() {
            this.isConversionModalOpen.set(false);
            this.conversionChanges.set([]);
      }

      // --- Connection & Conflict Logic ---

      handleApplyConnection(data: {
            sourceTId: string;
            sourceCId: string;
            targetTId: string;
            targetCId: string;
      }) {
            const { sourceTId, sourceCId, targetTId, targetCId } = data;

            if (sourceTId === targetTId && sourceCId === targetCId) return;

            const exists = this.schema
                  .relationships()
                  .find(
                        (r) =>
                              (r.fromTable === sourceTId &&
                                    r.fromCol === sourceCId &&
                                    r.toTable === targetTId &&
                                    r.toCol === targetCId) ||
                              (r.toTable === sourceTId &&
                                    r.toCol === sourceCId &&
                                    r.fromTable === targetTId &&
                                    r.fromCol === targetCId),
                  );
            if (exists) return;

            const sourceTable = this.schema.tables().find((t) => t.id === sourceTId);
            const targetTable = this.schema.tables().find((t) => t.id === targetTId);
            if (!sourceTable || !targetTable) return;

            const sourceCol = sourceTable.columns.find((c) => c.id === sourceCId);
            const targetCol = targetTable.columns.find((c) => c.id === targetCId);
            if (!sourceCol || !targetCol) return;

            // Check Integrity
            const compatibleTypes = areTypesCompatible(
                  sourceCol.type,
                  targetCol.type,
                  this.schema.dbEngine(),
            );
            const expectedLength = sourceCol.length;
            const lengthMismatch =
                  targetCol.length !== expectedLength && sourceCol.type.includes('CHAR');
            const expectedNullable = sourceCol.isIdentity || !sourceCol.isNullable ? false : true;
            const hasMismatch =
                  !compatibleTypes || lengthMismatch || targetCol.isNullable !== expectedNullable;

            if (hasMismatch) {
                  this.warningData.set({
                        isOpen: true,
                        type: 'integrity',
                        data: { sourceTId, sourceCId, targetTId, targetCId, sourceCol, targetCol },
                  });
            } else {
                  this.schema.applyConnection(sourceTId, sourceCId, targetTId, targetCId);
            }
      }

      handleReconnect(data: {
            relId: string;
            sourceTId: string;
            sourceCId: string;
            targetTId: string;
            targetCId: string;
      }) {
            this.schema.reconnectRel(
                  data.relId,
                  data.sourceTId,
                  data.sourceCId,
                  data.targetTId,
                  data.targetCId,
            );
      }

      handleCreateFkConnection(data: {
            sourceTableId: string;
            sourceColId: string;
            targetTableId: string;
      }) {
            const { sourceTableId, sourceColId, targetTableId } = data;
            const sourceTable = this.schema.tables().find((t) => t.id === sourceTableId);
            const sourceCol = sourceTable?.columns.find((c) => c.id === sourceColId);
            const targetTable = this.schema.tables().find((t) => t.id === targetTableId);

            if (!sourceCol || !targetTable) return;

            const compatibleColumns = targetTable.columns.filter(
                  (c) =>
                        areTypesCompatible(sourceCol.type, c.type, this.schema.dbEngine()) &&
                        !c.isIdentity,
            );

            const existingTargetCol = targetTable.columns.find(
                  (c) => c.name.toLowerCase() === sourceCol.name.toLowerCase(),
            );

            if (this.viewOptions().connectionMode === 'table') {
                  if (existingTargetCol || compatibleColumns.length > 0) {
                        this.warningData.set({
                              isOpen: true,
                              type: 'collision',
                              data: {
                                    sourceTId: sourceTableId,
                                    sourceCId: sourceColId,
                                    targetTId: targetTableId,
                                    targetCId: existingTargetCol?.id,
                                    sourceCol,
                                    targetCol: existingTargetCol,
                                    candidateColumns: compatibleColumns,
                              },
                        });
                        return;
                  }
            }

            if (existingTargetCol) {
                  this.warningData.set({
                        isOpen: true,
                        type: 'collision',
                        data: {
                              sourceTId: sourceTableId,
                              sourceCId: sourceColId,
                              targetTId: targetTableId,
                              targetCId: existingTargetCol.id,
                              sourceCol,
                              targetCol: existingTargetCol,
                              candidateColumns: compatibleColumns,
                        },
                  });
            } else {
                  this.resolveCollision('create_new', data);
            }
      }

      resolveCollision(action: 'create_new' | 'use_existing', overrideData?: any) {
            let data: any = this.warningData()?.data;

            if (overrideData && overrideData.sourceTableId) {
                  data = {
                        sourceTId: overrideData.sourceTableId,
                        sourceCId: overrideData.sourceColId,
                        targetTId: overrideData.targetTableId,
                  };
            } else if (overrideData && overrideData.targetCId) {
                  data = { ...data, targetCId: overrideData.targetCId };
            }

            if (!data) return;

            if (action === 'create_new') {
                  const { sourceTId, sourceCId, targetTId } = data;
                  const sourceTable = this.schema.tables().find((t) => t.id === sourceTId);
                  const sourceCol = sourceTable?.columns.find((c) => c.id === sourceCId);
                  const targetTable = this.schema.tables().find((t) => t.id === targetTId);

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

                        const newColId = generateId();
                        const targetType = getCanonicalType(sourceCol.type, this.schema.dbEngine());

                        this.schema.updateTable(targetTId, 'columns', [
                              ...targetTable.columns,
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
                        ]);

                        const relId = generateId();
                        const relName =
                              `fk_${sourceTable.name}_${sourceCol.name}_${targetTable.name}_${newName}`.toLowerCase();
                        this.schema.relationships.update((prev) => [
                              ...prev,
                              {
                                    id: relId,
                                    name: relName,
                                    fromTable: sourceTId,
                                    fromCol: sourceCId,
                                    toTable: targetTId,
                                    toCol: newColId,
                                    type: '1:N',
                              },
                        ]);
                  }
            } else if (action === 'use_existing' && data.targetCId) {
                  if (data.sourceTId === data.targetTId && data.sourceCId === data.targetCId) {
                        // Self-link to same col - do nothing
                  } else {
                        this.schema.applyConnection(
                              data.sourceTId,
                              data.sourceCId,
                              data.targetTId,
                              data.targetCId,
                        );
                  }
            }
            this.warningData.set(null);
      }
}
