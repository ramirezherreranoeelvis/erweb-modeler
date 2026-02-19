import { Injectable, signal, effect, computed } from '@angular/core';
import { Table } from '../types/table';
import { Relationship } from '../types/relationship';
import { DbEngine, getCanonicalType } from '../utils/dbDataTypes';
import { generateId, TABLE_WIDTH } from '../utils/geometry';
import { getMappedType } from '../utils/type-conversion';
import { ConversionChange } from '../types/conversion-change';

const INITIAL_TABLES: Table[] = [
      {
            id: 't1',
            name: 'USERS',
            logicalName: 'Customer',
            x: 100,
            y: 100,
            isManuallyEditable: false,
            columns: [
                  {
                        id: 'c1',
                        name: 'user_id',
                        logicalName: 'User ID',
                        type: 'INT',
                        length: '',
                        isPk: true,
                        isFk: false,
                        isNullable: false,
                        isUnique: true,
                        isIdentity: true,
                  },
                  {
                        id: 'c2',
                        name: 'username',
                        logicalName: 'Username',
                        type: 'VARCHAR',
                        length: '50',
                        isPk: false,
                        isFk: false,
                        isNullable: false,
                        isUnique: true,
                        isIdentity: false,
                  },
                  {
                        id: 'c3',
                        name: 'email',
                        logicalName: 'Email Address',
                        type: 'VARCHAR',
                        length: '150',
                        isPk: false,
                        isFk: false,
                        isNullable: false,
                        isUnique: true,
                        isIdentity: false,
                  },
            ],
      },
      {
            id: 't2',
            name: 'ORDERS',
            logicalName: 'Sales Order',
            x: 100,
            y: 300,
            isManuallyEditable: false,
            columns: [
                  {
                        id: 'c1',
                        name: 'order_id',
                        logicalName: 'Order ID',
                        type: 'BIGINT',
                        length: '',
                        isPk: true,
                        isFk: false,
                        isNullable: false,
                        isUnique: true,
                        isIdentity: true,
                  },
                  {
                        id: 'c3',
                        name: 'order_date',
                        logicalName: 'Order Date',
                        type: 'DATETIME',
                        length: '',
                        isPk: false,
                        isFk: false,
                        isNullable: false,
                        isUnique: false,
                        isIdentity: false,
                  },
                  {
                        id: 'c4',
                        name: 'status',
                        logicalName: 'Order Status',
                        type: 'VARCHAR',
                        length: '20',
                        isPk: false,
                        isFk: false,
                        isNullable: false,
                        isUnique: false,
                        isIdentity: false,
                  },
            ],
      },
];

@Injectable({
      providedIn: 'root',
})
export class SchemaService {
      // --- State Signals ---
      readonly tables = signal<Table[]>(INITIAL_TABLES);
      readonly relationships = signal<Relationship[]>([]);
      readonly dbEngine = signal<DbEngine>('mysql');
      readonly viewMode = signal<string>('physical');

      constructor() {
            this.loadFromStorage();

            // Persistence Effect
            effect(() => {
                  const data = {
                        tables: this.tables(),
                        relationships: this.relationships(),
                        dbEngine: this.dbEngine(),
                        viewMode: this.viewMode(),
                  };
                  localStorage.setItem('erweb_schema', JSON.stringify(data));
            });
      }

      private loadFromStorage() {
            try {
                  const savedData = localStorage.getItem('erweb_schema');
                  if (savedData) {
                        const parsed = JSON.parse(savedData);
                        if (Array.isArray(parsed.tables)) {
                              this.tables.set(parsed.tables);
                              this.relationships.set(parsed.relationships || []);
                              if (parsed.dbEngine) this.dbEngine.set(parsed.dbEngine);
                              if (parsed.viewMode) this.viewMode.set(parsed.viewMode);
                        }
                  }
            } catch (e) {
                  console.error('Failed to load schema from local storage', e);
            }
      }

      // --- ACTIONS ---

      setDbEngine(engine: DbEngine) {
            this.dbEngine.set(engine);
      }

      // Check if converting would actually change anything
      requiresConversion(targetEngine: DbEngine): boolean {
            return this.tables().some((table) =>
                  table.columns.some((col) => {
                        const mapped = getMappedType(
                              col.type,
                              col.length,
                              targetEngine,
                              col.originalType,
                        );
                        // Returns true if Type OR Length would change based on our rules
                        return (
                              mapped.type.toUpperCase() !== col.type.toUpperCase() ||
                              mapped.length !== col.length
                        );
                  }),
            );
      }

      // Convert types when engine changes
      // optional 'whitelist' allows converting only specific columns (from the modal selection)
      convertDataTypes(targetEngine: DbEngine, whitelist?: ConversionChange[]) {
            this.tables.update((currentTables) => {
                  return currentTables.map((table) => ({
                        ...table,
                        columns: table.columns.map((col) => {
                              // If a whitelist exists, check if this column is in it
                              if (whitelist) {
                                    const change = whitelist.find(
                                          (w) =>
                                                w.tableName === table.name &&
                                                w.columnName === col.name,
                                    );

                                    // If user selected this column to change
                                    if (change) {
                                          // Preserve metadata if forced change
                                          // If we are changing type, keep track of what it WAS if we don't have it yet
                                          let newOriginalType = col.originalType;
                                          if (
                                                !newOriginalType &&
                                                change.oldType !== change.newType
                                          ) {
                                                newOriginalType = col.type; // Save 'BOOLEAN' before it becomes 'BIT'
                                          }

                                          return {
                                                ...col,
                                                type: change.newType, // Use whatever they selected in dropdown
                                                length: change.newLength,
                                                defaultValue: change.newDefault, // Update default value (e.g. GETDATE())
                                                originalType: newOriginalType,
                                          };
                                    }

                                    return col; // Skip conversion
                              }

                              // If no whitelist (direct force convert - deprecated flow but safe fallback)
                              const mapped = getMappedType(
                                    col.type,
                                    col.length,
                                    targetEngine,
                                    col.originalType,
                              );
                              if (mapped.type !== col.type || mapped.length !== col.length) {
                                    let newOriginalType = col.originalType;
                                    if (!newOriginalType) {
                                          newOriginalType = col.type;
                                    }

                                    return {
                                          ...col,
                                          type: mapped.type,
                                          length: mapped.length,
                                          originalType: newOriginalType,
                                    };
                              }
                              return col;
                        }),
                  }));
            });
      }

      setViewMode(mode: string) {
            this.viewMode.set(mode);
      }

      addTable(sidebarWidth: number, pan: { x: number; y: number }, zoom: number): string {
            const id = generateId();
            const viewportCenterX = (window.innerWidth - sidebarWidth) / 2 + sidebarWidth;
            const viewportCenterY = window.innerHeight / 2;

            const x = (viewportCenterX - pan.x) / zoom - TABLE_WIDTH / 2;
            const y = (viewportCenterY - pan.y) / zoom - 100;

            const newTable: Table = {
                  id,
                  name: `TABLE_${this.tables().length + 1}`,
                  logicalName: `New Table ${this.tables().length + 1}`,
                  x,
                  y,
                  isManuallyEditable: true,
                  columns: [
                        {
                              id: generateId(),
                              name: 'id',
                              logicalName: 'ID',
                              type: this.dbEngine() === 'mysql' ? 'INT' : 'INTEGER',
                              length: '',
                              isPk: true,
                              isFk: false,
                              isNullable: false,
                              isUnique: true,
                              isIdentity: true,
                        },
                  ],
            };

            this.tables.update((prev) => [...prev, newTable]);
            return id;
      }

      updateTable(id: string, field: string, value: any) {
            this.tables.update((prev) =>
                  prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
            );
      }

      updateTablePosition(id: string, x: number, y: number) {
            this.tables.update((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
      }

      deleteTable(id: string | null) {
            if (!id) return;
            this.tables.update((prev) => prev.filter((t) => t.id !== id));
            this.relationships.update((prev) =>
                  prev.filter((r) => r.fromTable !== id && r.toTable !== id),
            );
      }

      addColumn(tableId: string) {
            this.tables.update((prev) =>
                  prev.map((t) => {
                        if (t.id === tableId) {
                              return {
                                    ...t,
                                    columns: [
                                          ...t.columns,
                                          {
                                                id: generateId(),
                                                name: `new_column_${t.columns.length + 1}`,
                                                logicalName: `Column ${t.columns.length + 1}`,
                                                type:
                                                      this.dbEngine() === 'mysql'
                                                            ? 'VARCHAR'
                                                            : 'CHARACTER VARYING',
                                                length: '255',
                                                isPk: false,
                                                isFk: false,
                                                isNullable: true,
                                                isUnique: false,
                                                isIdentity: false,
                                          },
                                    ],
                              };
                        }
                        return t;
                  }),
            );
      }

      updateColumn(tableId: string, colId: string, field: string, value: any) {
            this.tables.update((prev) =>
                  prev.map((t) => {
                        if (t.id === tableId) {
                              return {
                                    ...t,
                                    columns: t.columns.map((c) => {
                                          if (c.id === colId) {
                                                const update = { ...c, [field]: value };
                                                // If user manually changes type, clear metadata history as they are defining new ground truth
                                                if (field === 'type') {
                                                      update.originalType = undefined;
                                                }
                                                return update;
                                          }
                                          return c;
                                    }),
                              };
                        }
                        return t;
                  }),
            );
      }

      deleteColumn(tableId: string, colId: string) {
            this.tables.update((prev) =>
                  prev.map((t) => {
                        if (t.id === tableId) {
                              return {
                                    ...t,
                                    columns: t.columns.filter((c) => c.id !== colId),
                              };
                        }
                        return t;
                  }),
            );
            // Cleanup relationships associated with this column
            this.relationships.update((prev) =>
                  prev.filter(
                        (r) =>
                              !(r.fromTable === tableId && r.fromCol === colId) &&
                              !(r.toTable === tableId && r.toCol === colId),
                  ),
            );
      }

      moveColumn(tableId: string, fromIndex: number, toIndex: number) {
            this.tables.update((prev) =>
                  prev.map((t) => {
                        if (t.id === tableId) {
                              const newCols = [...t.columns];
                              const [moved] = newCols.splice(fromIndex, 1);
                              newCols.splice(toIndex, 0, moved);
                              return { ...t, columns: newCols };
                        }
                        return t;
                  }),
            );
      }

      applyConnection(sourceTId: string, sourceCId: string, targetTId: string, targetCId: string) {
            const tables = this.tables();
            const sourceTable = tables.find((t) => t.id === sourceTId);
            const sourceCol = sourceTable?.columns.find((c) => c.id === sourceCId);
            const targetTable = tables.find((t) => t.id === targetTId);
            const targetCol = targetTable?.columns.find((c) => c.id === targetCId);

            if (sourceCol && targetCol) {
                  // 1. Update Target Column to match Source (FK logic)
                  this.tables.update((prev) =>
                        prev.map((t) => {
                              if (t.id === targetTId) {
                                    return {
                                          ...t,
                                          columns: t.columns.map((c) => {
                                                if (c.id === targetCId) {
                                                      return {
                                                            ...c,
                                                            isFk: true,
                                                            type: getCanonicalType(
                                                                  sourceCol.type,
                                                                  this.dbEngine(),
                                                            ),
                                                            length: sourceCol.length,
                                                      };
                                                }
                                                return c;
                                          }),
                                    };
                              }
                              return t;
                        }),
                  );

                  // 2. Create Relationship
                  const relId = generateId();
                  const relName =
                        `fk_${sourceTable?.name}_${sourceCol.name}_${targetTable?.name}_${targetCol.name}`.toLowerCase();

                  this.relationships.update((prev) => [
                        ...prev,
                        {
                              id: relId,
                              name: relName,
                              fromTable: sourceTId,
                              fromCol: sourceCId,
                              toTable: targetTId,
                              toCol: targetCId,
                              type: '1:N',
                        },
                  ]);
            }
      }

      reconnectRel(
            relId: string,
            newSourceT: string,
            newSourceC: string,
            newTargetT: string,
            newTargetC: string,
      ) {
            const oldRel = this.relationships().find((r) => r.id === relId);
            if (!oldRel) return;

            // 1. Delete old
            this.deleteRel(relId);

            // 2. Create new with same properties but new endpoints
            this.applyConnection(newSourceT, newSourceC, newTargetT, newTargetC);

            // 3. Restore metadata (Name, Cardinality) if possible
            setTimeout(() => {
                  this.relationships.update((rels) => {
                        const last = rels[rels.length - 1];
                        if (last && last.fromTable === newSourceT && last.toTable === newTargetT) {
                              return rels.map((r) =>
                                    r.id === last.id
                                          ? {
                                                  ...r,
                                                  name: oldRel.name,
                                                  type: oldRel.type,
                                                  isManuallyEditable: oldRel.isManuallyEditable,
                                            }
                                          : r,
                              );
                        }
                        return rels;
                  });
            }, 0);
      }

      updateRelName(id: string, name: string) {
            this.relationships.update((prev) =>
                  prev.map((r) => (r.id === id ? { ...r, name } : r)),
            );
      }

      updateCardinality(id: string, type: Relationship['type'], isNullable: boolean = false) {
            this.relationships.update((prev) =>
                  prev.map((r) => (r.id === id ? { ...r, type } : r)),
            );

            const rel = this.relationships().find((r) => r.id === id);
            if (rel) {
                  this.tables.update((prev) =>
                        prev.map((t) => {
                              if (t.id === rel.toTable) {
                                    return {
                                          ...t,
                                          columns: t.columns.map((c) => {
                                                if (c.id === rel.toCol) {
                                                      return { ...c, isNullable: isNullable };
                                                }
                                                return c;
                                          }),
                                    };
                              }
                              return t;
                        }),
                  );
            }
      }

      deleteRel(id: string) {
            const rel = this.relationships().find((r) => r.id === id);
            if (rel) {
                  this.tables.update((prev) =>
                        prev.map((t) => {
                              if (t.id === rel.toTable) {
                                    return {
                                          ...t,
                                          columns: t.columns.map((c) => {
                                                if (c.id === rel.toCol) {
                                                      return { ...c, isFk: false };
                                                }
                                                return c;
                                          }),
                                    };
                              }
                              return t;
                        }),
                  );
            }
            this.relationships.update((prev) => prev.filter((r) => r.id !== id));
      }

      resetRelRouting(id: string) {
            this.relationships.update((prev) =>
                  prev.map((r) =>
                        r.id === id
                              ? {
                                      ...r,
                                      controlPoints: [],
                                      sourceSide: undefined,
                                      targetSide: undefined,
                                }
                              : r,
                  ),
            );
      }

      setRelRouting(
            id: string,
            source: 'left' | 'right' | 'top' | 'bottom',
            target: 'left' | 'right' | 'top' | 'bottom',
      ) {
            this.relationships.update((prev) =>
                  prev.map((r) =>
                        r.id === id ? { ...r, sourceSide: source, targetSide: target } : r,
                  ),
            );
      }

      addControlPoint(relId: string, x: number, y: number, index?: number) {
            this.relationships.update((prev) =>
                  prev.map((r) => {
                        if (r.id !== relId) return r;
                        const newPoints = [...(r.controlPoints || [])];
                        if (index !== undefined) {
                              newPoints.splice(index, 0, { x, y });
                        } else {
                              newPoints.push({ x, y });
                        }
                        return { ...r, controlPoints: newPoints };
                  }),
            );
      }

      updateControlPoint(relId: string, index: number, x: number, y: number) {
            this.relationships.update((prev) =>
                  prev.map((r) => {
                        if (r.id !== relId) return r;
                        const newPoints = [...(r.controlPoints || [])];
                        if (newPoints[index]) {
                              newPoints[index] = { x, y };
                        }
                        return { ...r, controlPoints: newPoints };
                  }),
            );
      }

      deleteControlPoint(relId: string, index: number) {
            this.relationships.update((prev) =>
                  prev.map((r) => {
                        if (r.id !== relId) return r;
                        const newPoints = [...(r.controlPoints || [])];
                        newPoints.splice(index, 1);
                        return { ...r, controlPoints: newPoints };
                  }),
            );
      }

      setControlPoints(relId: string, points: { x: number; y: number }[]) {
            this.relationships.update((prev) =>
                  prev.map((r) => (r.id === relId ? { ...r, controlPoints: points } : r)),
            );
      }

      resetSchema() {
            this.tables.set([]);
            this.relationships.set([]);
      }

      importData(tables: Table[], relationships: Relationship[]) {
            this.tables.set(tables);
            this.relationships.set(relationships);
      }
}
