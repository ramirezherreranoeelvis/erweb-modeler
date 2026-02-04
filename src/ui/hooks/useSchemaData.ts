import { useState, useMemo } from 'react';
import type { Table, Relationship, Column } from '../types';
import { generateId, TABLE_WIDTH } from '../../utils/geometry';

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

// Helper: Check if a table is a "Pure" Associative Table (Intersection)
// Criteria: Exactly 2 columns, both are FKs, and neither is Unique (which would imply 1:1)
// UPDATE: If isManuallyEditable is true, we never hide it (user wants to see it).
const isPureAssociativeTable = (table: Table, allRelationships: Relationship[]): boolean => {
  if (table.isManuallyEditable) return false;
  if (table.columns.length !== 2) return false;

  const col1 = table.columns[0];
  const col2 = table.columns[1];

  // Must act as FKs (checked via isFk flag or existing relationships)
  // And strictly NOT unique (if unique, it behaves like 1:1 or 1:N extension, so show table)
  if (!col1.isFk || !col2.isFk) return false;
  if (col1.isUnique || col2.isUnique) return false;

  // Verify relationships exist targeting these columns
  const rel1 = allRelationships.find(r => r.toTable === table.id && r.toCol === col1.id);
  const rel2 = allRelationships.find(r => r.toTable === table.id && r.toCol === col2.id);

  return !!(rel1 && rel2);
};

export const useSchemaData = (viewMode: string) => {
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [relationships, setRelationships] = useState<Relationship[]>(INITIAL_RELS);

  // --- Derived State for Physical/Logical Views ---
  const { viewTables, viewRelationships } = useMemo(() => {
    // 1. Calculate Virtual Tables for N:M relationships (Physical View)
    const physicalTables = [...tables];
    const physicalRels = [...relationships.filter(r => r.type !== 'N:M')];
    const nmRels = relationships.filter(r => r.type === 'N:M');

    nmRels.forEach((rel) => {
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
        const getVirtualName = (colId: string, defaultName: string) => 
           (rel.virtualColNames && rel.virtualColNames[colId]) ? rel.virtualColNames[colId] : defaultName;

        sourcePks.forEach((pk) => {
          const virtColId = `${intersectId}_src_${pk.id}`;
          newColumns.push({
            ...pk, id: virtColId, name: getVirtualName(virtColId, pk.name),
            isPk: true, isFk: true, isIdentity: false, isNullable: false, isUnique: false,
          });
        });

        targetPks.forEach((pk) => {
          const virtColId = `${intersectId}_tgt_${pk.id}`;
          let defaultName = pk.name;
          if (newColumns.some(c => c.name === defaultName)) defaultName = `${targetTable.name.toLowerCase()}_${pk.name}`;
          
          newColumns.push({
            ...pk, id: virtColId, name: getVirtualName(virtColId, defaultName),
            isPk: true, isFk: true, isIdentity: false, isNullable: false, isUnique: false,
          });
        });

        physicalTables.push({
          id: intersectId, name: intersectName, logicalName: intersectLogicalName,
          x: midX, y: midY, isManuallyEditable: rel.isManuallyEditable, columns: newColumns,
        });

        // Add virtual relationships for physical view
        sourcePks.forEach((pk) => {
          const col = newColumns.find(c => c.id === `${intersectId}_src_${pk.id}`);
          if (col) physicalRels.push({
             id: `virt_rel_src_${rel.id}_${pk.id}`, name: `fk_${sourceTable.name}_${pk.name}`,
             fromTable: sourceTable.id, fromCol: pk.id, toTable: intersectId, toCol: col.id, type: '1:N',
             sourceSide: rel.sourceSide
          });
        });
        targetPks.forEach((pk) => {
          const col = newColumns.find(c => c.id === `${intersectId}_tgt_${pk.id}`);
          if (col) physicalRels.push({
             id: `virt_rel_tgt_${rel.id}_${pk.id}`, name: `fk_${targetTable.name}_${pk.name}`,
             fromTable: targetTable.id, fromCol: pk.id, toTable: intersectId, toCol: col.id, type: '1:N',
             targetSide: rel.targetSide
          });
        });
      }
    });

    if (viewMode === 'physical') {
      return { viewTables: physicalTables, viewRelationships: physicalRels };
    }

    // 2. Logical View Logic
    const logicalTables: Table[] = [];
    const logicalRels: Relationship[] = [...physicalRels.filter(r => !r.id.startsWith('virt_'))]; 
    const hiddenTableIds = new Set<string>();

    physicalTables.forEach(table => {
      // If virtual, skip
      if (table.id.startsWith('virt_')) return;

      if (isPureAssociativeTable(table, relationships)) {
         hiddenTableIds.add(table.id);
         
         // Create Synthetic N:M Relationship
         const relsToTable = relationships.filter(r => r.toTable === table.id);
         if (relsToTable.length === 2) {
            const r1 = relsToTable[0];
            const r2 = relsToTable[1];
            logicalRels.push({
               id: `syn_nm_${table.id}`,
               name: table.logicalName,
               fromTable: r1.fromTable,
               fromCol: r1.fromCol,
               toTable: r2.fromTable,
               toCol: r2.fromCol,
               type: 'N:M',
               logicalName: table.logicalName
            });
         }
      } else {
        logicalTables.push(table);
      }
    });
    
    nmRels.forEach(r => logicalRels.push(r));

    const finalLogicalRels = logicalRels.filter(r => 
      !hiddenTableIds.has(r.toTable) && !hiddenTableIds.has(r.fromTable)
    );

    return { viewTables: logicalTables, viewRelationships: finalLogicalRels };

  }, [tables, relationships, viewMode]);

  // --- Helper: Promote Virtual Table to Real Table ---
  const calculatePromotedState = (virtId: string) => {
    const relId = virtId.replace('virt_', '');
    const rel = relationships.find(r => r.id === relId);
    if (!rel) return null;

    const sourceTable = tables.find(t => t.id === rel.fromTable);
    const targetTable = tables.find(t => t.id === rel.toTable);
    if (!sourceTable || !targetTable) return null;

    const newTableId = generateId();
    const newColumns: Column[] = [];
    const sourcePks = sourceTable.columns.filter(c => c.isPk);
    const targetPks = targetTable.columns.filter(c => c.isPk);
    
    const getVirtualName = (colId: string, def: string) => (rel.virtualColNames?.[colId] || def);

    sourcePks.forEach(pk => {
        const virtColId = `virt_${rel.id}_src_${pk.id}`;
        newColumns.push({
           ...pk, id: generateId(), name: getVirtualName(virtColId, pk.name),
           isPk: true, isFk: true, isIdentity: false, isNullable: false, isUnique: false
        });
    });
    targetPks.forEach(pk => {
        const virtColId = `virt_${rel.id}_tgt_${pk.id}`;
        let def = pk.name;
        if (newColumns.some(c => c.name === def)) def = `${targetTable.name.toLowerCase()}_${pk.name}`;
        newColumns.push({
           ...pk, id: generateId(), name: getVirtualName(virtColId, def),
           isPk: true, isFk: true, isIdentity: false, isNullable: false, isUnique: false
        });
    });

    const newTable: Table = {
       id: newTableId,
       name: rel.name ? rel.name.toUpperCase() : `REL_${sourceTable.name}_${targetTable.name}`,
       logicalName: rel.logicalName || 'Association',
       x: rel.x || (sourceTable.x + targetTable.x)/2,
       y: rel.y || (sourceTable.y + targetTable.y)/2,
       // IMPORTANT: Set to true so it persists as visible even if it still looks like a pure intersection
       isManuallyEditable: true, 
       columns: newColumns
    };

    const newRels: Relationship[] = [];
    sourcePks.forEach((pk, i) => {
       newRels.push({
          id: generateId(), name: `fk_${sourceTable.name}_${newTable.name}`.toLowerCase(),
          fromTable: sourceTable.id, fromCol: pk.id,
          toTable: newTableId, toCol: newColumns[i].id, type: '1:N'
       });
    });
    targetPks.forEach((pk, i) => {
       newRels.push({
          id: generateId(), name: `fk_${targetTable.name}_${newTable.name}`.toLowerCase(),
          fromTable: targetTable.id, fromCol: pk.id,
          toTable: newTableId, toCol: newColumns[sourcePks.length + i].id, type: '1:N'
       });
    });

    return { newTable, newRels, oldRelId: rel.id };
  };

  const actions = {
    addTable: (sidebarWidth: number, pan: {x: number, y: number}, zoom: number, selectedId: string | null) => {
        let newName = 'NEW_TABLE';
        let counter = 1;
        while (tables.some((t) => t.name === newName)) {
          newName = `NEW_TABLE_${counter}`;
          counter++;
        }
        const id = generateId();
        const newTable: Table = {
          id,
          name: newName,
          logicalName: 'New Table',
          x: (-pan.x + (window.innerWidth - sidebarWidth) / 2) / zoom - TABLE_WIDTH / 2,
          y: (-pan.y + window.innerHeight / 2) / zoom,
          isManuallyEditable: true,
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
              isUnique: true,
              isIdentity: true,
            },
          ],
        };
        setTables((prev) => [...prev, newTable]);
        return id;
    },
    updateTable: (id: string, field: string, value: any) => {
        if (id.startsWith('virt_')) {
            const promo = calculatePromotedState(id);
            if (promo) {
                const { newTable, newRels, oldRelId } = promo;
                const updatedTable = { ...newTable, [field]: value };
                setTables(prev => [...prev, updatedTable]);
                setRelationships(prev => [...prev.filter(r => r.id !== oldRelId), ...newRels]);
            }
            return;
        }

        if (field === 'name') {
           if (tables.some(t => t.id !== id && t.name.toLowerCase() === value.toLowerCase())) return;
        }

        setTables((prev) =>
          prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
        );
    },
    deleteTable: (id: string | null) => {
        if (!id) return;
        
        // Handle Virtual N:M Table Deletion
        if (id.startsWith('virt_')) {
            const relId = id.replace('virt_', '');
            // Just remove the N:M relationship
            setRelationships((prev) => prev.filter((r) => r.id !== relId));
            return;
        }

        // Update tables to remove isFk flag if they are losing their FK source
        setTables((prevTables) => {
            const remainingTables = prevTables.filter((t) => t.id !== id);
            // Relationships being removed that might affect FK status
            const relsRemoving = relationships.filter(r => r.fromTable === id || r.toTable === id);

            return remainingTables.map(t => {
                // Check if this table is the TARGET of any removed relationship (meaning it held the FK)
                const incomingRelsRemoved = relsRemoving.filter(r => r.toTable === t.id && r.fromTable === id);
                
                if (incomingRelsRemoved.length === 0) return t;

                const colsToCheck = new Set(incomingRelsRemoved.map(r => r.toCol));
                
                return {
                    ...t,
                    columns: t.columns.map(c => {
                        if (colsToCheck.has(c.id)) {
                             // Check if there are OTHER existing relationships targeting this column
                             // that are NOT being removed (i.e., fromTable is not the deleted id)
                             const otherRels = relationships.filter(r => 
                                 r.toTable === t.id && 
                                 r.toCol === c.id && 
                                 r.fromTable !== id
                             );
                             
                             if (otherRels.length === 0) {
                                 return { ...c, isFk: false };
                             }
                        }
                        return c;
                    })
                };
            });
        });

        setRelationships((prev) =>
          prev.filter((r) => r.fromTable !== id && r.toTable !== id),
        );
    },
    addColumn: (tableId: string) => {
        if (tableId.startsWith('virt_')) {
            const promo = calculatePromotedState(tableId);
            if (promo) {
                const { newTable, newRels, oldRelId } = promo;
                newTable.columns.push({
                    id: generateId(),
                    name: 'new_column',
                    logicalName: 'New Column',
                    type: 'VARCHAR',
                    length: '255',
                    isPk: false,
                    isFk: false,
                    isNullable: true,
                    isUnique: false,
                    isIdentity: false,
                });
                setTables(prev => [...prev, newTable]);
                setRelationships(prev => [...prev.filter(r => r.id !== oldRelId), ...newRels]);
            }
            return;
        }
        setTables((prev) =>
          prev.map((t) => {
            if (t.id === tableId) {
              return {
                ...t,
                columns: [
                  ...t.columns,
                  {
                    id: generateId(),
                    name: 'new_column',
                    logicalName: 'New Column',
                    type: 'VARCHAR',
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
        if (tableId.startsWith('virt_')) {
            const promo = calculatePromotedState(tableId);
            if (promo) {
                const { newTable, newRels, oldRelId } = promo;
                const virtualTable = viewTables.find(t => t.id === tableId);
                const colIndex = virtualTable?.columns.findIndex(c => c.id === colId) ?? -1;

                if (colIndex !== -1 && newTable.columns[colIndex]) {
                    const targetCol = newTable.columns[colIndex];
                    let updatedCol = { ...targetCol, [field]: value };
                    
                    if (field === 'type' && typeof value === 'string') {
                        const match = value.match(/^([^(]+)(?:\(([^)]*)\))?$/);
                        if (match) {
                            updatedCol.type = match[1].trim();
                            if (match[2] !== undefined) updatedCol.length = match[2];
                        } else {
                            updatedCol.type = value;
                        }
                    }
                    
                    if (field === 'isNullable' && value === true) {
                        updatedCol.isPk = false;
                        updatedCol.isIdentity = false;
                    }
                    if (field === 'isPk' && value === true) updatedCol.isNullable = false;
                    
                    newTable.columns[colIndex] = updatedCol;
                }

                setTables(prev => [...prev, newTable]);
                setRelationships(prev => [...prev.filter(r => r.id !== oldRelId), ...newRels]);
            }
            return;
        }

        if (field === 'name') {
           const table = tables.find(t => t.id === tableId);
           if (table && table.columns.some(c => c.id !== colId && c.name.toLowerCase() === value.toLowerCase())) return;
        }

        let updatedColumnData: Column | null = null;

        setTables((prev) =>
          prev.map((t) => {
            if (t.id === tableId) {
              const newColumns = t.columns.map((c) => {
                if (c.id === colId) {
                  let updatedCol = { ...c, [field]: value };
                  
                  if (field === 'type' && typeof value === 'string') {
                    const match = value.match(/^([^(]+)(?:\(([^)]*)\))?$/);
                    if (match) {
                        updatedCol.type = match[1].trim();
                        if (match[2] !== undefined) updatedCol.length = match[2];
                    } else {
                        updatedCol.type = value;
                    }
                  }

                  if (field === 'isNullable' && value === true) {
                    updatedCol.isPk = false;
                    updatedCol.isIdentity = false;
                  }
                  if (field === 'isPk' && value === true) {
                    updatedCol.isNullable = false;
                  }
                  if (field === 'isIdentity' && value === true) {
                    if (updatedCol.isFk) updatedCol.isIdentity = false;
                    else updatedCol.isNullable = false;
                  }
                  updatedColumnData = updatedCol;
                  return updatedCol;
                }
                return c;
              });
              return { ...t, columns: newColumns };
            }
            return t;
          }),
        );

        if (updatedColumnData) {
            const upCol = updatedColumnData as Column;
            if (upCol.isFk) {
                setRelationships(prev => prev.map(r => {
                    if (r.toTable === tableId && r.toCol === colId && field === 'isUnique') {
                         return { 
                             ...r, 
                             type: value ? (upCol.isNullable ? '1:0..1' : '1:1') : (upCol.isNullable ? '1:0..N' : '1:N') 
                         };
                    }
                    return r;
                }));
            }
        }
    },
    deleteColumn: (tableId: string, colId: string) => {
        if (tableId.startsWith('virt_')) return; 
        
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
    applyConnection: (sourceTId: string, sourceCId: string, targetTId: string, targetCId: string) => {
        const relId = generateId();
        const sourceTable = tables.find(t => t.id === sourceTId);
        const sourceCol = sourceTable?.columns.find(c => c.id === sourceCId);
        
        if (!sourceTable || !sourceCol) return;

        const relName = `fk_${sourceTable.name}_${Math.floor(Math.random() * 1000)}`;
        
        setTables(prev => prev.map(t => {
            if (t.id === targetTId) {
                return {
                    ...t,
                    columns: t.columns.map(c => {
                        if (c.id === targetCId) {
                            return {
                                ...c,
                                type: sourceCol.type,
                                length: sourceCol.length,
                                isFk: true
                            }
                        }
                        return c;
                    })
                }
            }
            return t;
        }));

        const newRel: Relationship = {
            id: relId,
            name: relName,
            fromTable: sourceTId,
            fromCol: sourceCId,
            toTable: targetTId,
            toCol: targetCId,
            type: '1:N'
        };
        setRelationships(prev => [...prev, newRel]);
    },
    updateRelName: (id: string, name: string) => {
        if (id.startsWith('virt_rel_')) {
            const virtRel = viewRelationships.find(r => r.id === id);
            if (!virtRel) return;
            const promo = calculatePromotedState(virtRel.toTable);
            if (promo) {
                const { newTable, newRels, oldRelId } = promo;
                const targetRelIndex = newRels.findIndex(r => r.fromTable === virtRel.fromTable && r.fromCol === virtRel.fromCol);
                if (targetRelIndex !== -1) {
                    newRels[targetRelIndex].name = name;
                }
                setTables(prev => [...prev, newTable]);
                setRelationships(prev => [...prev.filter(r => r.id !== oldRelId), ...newRels]);
            }
            return;
        }
        setRelationships(prev => prev.map(r => r.id === id ? { ...r, name } : r));
    },
    updateCardinality: (relId: string, type: Relationship['type'], isNullable: boolean) => {
        if (relId.startsWith('virt_rel_')) {
             const virtRel = viewRelationships.find(r => r.id === relId);
             if (!virtRel) return;
             const promo = calculatePromotedState(virtRel.toTable);
             if (promo) {
                 let { newTable, newRels, oldRelId } = promo;
                 const targetRelIndex = newRels.findIndex(r => r.fromTable === virtRel.fromTable && r.fromCol === virtRel.fromCol);
                 if (targetRelIndex !== -1) {
                     const targetRel = newRels[targetRelIndex];
                     newRels[targetRelIndex] = { ...targetRel, type };

                     const colId = targetRel.toCol;
                     newTable = {
                         ...newTable,
                         columns: newTable.columns.map(c => {
                             if (c.id === colId) {
                                 return {
                                     ...c,
                                     isUnique: type === '1:1' || type === '1:0..1',
                                     isNullable: isNullable
                                 };
                             }
                             return c;
                         })
                     };
                 }
                 setTables(prev => [...prev, newTable]);
                 setRelationships(prev => [...prev.filter(r => r.id !== oldRelId), ...newRels]);
             }
             return;
        }

        const rel = relationships.find(r => r.id === relId);
        if (!rel) return;

        // If switching TO N:M, the original target column is no longer an FK
        // unless it's used by other relationships
        if (type === 'N:M' && rel.type !== 'N:M') {
             setTables(prev => prev.map(t => {
                 if (t.id === rel.toTable) {
                     return {
                         ...t,
                         columns: t.columns.map(c => {
                             if (c.id === rel.toCol) {
                                 // Ensure no other relationship needs this as FK
                                 const otherRels = relationships.filter(r => 
                                     r.id !== relId && 
                                     r.toTable === t.id && 
                                     r.toCol === c.id
                                 );
                                 if (otherRels.length === 0) {
                                     return { ...c, isFk: false };
                                 }
                             }
                             return c;
                         })
                     };
                 }
                 return t;
             }));
        }
        
        setRelationships(prev => prev.map(r => r.id === relId ? { ...r, type } : r));
        
        if (type !== 'N:M' && rel.type !== 'N:M') {
             setTables(prev => prev.map(t => {
                 if (t.id === rel.toTable) {
                     return {
                         ...t,
                         columns: t.columns.map(c => {
                             if (c.id === rel.toCol) {
                                 return { 
                                     ...c, 
                                     isNullable,
                                     isUnique: type === '1:1' || type === '1:0..1'
                                 };
                             }
                             return c;
                         })
                     };
                 }
                 return t;
             }));
        }
    },
    deleteRel: (id: string) => {
        if (id.startsWith('virt_rel_')) {
            const virtRel = viewRelationships.find(r => r.id === id);
            if (!virtRel) return;
            const promo = calculatePromotedState(virtRel.toTable);
            if (promo) {
                const { newTable, newRels, oldRelId } = promo;
                
                const filteredRels = newRels.filter(r => !(r.fromTable === virtRel.fromTable && r.fromCol === virtRel.fromCol));
                const deletedRel = newRels.find(r => r.fromTable === virtRel.fromTable && r.fromCol === virtRel.fromCol);
                let finalTable = newTable;
                if (deletedRel) {
                    finalTable = {
                        ...newTable,
                        columns: newTable.columns.map(c => c.id === deletedRel.toCol ? { ...c, isFk: false } : c)
                    };
                }

                setTables(prev => [...prev, finalTable]);
                setRelationships(prev => [...prev.filter(r => r.id !== oldRelId), ...filteredRels]);
            }
            return;
        }

        const rel = relationships.find(r => r.id === id);
        if (!rel) return;
        
        setRelationships(prev => prev.filter(r => r.id !== id));
        
        if (rel.type !== 'N:M') {
             setTables(prev => prev.map(t => {
                 if (t.id === rel.toTable) {
                     // Check if this column is used by ANY OTHER relationship
                     const otherRels = relationships.filter(r => 
                         r.id !== id && 
                         r.toTable === t.id && 
                         r.toCol === rel.toCol
                     );
                     
                     if (otherRels.length === 0) {
                        return {
                            ...t,
                            columns: t.columns.map(c => {
                                if (c.id === rel.toCol) {
                                    return { ...c, isFk: false };
                                }
                                return c;
                            })
                        };
                     }
                 }
                 return t;
             }));
        }
    },
    resetRelRouting: (id: string) => {
        setRelationships(prev => prev.map(r => r.id === id ? { ...r, sourceSide: undefined, targetSide: undefined, controlPoints: [] } : r));
    },
    setRelRouting: (id: string, source: 'left' | 'right' | 'top' | 'bottom', target: 'left' | 'right' | 'top' | 'bottom') => {
        setRelationships(prev => prev.map(r => r.id === id ? { ...r, sourceSide: source, targetSide: target } : r));
    },
    addControlPoint: (relId: string, x: number, y: number, index?: number) => {
        setRelationships(prev => prev.map(r => {
            if (r.id === relId) {
                const cps = [...(r.controlPoints || [])];
                if (index !== undefined) {
                    cps.splice(index, 0, { x, y });
                } else {
                    cps.push({ x, y });
                }
                return { ...r, controlPoints: cps };
            }
            return r;
        }));
    },
    updateControlPoint: (relId: string, index: number, x: number, y: number) => {
        setRelationships(prev => prev.map(r => {
            if (r.id === relId && r.controlPoints) {
                const cps = [...r.controlPoints];
                if (cps[index]) {
                    cps[index] = { x, y };
                }
                return { ...r, controlPoints: cps };
            }
            return r;
        }));
    },
    deleteControlPoint: (relId: string, index: number) => {
        setRelationships(prev => prev.map(r => {
            if (r.id === relId && r.controlPoints) {
                const cps = [...r.controlPoints];
                cps.splice(index, 1);
                return { ...r, controlPoints: cps };
            }
            return r;
        }));
    },
    setControlPoints: (relId: string, points: { x: number; y: number }[]) => {
        setRelationships(prev => prev.map(r => r.id === relId ? { ...r, controlPoints: points } : r));
    }
  };

  return {
    tables,
    setTables,
    relationships,
    setRelationships,
    viewTables,
    viewRelationships,
    actions
  };
};