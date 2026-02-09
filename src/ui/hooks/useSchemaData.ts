import { useState, useMemo, useEffect } from 'react';
import type { Table, Relationship } from '../types';
import type { DbEngine } from '../../utils/dbDataTypes';
import { generateId, TABLE_WIDTH } from '../../utils/geometry';
import { getCanonicalType } from '../../utils/dbDataTypes';

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

const INITIAL_RELS: Relationship[] = [];

export const useSchemaData = (dbEngine: DbEngine) => {
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [relationships, setRelationships] = useState<Relationship[]>(INITIAL_RELS);
  const [isLoaded, setIsLoaded] = useState(false);

  // --- PERSISTENCE LOGIC ---
  // 1. Load from LocalStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('erweb_schema');
      if (savedData) {
        const { tables: savedTables, relationships: savedRels } = JSON.parse(savedData);
        if (Array.isArray(savedTables)) {
          setTables(savedTables);
          setRelationships(savedRels || []);
        }
      }
    } catch (e) {
      console.error('Failed to load schema from local storage', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 2. Save to LocalStorage on change
  useEffect(() => {
    if (isLoaded) {
      const saveData = JSON.stringify({ tables, relationships });
      localStorage.setItem('erweb_schema', saveData);
    }
  }, [tables, relationships, isLoaded]);

  // Actions wrapped in useMemo to prevent unnecessary re-renders
  const actions = useMemo(
    () => ({
      addTable: (sidebarWidth: number, pan: { x: number; y: number }, zoom: number) => {
        const id = generateId();
        const viewportCenterX = (window.innerWidth - sidebarWidth) / 2 + sidebarWidth;
        const viewportCenterY = window.innerHeight / 2;

        // Correct for pan/zoom
        const x = (viewportCenterX - pan.x) / zoom - TABLE_WIDTH / 2;
        const y = (viewportCenterY - pan.y) / zoom - 100;

        const newTable: Table = {
          id,
          name: `TABLE_${tables.length + 1}`,
          logicalName: `New Table ${tables.length + 1}`,
          x,
          y,
          isManuallyEditable: true,
          columns: [
            {
              id: generateId(),
              name: 'id',
              logicalName: 'ID',
              type: dbEngine === 'mysql' ? 'INT' : 'INTEGER',
              length: '',
              isPk: true,
              isFk: false,
              isNullable: false,
              isUnique: true,
              isIdentity: true,
            },
          ],
        };

        setTables((prev) => [...prev, newTable]);
        return id;
      },
      updateTable: (id: string, field: string, value: any) => {
        setTables((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
      },
      deleteTable: (id: string | null) => {
        if (!id) return;
        setTables((prev) => prev.filter((t) => t.id !== id));
        setRelationships((prev) => prev.filter((r) => r.fromTable !== id && r.toTable !== id));
      },
      addColumn: (tableId: string) => {
        setTables((prev) =>
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
                    type: dbEngine === 'mysql' ? 'VARCHAR' : 'CHARACTER VARYING',
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
      },
      updateColumn: (tableId: string, colId: string, field: string, value: any) => {
        setTables((prev) =>
          prev.map((t) => {
            if (t.id === tableId) {
              return {
                ...t,
                columns: t.columns.map((c) => (c.id === colId ? { ...c, [field]: value } : c)),
              };
            }
            return t;
          }),
        );
      },
      deleteColumn: (tableId: string, colId: string) => {
        setTables((prev) =>
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
        setRelationships((prev) =>
          prev.filter(
            (r) =>
              !(r.fromTable === tableId && r.fromCol === colId) &&
              !(r.toTable === tableId && r.toCol === colId),
          ),
        );
      },
      moveColumn: (tableId: string, fromIndex: number, toIndex: number) => {
        setTables((prev) =>
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
      },
      applyConnection: (
        sourceTId: string,
        sourceCId: string,
        targetTId: string,
        targetCId: string,
      ) => {
        const sourceTable = tables.find((t) => t.id === sourceTId);
        const sourceCol = sourceTable?.columns.find((c) => c.id === sourceCId);
        const targetTable = tables.find((t) => t.id === targetTId);
        const targetCol = targetTable?.columns.find((c) => c.id === targetCId);

        if (sourceCol && targetCol) {
          setTables((prev) =>
            prev.map((t) => {
              if (t.id === targetTId) {
                return {
                  ...t,
                  columns: t.columns.map((c) => {
                    if (c.id === targetCId) {
                      return {
                        ...c,
                        isFk: true,
                        type: getCanonicalType(sourceCol.type, dbEngine),
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

          const relId = generateId();
          const relName =
            `fk_${sourceTable?.name}_${sourceCol.name}_${targetTable?.name}_${targetCol.name}`.toLowerCase();

          setRelationships((prev) => [
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
      },
      updateRelName: (id: string, name: string) => {
        setRelationships((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
      },
      updateCardinality: (id: string, type: Relationship['type'], isNullable: boolean = false) => {
        setRelationships((prev) => prev.map((r) => (r.id === id ? { ...r, type } : r)));

        // Find rel to update FK nullability
        const rel = relationships.find((r) => r.id === id);
        // Note: We use the 'relationships' from closure, which might be stale if not careful,
        // but 'setRelationships' functional update handles the state.
        // However, we need to read the rel to find target col.
        // This is where useCallback dependency on 'relationships' is important.

        if (rel) {
          setTables((prev) =>
            prev.map((t) => {
              if (t.id === rel.toTable) {
                return {
                  ...t,
                  columns: t.columns.map((c) => {
                    if (c.id === rel.toCol) {
                      return {
                        ...c,
                        isNullable: isNullable,
                      };
                    }
                    return c;
                  }),
                };
              }
              return t;
            }),
          );
        }
      },
      deleteRel: (id: string) => {
        const rel = relationships.find((r) => r.id === id);
        if (rel) {
          setTables((prev) =>
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
        setRelationships((prev) => prev.filter((r) => r.id !== id));
      },
      resetRelRouting: (id: string) => {
        setRelationships((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, controlPoints: [], sourceSide: undefined, targetSide: undefined }
              : r,
          ),
        );
      },
      setRelRouting: (
        id: string,
        source: 'left' | 'right' | 'top' | 'bottom',
        target: 'left' | 'right' | 'top' | 'bottom',
      ) => {
        setRelationships((prev) =>
          prev.map((r) => (r.id === id ? { ...r, sourceSide: source, targetSide: target } : r)),
        );
      },
      addControlPoint: (relId: string, x: number, y: number, index?: number) => {
        setRelationships((prev) =>
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
      },
      updateControlPoint: (relId: string, index: number, x: number, y: number) => {
        setRelationships((prev) =>
          prev.map((r) => {
            if (r.id !== relId) return r;
            const newPoints = [...(r.controlPoints || [])];
            if (newPoints[index]) {
              newPoints[index] = { x, y };
            }
            return { ...r, controlPoints: newPoints };
          }),
        );
      },
      deleteControlPoint: (relId: string, index: number) => {
        setRelationships((prev) =>
          prev.map((r) => {
            if (r.id !== relId) return r;
            const newPoints = [...(r.controlPoints || [])];
            newPoints.splice(index, 1);
            return { ...r, controlPoints: newPoints };
          }),
        );
      },
      setControlPoints: (relId: string, points: { x: number; y: number }[]) => {
        setRelationships((prev) =>
          prev.map((r) => (r.id === relId ? { ...r, controlPoints: points } : r)),
        );
      },
      resetSchema: () => {
        if (window.confirm('Are you sure you want to delete all tables and start a new diagram?')) {
          setTables([]);
          setRelationships([]);
        }
      },
    }),
    [tables, relationships, dbEngine],
  );

  const viewTables = useMemo(() => tables, [tables]);
  const viewRelationships = useMemo(() => relationships, [relationships]);

  return {
    tables,
    setTables,
    relationships,
    setRelationships,
    viewTables,
    viewRelationships,
    actions,
  };
};
