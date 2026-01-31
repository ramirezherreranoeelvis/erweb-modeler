import { useState, useMemo } from 'react';
import type { Table, Relationship, Column } from '../types';
import { generateId, TABLE_WIDTH } from '../../utils/geometry';

const INITIAL_TABLES: Table[] = [
  {
    id: 't1',
    name: 'USERS',
    logicalName: 'Customer',
    x: 50,
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
    x: 400,
    y: 100,
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
        id: 'c2',
        name: 'user_id',
        logicalName: 'Customer ID',
        type: 'INT',
        length: '',
        isPk: false,
        isFk: true,
        isNullable: false,
        isUnique: false,
        isIdentity: false,
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
  {
    id: 't3',
    name: 'PRODUCTS',
    logicalName: 'Product Catalog',
    x: 750,
    y: 100,
    isManuallyEditable: false,
    columns: [
      {
        id: 'c1',
        name: 'product_id',
        logicalName: 'Product ID',
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
        name: 'sku',
        logicalName: 'SKU Code',
        type: 'VARCHAR',
        length: '20',
        isPk: false,
        isFk: false,
        isNullable: false,
        isUnique: true,
        isIdentity: false,
      },
      {
        id: 'c3',
        name: 'name',
        logicalName: 'Product Name',
        type: 'VARCHAR',
        length: '100',
        isPk: false,
        isFk: false,
        isNullable: false,
        isUnique: false,
        isIdentity: false,
      },
      {
        id: 'c4',
        name: 'price',
        logicalName: 'Unit Price',
        type: 'DECIMAL',
        length: '10,2',
        isPk: false,
        isFk: false,
        isNullable: false,
        isUnique: false,
        isIdentity: false,
      },
    ],
  },
];

const INITIAL_RELS: Relationship[] = [
  {
    id: 'r1',
    name: 'fk_users_orders',
    fromTable: 't1',
    fromCol: 'c1',
    toTable: 't2',
    toCol: 'c2',
    type: '1:N',
  },
  {
    id: 'r2',
    name: 'rel_orders_products',
    logicalName: 'Order Details',
    fromTable: 't2',
    fromCol: 'c1',
    toTable: 't3',
    toCol: 'c1',
    type: 'N:M',
  },
];

export const useSchemaData = (viewMode: string) => {
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [relationships, setRelationships] = useState<Relationship[]>(INITIAL_RELS);

  // --- Derived State for Physical/Logical Views ---
  const { viewTables, viewRelationships } = useMemo(() => {
    if (viewMode === 'logical') {
      return { viewTables: tables, viewRelationships: relationships };
    }

    const physicalTables = [...tables];
    const physicalRels: Relationship[] = [];

    relationships.forEach((rel) => {
      if (rel.type === 'N:M') {
        const sourceTable = tables.find((t) => t.id === rel.fromTable);
        const targetTable = tables.find((t) => t.id === rel.toTable);

        if (sourceTable && targetTable) {
          const intersectId = `virt_${rel.id}`;
          const intersectName = rel.name
            ? rel.name.toUpperCase()
            : `REL_${sourceTable.name}_${targetTable.name}`;
          const intersectLogicalName = rel.logicalName || rel.name || 'Association';

          let midX = (sourceTable.x + targetTable.x) / 2 + TABLE_WIDTH / 2 - TABLE_WIDTH / 2;
          let midY = (sourceTable.y + targetTable.y) / 2;

          if (rel.x !== undefined && rel.y !== undefined) {
            midX = rel.x;
            midY = rel.y;
          }

          const sourcePks = sourceTable.columns.filter((c) => c.isPk);
          const targetPks = targetTable.columns.filter((c) => c.isPk);
          const newColumns: Column[] = [];

          const getVirtualName = (colId: string, defaultName: string) => {
            if (rel.virtualColNames && rel.virtualColNames[colId]) {
              return rel.virtualColNames[colId];
            }
            return defaultName;
          };

          sourcePks.forEach((pk) => {
            const virtColId = `${intersectId}_src_${pk.id}`;
            newColumns.push({
              ...pk,
              id: virtColId,
              name: getVirtualName(virtColId, pk.name),
              isPk: true,
              isFk: true,
              isIdentity: false,
              isNullable: false,
              isUnique: false,
            });
          });

          targetPks.forEach((pk) => {
            const virtColId = `${intersectId}_tgt_${pk.id}`;
            let defaultName = pk.name;
            const isManual = rel.virtualColNames && rel.virtualColNames[virtColId];

            if (!isManual && newColumns.some((c) => c.name === defaultName)) {
              defaultName = `${targetTable.name.toLowerCase()}_${pk.name}`;
            }

            newColumns.push({
              ...pk,
              id: virtColId,
              name: getVirtualName(virtColId, defaultName),
              isPk: true,
              isFk: true,
              isIdentity: false,
              isNullable: false,
              isUnique: false,
            });
          });

          physicalTables.push({
            id: intersectId,
            name: intersectName,
            logicalName: intersectLogicalName,
            x: midX,
            y: midY,
            isManuallyEditable: rel.isManuallyEditable,
            columns: newColumns,
          });

          sourcePks.forEach((pk) => {
            const targetCol = newColumns.find((c) => c.id === `${intersectId}_src_${pk.id}`);
            if (targetCol) {
              physicalRels.push({
                id: `virt_rel_src_${rel.id}_${pk.id}`,
                name: `fk_${sourceTable.name}_${pk.name}_${intersectName}_${targetCol.name}`.toLowerCase(),
                fromTable: sourceTable.id,
                fromCol: pk.id,
                toTable: intersectId,
                toCol: targetCol.id,
                type: '1:N',
              });
            }
          });

          targetPks.forEach((pk) => {
            const targetCol = newColumns.find((c) => c.id === `${intersectId}_tgt_${pk.id}`);
            if (targetCol) {
              physicalRels.push({
                id: `virt_rel_tgt_${rel.id}_${pk.id}`,
                name: `fk_${targetTable.name}_${pk.name}_${intersectName}_${targetCol.name}`.toLowerCase(),
                fromTable: targetTable.id,
                fromCol: pk.id,
                toTable: intersectId,
                toCol: targetCol.id,
                type: '1:N',
              });
            }
          });
        }
      } else {
        physicalRels.push(rel);
      }
    });

    return { viewTables: physicalTables, viewRelationships: physicalRels };
  }, [tables, relationships, viewMode]);

  // --- CRUD Operations ---

  const applyConnection = (
    sourceTId: string,
    sourceCId: string,
    targetTId: string,
    targetCId: string,
  ) => {
    const sourceTable = tables.find((t) => t.id === sourceTId);
    const targetTable = tables.find((t) => t.id === targetTId);
    const sourceCol = sourceTable?.columns.find((c) => c.id === sourceCId);
    const targetCol = targetTable?.columns.find((c) => c.id === targetCId);

    const name =
      `fk_${sourceTable?.name}_${sourceCol?.name}_${targetTable?.name}_${targetCol?.name}`.toLowerCase();

    const newRel: Relationship = {
      id: generateId(),
      name: name,
      fromTable: sourceTId,
      fromCol: sourceCId,
      toTable: targetTId,
      toCol: targetCId,
      type: '1:N',
    };
    setRelationships((prev) => [...prev, newRel]);

    if (!sourceCol) return;

    setTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id === targetTId) {
          return {
            ...t,
            columns: t.columns.map((c) => {
              if (c.id === targetCId) {
                return {
                  ...c,
                  isFk: true,
                  type: sourceCol.type,
                  length: sourceCol.length,
                  isNullable: sourceCol.isIdentity || !sourceCol.isNullable ? false : true,
                };
              }
              return c;
            }),
          };
        }
        return t;
      }),
    );
  };

  const propagateColumnChanges = (
    parentTableId: string,
    parentColId: string,
    updatedParentCol: Column,
  ) => {
    const childRels = relationships.filter(
      (r) => r.fromTable === parentTableId && r.fromCol === parentColId,
    );
    if (childRels.length === 0) return;

    setTables((prevTables) =>
      prevTables.map((t) => {
        const relevantRel = childRels.find((r) => r.toTable === t.id);
        if (!relevantRel) return t;

        return {
          ...t,
          columns: t.columns.map((col) => {
            if (col.id === relevantRel.toCol) {
              return {
                ...col,
                type: updatedParentCol.type,
                length: updatedParentCol.length,
                isNullable:
                  updatedParentCol.isIdentity || !updatedParentCol.isNullable ? false : true,
              };
            }
            return col;
          }),
        };
      }),
    );
  };

  const updateTable = (id: string, field: string, value: any) => {
    if (id.startsWith('virt_')) {
      const relId = id.replace('virt_', '');
      if (field === 'name') {
        setRelationships((prev) => prev.map((r) => (r.id === relId ? { ...r, name: value } : r)));
      } else if (field === 'logicalName') {
        setRelationships((prev) =>
          prev.map((r) => (r.id === relId ? { ...r, logicalName: value } : r)),
        );
      } else if (field === 'isManuallyEditable') {
        setRelationships((prev) =>
          prev.map((r) => (r.id === relId ? { ...r, isManuallyEditable: value } : r)),
        );
      }
      return;
    }

    if (field === 'name') {
      const nameExists = tables.some(
        (t) => t.id !== id && t.name.toLowerCase() === value.toLowerCase(),
      );
      if (nameExists) return;
    }

    setTables(tables.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const promoteVirtualTable = (virtId: string) => {
    const virtualTable = viewTables.find((t) => t.id === virtId);
    if (!virtualTable) return;

    const relId = virtId.replace('virt_', '');
    const rel = relationships.find((r) => r.id === relId);
    if (!rel) return;

    const newTableId = generateId();
    const newTable: Table = {
      ...virtualTable,
      id: newTableId,
      isManuallyEditable: false,
      columns: virtualTable.columns.map(
        (c) =>
          ({
            ...c,
            id: generateId(),
            _oldId: c.id,
          }) as any,
      ),
    };

    const newRels: Relationship[] = [];
    const connectedRels = viewRelationships.filter((r) => r.toTable === virtId);

    connectedRels.forEach((virtRel) => {
      const newCol = newTable.columns.find((c: any) => c._oldId === virtRel.toCol);
      if (newCol) {
        newRels.push({
          id: generateId(),
          name: virtRel.name,
          fromTable: virtRel.fromTable,
          fromCol: virtRel.fromCol,
          toTable: newTableId,
          toCol: newCol.id,
          type: '1:N',
        });
      }
    });

    newTable.columns.forEach((c: any) => delete c._oldId);

    const extraCol: Column = {
      id: generateId(),
      name: 'new_col',
      logicalName: 'Attribute',
      type: 'VARCHAR',
      length: '45',
      isPk: false,
      isFk: false,
      isNullable: true,
      isUnique: false,
      isIdentity: false,
    };
    newTable.columns.push(extraCol);

    setTables((prev) => [...prev, newTable]);
    setRelationships((prev) => [...prev.filter((r) => r.id !== relId), ...newRels]);
  };

  const addTable = (
    sidebarWidth: number,
    pan: { x: number; y: number },
    zoom: number,
    selectedId: string | null,
  ) => {
    const containerWidth = window.innerWidth - (selectedId ? sidebarWidth : 0) - 224;
    const containerHeight = window.innerHeight - 56;
    const centerX = (-pan.x + containerWidth / 2) / zoom;
    const centerY = (-pan.y + containerHeight / 2) / zoom;

    let newName = 'NEW_TABLE';
    let counter = 1;
    while (tables.some((t) => t.name === newName)) {
      newName = `NEW_TABLE_${counter}`;
      counter++;
    }

    const newTable: Table = {
      id: generateId(),
      name: newName,
      logicalName: 'New Entity',
      x: centerX - 140,
      y: centerY - 100,
      isManuallyEditable: false,
      columns: [
        {
          id: generateId(),
          name: 'id',
          logicalName: 'ID',
          type: 'INT',
          length: '',
          isPk: true,
          isFk: false,
          isNullable: false,
          isUnique: false,
          isIdentity: true,
        },
      ],
    };
    setTables([...tables, newTable]);
    return newTable.id;
  };

  const deleteTable = (id: string | null) => {
    if (!id) return;
    if (id.startsWith('virt_')) return;

    setTables(tables.filter((t) => t.id !== id));
    setRelationships(relationships.filter((r) => r.fromTable !== id && r.toTable !== id));
  };

  const addColumn = (tableId: string) => {
    if (tableId.startsWith('virt_')) {
      promoteVirtualTable(tableId);
      return;
    }

    const table = tables.find((t) => t.id === tableId);
    let newName = 'new_col';
    let counter = 1;
    if (table) {
      while (table.columns.some((c) => c.name === newName)) {
        newName = `new_col_${counter}`;
        counter++;
      }
    }

    const newCol: Column = {
      id: generateId(),
      name: newName,
      logicalName: 'Attribute',
      type: 'VARCHAR',
      length: '45',
      isPk: false,
      isFk: false,
      isNullable: true,
      isUnique: false,
      isIdentity: false,
    };
    setTables(
      tables.map((t) => {
        if (t.id === tableId) return { ...t, columns: [...t.columns, newCol] };
        return t;
      }),
    );
  };

  const updateColumn = (tableId: string, colId: string, field: string, value: any) => {
    if (tableId.startsWith('virt_')) {
      const relId = tableId.replace('virt_', '');
      if (field === 'name') {
        setRelationships((prev) =>
          prev.map((r) => {
            if (r.id === relId) {
              return {
                ...r,
                virtualColNames: {
                  ...(r.virtualColNames || {}),
                  [colId]: value,
                },
              };
            }
            return r;
          }),
        );
      }
      return;
    }

    if (field === 'name') {
      const table = tables.find((t) => t.id === tableId);
      if (table) {
        const nameExists = table.columns.some(
          (c) => c.id !== colId && c.name.toLowerCase() === value.toLowerCase(),
        );
        if (nameExists) return;
      }
    }

    let updatedColumnData: Column | null = null;
    setTables((prevTables) => {
      const newTables = prevTables.map((t) => {
        if (t.id === tableId) {
          const newColumns = t.columns.map((c) => {
            if (c.id === colId) {
              const updatedCol = { ...c, [field]: value };
              if (field === 'isNullable' && value === true) {
                updatedCol.isPk = false;
                updatedCol.isIdentity = false;
              }
              if (field === 'isPk' && value === true) {
                updatedCol.isNullable = false;
              }
              if (field === 'isIdentity' && value === true) {
                updatedCol.isNullable = false;
              }
              updatedColumnData = updatedCol;
              return updatedCol;
            }
            return c;
          });
          return { ...t, columns: newColumns };
        }
        return t;
      });
      return newTables;
    });

    // Defer propagation to allow render cycle to finish if needed, or just run it
    setTimeout(() => {
      if (updatedColumnData) {
        propagateColumnChanges(tableId, colId, updatedColumnData);
        if (updatedColumnData.isFk) {
          setRelationships((prev) =>
            prev.map((r) => {
              if (r.toTable === tableId && r.toCol === colId) {
                if (field === 'isUnique') {
                  if (value === true)
                    return {
                      ...r,
                      type: updatedColumnData!.isNullable ? '1:0..1' : '1:1',
                    };
                  else
                    return {
                      ...r,
                      type: updatedColumnData!.isNullable ? '1:0..N' : '1:N',
                    };
                }

                if (field === 'isNullable') {
                  if (value === true) {
                    return {
                      ...r,
                      type: updatedColumnData!.isUnique ? '1:0..1' : '1:0..N',
                    };
                  } else {
                    return {
                      ...r,
                      type: updatedColumnData!.isUnique ? '1:1' : '1:N',
                    };
                  }
                }
              }
              return r;
            }),
          );
        }
      }
    }, 0);
  };

  const moveColumn = (tableId: string, fromIndex: number, toIndex: number) => {
    setTables((prevTables) =>
      prevTables.map((t) => {
        if (t.id !== tableId) return t;
        const newCols = [...t.columns];
        const [movedCol] = newCols.splice(fromIndex, 1);
        newCols.splice(toIndex, 0, movedCol);
        return { ...t, columns: newCols };
      }),
    );
  };

  const deleteColumn = (tableId: string, colId: string) => {
    if (tableId.startsWith('virt_')) return;

    setTables(
      tables.map((t) => {
        if (t.id === tableId) return { ...t, columns: t.columns.filter((c) => c.id !== colId) };
        return t;
      }),
    );
  };

  const updateRelType = (relId: string, type: any) => {
    const rel = relationships.find((r) => r.id === relId);
    if (!rel) return;

    setRelationships(relationships.map((r) => (r.id === relId ? { ...r, type } : r)));

    if (type === '1:1' || type === '1:N' || type === '1:0..N' || type === '1:0..1') {
      setTables((prevTables) =>
        prevTables.map((t) => {
          if (t.id === rel.toTable) {
            return {
              ...t,
              columns: t.columns.map((c) => {
                if (c.id === rel.toCol) {
                  return {
                    ...c,
                    isUnique: type === '1:1' || type === '1:0..1',
                    isNullable: type === '1:0..N' || type === '1:0..1',
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
  };

  const updateRelName = (id: string, name: string) => {
    setRelationships(relationships.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const resetRelRouting = (relId: string) => {
    setRelationships((prev) =>
      prev.map((r) =>
        r.id === relId ? { ...r, sourceSide: undefined, targetSide: undefined } : r,
      ),
    );
  };

  const deleteRel = (relId: string) => {
    const rel = relationships.find((r) => r.id === relId);
    if (rel) {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === rel.toTable) {
            return {
              ...t,
              columns: t.columns.map((c) => (c.id === rel.toCol ? { ...c, isFk: false } : c)),
            };
          }
          return t;
        }),
      );
    }
    setRelationships(relationships.filter((r) => r.id !== relId));
  };

  return {
    tables,
    setTables,
    relationships,
    setRelationships,
    viewTables,
    viewRelationships,
    actions: {
      addTable,
      updateTable,
      deleteTable,
      addColumn,
      updateColumn,
      moveColumn,
      deleteColumn,
      applyConnection,
      updateRelType,
      updateRelName,
      resetRelRouting,
      deleteRel,
    },
  };
};
