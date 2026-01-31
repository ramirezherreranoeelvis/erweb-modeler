import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Eye, AlertTriangle, GitMerge, Edit3, Lock, Grid } from 'lucide-react';
import type {
  Table,
  Relationship,
  ViewOptions,
  DragInfo,
  TempConnection,
  WarningData,
  Column,
} from './ui/types';
import {
  generateId,
  calculatePath,
  getConnectorPoints,
  getCurveMidpoint,
  TABLE_WIDTH,
} from './utils/geometry';
import Toolbar from './ui/components/Toolbar';
import TableNode from './ui/components/table-nodes';
import PropertiesPanel from './ui/components/PropertiesPanel';

const App = () => {
  // --- Theme State ---
  // Initialize based on system preference to avoid mismatches
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

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    // Safely add listener for various browser versions
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // --- State ---
  const [tables, setTables] = useState<Table[]>([
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
  ]);

  const [relationships, setRelationships] = useState<Relationship[]>([
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
      logicalName: 'Order Details', // Initial Logical Name for the intersection
      fromTable: 't2',
      fromCol: 'c1',
      toTable: 't3',
      toCol: 'c1',
      type: 'N:M',
    },
  ]);

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
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false); // New state to control visibility

  const [zoom, setZoom] = useState<number>(1);
  const [dragInfo, setDragInfo] = useState<DragInfo>({
    isDragging: false,
    offset: { x: 0, y: 0 },
    targetId: null,
  });

  // New Global Edit Mode State
  const [globalEditable, setGlobalEditable] = useState(false);

  // Panning & Layout State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar toggle

  // Main Canvas Ref for coordinate calculations
  const mainRef = useRef<HTMLDivElement>(null);

  // Connecting Lines State
  const [isConnecting, setIsConnecting] = useState(false);
  const [tempConnection, setTempConnection] = useState<TempConnection | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Modals & Menus
  const [relMenu, setRelMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [warningModal, setWarningModal] = useState<WarningData | null>(null);

  // Touch Zoom Refs
  const touchDist = useRef<number | null>(null);

  // --- Derived State for Physical/Logical Views ---
  const { viewTables, viewRelationships } = useMemo(() => {
    // If Logical View: Show everything as is
    if (viewMode === 'logical') {
      return { viewTables: tables, viewRelationships: relationships };
    }

    // If Physical View: Transform N:M relationships into Intersection Tables
    const physicalTables = [...tables];
    const physicalRels: Relationship[] = [];

    relationships.forEach((rel) => {
      if (rel.type === 'N:M') {
        const sourceTable = tables.find((t) => t.id === rel.fromTable);
        const targetTable = tables.find((t) => t.id === rel.toTable);

        if (sourceTable && targetTable) {
          // 1. Define Intersection Table Details
          const intersectId = `virt_${rel.id}`;
          // Use the relationship name as the Physical table name
          const intersectName = rel.name
            ? rel.name.toUpperCase()
            : `REL_${sourceTable.name}_${targetTable.name}`;

          // Use the relationship logicalName as the Logical table name, fallback to name
          const intersectLogicalName = rel.logicalName || rel.name || 'Association';

          // Position it between the two tables or use stored position
          let midX = (sourceTable.x + targetTable.x) / 2 + TABLE_WIDTH / 2 - TABLE_WIDTH / 2; // Center align
          let midY = (sourceTable.y + targetTable.y) / 2;

          if (rel.x !== undefined && rel.y !== undefined) {
            midX = rel.x;
            midY = rel.y;
          }

          // 2. Derive Columns from Source/Target PKs
          const sourcePks = sourceTable.columns.filter((c) => c.isPk);
          const targetPks = targetTable.columns.filter((c) => c.isPk);

          const newColumns: Column[] = [];

          const getVirtualName = (colId: string, defaultName: string) => {
            if (rel.virtualColNames && rel.virtualColNames[colId]) {
              return rel.virtualColNames[colId];
            }
            return defaultName;
          };

          // Add Source PKs to Intersection
          sourcePks.forEach((pk) => {
            const virtColId = `${intersectId}_src_${pk.id}`;
            newColumns.push({
              ...pk,
              id: virtColId,
              name: getVirtualName(virtColId, pk.name),
              isPk: true, // Composite PK
              isFk: true,
              isIdentity: false, // Lose identity in intersection
              isNullable: false,
              isUnique: false,
            });
          });

          // Add Target PKs to Intersection
          targetPks.forEach((pk) => {
            const virtColId = `${intersectId}_tgt_${pk.id}`;
            // Handle naming collisions if not manually renamed
            let defaultName = pk.name;
            const isManual = rel.virtualColNames && rel.virtualColNames[virtColId];

            if (!isManual && newColumns.some((c) => c.name === defaultName)) {
              defaultName = `${targetTable.name.toLowerCase()}_${pk.name}`;
            }

            newColumns.push({
              ...pk,
              id: virtColId,
              name: getVirtualName(virtColId, defaultName),
              isPk: true, // Composite PK
              isFk: true,
              isIdentity: false,
              isNullable: false,
              isUnique: false,
            });
          });

          // Push Virtual Table
          physicalTables.push({
            id: intersectId,
            name: intersectName,
            logicalName: intersectLogicalName,
            x: midX,
            y: midY,
            // Virtual tables inherit "locked" state if global is on, but generally shouldn't be draggable if logic dictates
            isManuallyEditable: rel.isManuallyEditable,
            columns: newColumns,
          });

          // 3. Create 1:N Relationships linking to the Intersection Table
          // Source -> Intersection
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

          // Target -> Intersection
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
        // Not N:M, render normally
        physicalRels.push(rel);
      }
    });

    return { viewTables: physicalTables, viewRelationships: physicalRels };
  }, [tables, relationships, viewMode]);

  // --- Logic ---

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

    // Naming convention: fk_table1_col1_table2_col2
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

    // Sync Child Data
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

  const startConnection = (
    e: React.PointerEvent,
    tableId: string,
    colId: string,
    side: 'left' | 'right',
  ) => {
    e.stopPropagation();
    // Do NOT prevent default here to allow pointer capture if needed, though stopPropagation is key
    // e.preventDefault();
    setRelMenu(null);

    // Initial start position (approximate, refined by geometry logic)
    const table = viewTables.find((t) => t.id === tableId); // Use viewTables to support connecting to real tables
    if (!table) return;

    // Prevent connecting from virtual tables (optional constraint for simplicity)
    if (tableId.startsWith('virt_')) return;

    setIsConnecting(true);
    setTempConnection({
      sourceTableId: tableId,
      sourceColId: colId,
      startX: table.x + (side === 'right' ? 280 : 0),
      startY: table.y + 40, // simplified, will update on render
      side,
    });

    // Capture the pointer on the canvas to track movement even if we leave the node
    if (mainRef.current) {
      mainRef.current.setPointerCapture(e.pointerId);
    }
  };

  const completeConnectionToNewColumn = (e: React.MouseEvent, targetTableId: string) => {
    if (isConnecting && tempConnection) {
      e.stopPropagation();

      const sourceTable = tables.find((t) => t.id === tempConnection.sourceTableId);
      const sourceCol = sourceTable?.columns.find((c) => c.id === tempConnection.sourceColId);
      const targetTable = tables.find((t) => t.id === targetTableId);

      // Prevent dropping on virtual tables
      if (targetTableId.startsWith('virt_')) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      if (!sourceCol || !targetTable) return;

      let newName = sourceCol.name;
      let newLogicalName = sourceCol.logicalName;
      let counter = 2;

      while (targetTable.columns.some((c) => c.name.toLowerCase() === newName.toLowerCase())) {
        newName = `${sourceCol.name}${counter}`;
        newLogicalName = `${sourceCol.logicalName} ${counter}`;
        counter++;
      }

      const newColId = generateId();
      const newCol: Column = {
        id: newColId,
        name: newName,
        logicalName: newLogicalName,
        type: sourceCol.type,
        length: sourceCol.length,
        isPk: false,
        isFk: true,
        isNullable: sourceCol.isIdentity || !sourceCol.isNullable ? false : true,
        isUnique: false,
        isIdentity: false,
      };

      setTables((prev) =>
        prev.map((t) => {
          if (t.id === targetTableId) {
            return { ...t, columns: [...t.columns, newCol] };
          }
          return t;
        }),
      );

      const relName =
        `fk_${sourceTable?.name}_${sourceCol.name}_${targetTable.name}_${newName}`.toLowerCase();

      const newRel: Relationship = {
        id: generateId(),
        name: relName,
        fromTable: tempConnection.sourceTableId,
        fromCol: tempConnection.sourceColId,
        toTable: targetTableId,
        toCol: newColId,
        type: '1:N',
      };
      setRelationships((prev) => [...prev, newRel]);

      setIsConnecting(false);
      setTempConnection(null);
    }
  };

  const completeConnection = (e: React.MouseEvent, targetTableId: string, targetColId: string) => {
    if (isConnecting && tempConnection) {
      e.stopPropagation();

      const sourceTId = tempConnection.sourceTableId;
      const sourceCId = tempConnection.sourceColId;

      if (sourceTId === targetTableId && sourceCId === targetColId) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      // Prevent connecting to virtual tables
      if (targetTableId.startsWith('virt_') || sourceTId.startsWith('virt_')) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      const exists = relationships.find(
        (r) =>
          (r.fromTable === sourceTId &&
            r.fromCol === sourceCId &&
            r.toTable === targetTableId &&
            r.toCol === targetColId) ||
          (r.toTable === sourceTId &&
            r.toCol === sourceCId &&
            r.fromTable === targetTableId &&
            r.fromCol === targetColId),
      );

      if (exists) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      const sourceTable = tables.find((t) => t.id === sourceTId);
      const sourceCol = sourceTable?.columns.find((c) => c.id === sourceCId);
      const targetTable = tables.find((t) => t.id === targetTableId);
      const targetCol = targetTable?.columns.find((c) => c.id === targetColId);

      if (!sourceCol || !targetCol) return;

      if (targetCol.isFk) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      const expectedType = sourceCol.type;
      const expectedLength = sourceCol.length;
      const expectedNullable = sourceCol.isIdentity || !sourceCol.isNullable ? false : true;

      const hasMismatch =
        targetCol.type !== expectedType ||
        targetCol.length !== expectedLength ||
        targetCol.isNullable !== expectedNullable;

      if (hasMismatch) {
        setWarningModal({
          isOpen: true,
          pendingData: {
            sourceTId,
            sourceCId,
            targetTId: targetTableId,
            targetCId: targetColId,
            sourceCol,
            targetCol,
          },
        });
      } else {
        applyConnection(sourceTId, sourceCId, targetTableId, targetColId);
      }

      setIsConnecting(false);
      setTempConnection(null);
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Only handle primary pointer (left mouse/touch)
    if (e.isPrimary && e.button === 0) {
      // If we clicked on the empty canvas, deselect everything
      setSelectedId(null);
      setIsPropertiesPanelOpen(false); // Close panel on canvas click
      setRelMenu(null);

      // Start panning
      setIsPanning(true);
      // Capture pointer to ensure we get moves even outside canvas
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  // --- Pinch to Zoom Logic ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      touchDist.current = d;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDist.current !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const scale = newDist / touchDist.current;
      setZoom((prev) => Math.min(Math.max(0.5, prev * scale), 2));
      touchDist.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    touchDist.current = null;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // 1. Sidebar Resizing
    if (isResizingSidebar) {
      const newWidth = Math.max(300, window.innerWidth - e.clientX);
      setSidebarWidth(newWidth);
      return;
    }

    // Only process canvas interactions if we have the ref
    if (!mainRef.current) return;

    // 2. Canvas Panning
    if (isPanning) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }

    // 3. Coordinate Calculation (Account for Pan & Zoom)
    // Use mainRef to get coordinate relative to the canvas, regardless of where mouse is
    const canvasRect = mainRef.current.getBoundingClientRect();
    const rawX = e.clientX - canvasRect.left;
    const rawY = e.clientY - canvasRect.top;

    // IMPORTANT: Subtract pan offset before dividing by zoom
    const x = (rawX - pan.x) / zoom;
    const y = (rawY - pan.y) / zoom;

    setMousePos({ x: rawX - pan.x, y: rawY - pan.y });

    if (dragInfo.isDragging && dragInfo.targetId) {
      // Handle Virtual Table Dragging
      if (dragInfo.targetId.startsWith('virt_')) {
        const relId = dragInfo.targetId.replace('virt_', '');
        const newX = x - dragInfo.offset.x;
        const newY = y - dragInfo.offset.y;

        setRelationships((prev) =>
          prev.map((r) => (r.id === relId ? { ...r, x: newX, y: newY } : r)),
        );
        return;
      }

      // Normal Table Dragging
      setTables(
        tables.map((t) =>
          t.id === dragInfo.targetId
            ? { ...t, x: x - dragInfo.offset.x, y: y - dragInfo.offset.y }
            : t,
        ),
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    setIsResizingSidebar(false);
    setDragInfo({ isDragging: false, offset: { x: 0, y: 0 }, targetId: null });
    if (isConnecting) {
      setIsConnecting(false);
      setTempConnection(null);
    }
    // Release capture if it was captured
    if (e.target instanceof HTMLElement && e.target.hasPointerCapture(e.pointerId)) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  const handleTablePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    // e.preventDefault(); // Prevent scrolling on touch
    setRelMenu(null);

    // Use viewTables because we might be clicking a virtual table
    const targetTable = viewTables.find((t) => t.id === id);

    // If Global Edit is On, OR specific table is manually editable -> Lock Dragging (Do NOT set dragInfo)
    const isLocked = globalEditable || (targetTable && targetTable.isManuallyEditable);

    if (isLocked) {
      // Just select it, don't drag.
      // IMPORTANT: In Edit Mode, we DO NOT open the properties panel automatically on click.
      // This allows the user to interact with the table (e.g. drag columns) without the panel popping up.
      setSelectedId(id);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    // Adjust mouse offset calculation to account for pan
    const offsetX = (e.clientX - rect.left) / zoom;
    const offsetY = (e.clientY - rect.top) / zoom;

    setDragInfo({ isDragging: true, offset: { x: offsetX, y: offsetY }, targetId: id });

    // Select both real and virtual tables to allow property editing
    setSelectedId(id);

    // Only auto-open properties panel on Desktop. On mobile, user must click the "Config" button.
    if (window.innerWidth >= 768) {
      setIsPropertiesPanelOpen(true);
    }

    // Capture pointer for table dragging
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleConfigTable = (id: string) => {
    setSelectedId(id);
    setIsPropertiesPanelOpen(true);
  };

  // --- CRUD Operations ---
  const addTable = () => {
    // Close sidebar on mobile when adding table
    setIsSidebarOpen(false);

    // Center new table in the current view
    // View center relative to canvas origin = (-pan.x + containerWidth/2) / zoom
    const containerWidth = window.innerWidth - (selectedId ? sidebarWidth : 0) - 224; // approx sidebar widths
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
      x: centerX - 140, // Half table width
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
    setSelectedId(newTable.id);
    // Open properties panel for new table
    setIsPropertiesPanelOpen(true);
  };

  const deleteTable = () => {
    if (!selectedId) return;
    if (selectedId.startsWith('virt_')) return; // Cannot delete virtual table directly (must delete relationship)

    setTables(tables.filter((t) => t.id !== selectedId));
    setRelationships(
      relationships.filter((r) => r.fromTable !== selectedId && r.toTable !== selectedId),
    );
    setSelectedId(null);
    setIsPropertiesPanelOpen(false);
  };

  const updateTable = (id: string, field: string, value: any) => {
    // Handle Virtual Table Rename (Modifies Relationship)
    if (id.startsWith('virt_')) {
      const relId = id.replace('virt_', '');

      if (field === 'name') {
        // Update Physical Name
        setRelationships((prev) => prev.map((r) => (r.id === relId ? { ...r, name: value } : r)));
      } else if (field === 'logicalName') {
        // Update Logical Name
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

    // Enforce Unique Table Name
    if (field === 'name') {
      const nameExists = tables.some(
        (t) => t.id !== id && t.name.toLowerCase() === value.toLowerCase(),
      );
      if (nameExists) return;
    }

    setTables(tables.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const addColumn = (tableId: string) => {
    // PROMOTION LOGIC: If adding column to virtual table, convert to real table
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

  // Function to promote a virtual N:M table to a real Entity
  const promoteVirtualTable = (virtId: string) => {
    const virtualTable = viewTables.find((t) => t.id === virtId);
    if (!virtualTable) return;

    const relId = virtId.replace('virt_', '');
    const rel = relationships.find((r) => r.id === relId);
    if (!rel) return;

    // 1. Create Real Table
    const newTableId = generateId();
    const newTable: Table = {
      ...virtualTable,
      id: newTableId,
      isManuallyEditable: false,
      // Clone columns with new IDs to avoid conflicts, but keep track of mapping
      columns: virtualTable.columns.map(
        (c) =>
          ({
            ...c,
            id: generateId(),
            _oldId: c.id, // Temporary property to map relationships
          }) as any,
      ),
    };

    // 2. Create Real Relationships (1:N) based on existing virtual ones
    const newRels: Relationship[] = [];

    // Find relationships connecting to the virtual table from viewRelationships
    const connectedRels = viewRelationships.filter((r) => r.toTable === virtId);

    connectedRels.forEach((virtRel) => {
      // Find which column in the new table corresponds to the virtual FK
      const newCol = newTable.columns.find((c: any) => c._oldId === virtRel.toCol);

      if (newCol) {
        newRels.push({
          id: generateId(),
          name: virtRel.name, // Preserve generated name
          fromTable: virtRel.fromTable,
          fromCol: virtRel.fromCol,
          toTable: newTableId,
          toCol: newCol.id,
          type: '1:N',
        });
      }
    });

    // Clean up temporary property
    newTable.columns.forEach((c: any) => delete c._oldId);

    // 3. Add the "New Column" that triggered this promotion
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

    // 4. Update State: Add Table, Add New Rels, Remove Old N:M Rel
    setTables((prev) => [...prev, newTable]);
    setRelationships((prev) => [
      ...prev.filter((r) => r.id !== relId), // Remove the N:M relationship
      ...newRels,
    ]);
    setSelectedId(newTableId);
    setIsPropertiesPanelOpen(true);
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

  const updateColumn = (tableId: string, colId: string, field: string, value: any) => {
    // Handle Virtual Table Column Rename
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

    // Enforce Unique Column Name
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
    setTimeout(() => {
      if (updatedColumnData) {
        propagateColumnChanges(tableId, colId, updatedColumnData);

        // Reactive Logic for Relationships
        if (updatedColumnData.isFk) {
          setRelationships((prev) =>
            prev.map((r) => {
              // Only if this relationship targets this column
              if (r.toTable === tableId && r.toCol === colId) {
                // Case 1: Toggling Unique (1:1 <-> 1:N)
                if (field === 'isUnique') {
                  // If turning ON unique: check if nullable to decide between 1:1 and 1:0..1
                  if (value === true)
                    return {
                      ...r,
                      type: updatedColumnData!.isNullable ? '1:0..1' : '1:1',
                    };
                  // If turning OFF unique: check if nullable to decide between 1:N and 1:0..N
                  else
                    return {
                      ...r,
                      type: updatedColumnData!.isNullable ? '1:0..N' : '1:N',
                    };
                }

                // Case 2: Toggling Nullable (1:N <-> 1:0..N) or (1:1 <-> 1:0..1)
                if (field === 'isNullable') {
                  // If turning ON Nullable
                  if (value === true) {
                    return {
                      ...r,
                      type: updatedColumnData!.isUnique ? '1:0..1' : '1:0..N',
                    };
                  }
                  // If turning OFF Nullable
                  else {
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

  const deleteColumn = (tableId: string, colId: string) => {
    // If virtual, maybe prevent or promote? For now, prevent.
    if (tableId.startsWith('virt_')) return;

    setTables(
      tables.map((t) => {
        if (t.id === tableId) return { ...t, columns: t.columns.filter((c) => c.id !== colId) };
        return t;
      }),
    );
  };

  const handleRelClick = (e: React.MouseEvent, relId: string) => {
    e.stopPropagation();
    // Do not allow opening menu for virtual relationships generated by N:M view
    if (relId.startsWith('virt_')) return;
    setRelMenu({ id: relId, x: e.clientX, y: e.clientY });
  };

  const updateRelType = (type: any) => {
    if (!relMenu) return;

    // Find the current relationship
    const rel = relationships.find((r) => r.id === relMenu.id);
    if (!rel) return;

    // Update the relationship type
    setRelationships(relationships.map((r) => (r.id === relMenu.id ? { ...r, type } : r)));

    // Automatically toggle Unique and Nullable constraints on the target column
    if (type === '1:1' || type === '1:N' || type === '1:0..N' || type === '1:0..1') {
      setTables((prevTables) =>
        prevTables.map((t) => {
          // Find target table
          if (t.id === rel.toTable) {
            return {
              ...t,
              columns: t.columns.map((c) => {
                // Find target column
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

    setRelMenu(null);
  };

  const updateRelName = (id: string, name: string) => {
    setRelationships(relationships.map((r) => (r.id === id ? { ...r, name } : r)));
  };

  const deleteRel = () => {
    if (!relMenu) return;
    const rel = relationships.find((r) => r.id === relMenu.id);
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
    setRelationships(relationships.filter((r) => r.id !== relMenu.id));
    setRelMenu(null);
  };

  const selectedTable = viewTables.find((t) => t.id === selectedId);

  // SVG Colors based on theme
  const strokeColor = theme === 'dark' ? '#94a3b8' : '#475569';
  const gridColor = theme === 'dark' ? '#334155' : '#cbd5e1';

  // Calculate background image based on gridStyle
  const getGridBackground = () => {
    if (viewOptions.gridStyle === 'dots')
      return `radial-gradient(${gridColor} 1px, transparent 1px)`;
    if (viewOptions.gridStyle === 'squares')
      return `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`;
    return 'none';
  };

  return (
    <div
      className={`${theme} w-full min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200`}
    >
      <div
        className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200"
        onClick={() => setRelMenu(null)}
        // Switched to Pointer Events for consistent mobile/desktop interaction
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        // Add onPointerCancel to handle interruptions (like scrolling on touch)
        onPointerCancel={handlePointerUp}
        // Touch handlers for pinch-to-zoom
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Warning Modal */}
        {warningModal && warningModal.isOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/30 rounded-t-lg">
                <div className="bg-amber-100 dark:bg-amber-800 p-2 rounded-full text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                  Integrity Warning
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  The target column{' '}
                  <span className="font-bold text-slate-800 dark:text-white">
                    {warningModal.pendingData.targetCol.name}
                  </span>{' '}
                  has different properties than source{' '}
                  <span className="font-bold text-slate-800 dark:text-white">
                    {warningModal.pendingData.sourceCol.name}
                  </span>
                  .
                </p>
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Source:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      {warningModal.pendingData.sourceCol.type}(
                      {warningModal.pendingData.sourceCol.length})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target:</span>
                    <span className="text-red-500 font-bold line-through">
                      {warningModal.pendingData.targetCol.type}(
                      {warningModal.pendingData.targetCol.length})
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Continuing will{' '}
                  <strong className="text-amber-600 dark:text-amber-400">overwrite</strong> target
                  properties.
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-b-lg flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setWarningModal(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    applyConnection(
                      warningModal.pendingData.sourceTId,
                      warningModal.pendingData.sourceCId,
                      warningModal.pendingData.targetTId,
                      warningModal.pendingData.targetCId,
                    );
                    setWarningModal(null);
                  }}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors"
                >
                  Sync & Connect
                </button>
              </div>
            </div>
          </div>
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

        {/* Main Layout */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile Backdrop for Sidebar */}
          {isSidebarOpen && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-20 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            ></div>
          )}

          {/* Sidebar - Responsive Drawer */}
          <aside
            className={`
          fixed top-14 bottom-0 left-0 w-64 md:w-56 z-30
          bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 
          flex flex-col p-3 shadow-xl md:shadow-sm md:static shrink-0 gap-4 overflow-y-auto transition-transform duration-300
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
          >
            {/* Global Edit Mode Checkbox */}
            <button
              onClick={() => setGlobalEditable(!globalEditable)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${globalEditable ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
            >
              <div
                className={`p-2 rounded-full ${globalEditable ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}
              >
                {globalEditable ? <Edit3 size={16} /> : <Lock size={16} />}
              </div>
              <div className="text-left">
                <div
                  className={`text-xs font-bold ${globalEditable ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Global Edit Mode
                </div>
                <div className="text-[9px] text-slate-400 leading-none mt-0.5">
                  {globalEditable ? 'All tables unlocked' : 'Manual selection'}
                </div>
              </div>
            </button>

            {/* Desktop-only Buttons */}
            <div className="hidden md:grid grid-cols-2 gap-2">
              <button
                onClick={addTable}
                className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-blue-700 dark:text-blue-300 transition-all gap-1 group"
              >
                <Plus size={20} /> <span className="text-[10px] font-bold">New Table</span>
              </button>
              <button
                onClick={deleteTable}
                disabled={!selectedId}
                className={`flex flex-col items-center justify-center p-3 border rounded-lg transition-all gap-1 ${selectedId ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}
              >
                <Trash2 size={20} /> <span className="text-[10px] font-bold">Delete</span>
              </button>
            </div>

            <div className="h-[1px] bg-slate-200 dark:bg-slate-700"></div>
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                <Eye size={12} /> View Options
              </h3>
              <div className="space-y-2">
                {Object.entries(viewOptions).map(([key, val]) => {
                  if (key === 'lineStyle' || key === 'gridStyle') return null;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <input
                        type="checkbox"
                        checked={val as boolean}
                        onChange={(e) =>
                          setViewOptions({
                            ...viewOptions,
                            [key]: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      {key
                        .replace(/^show/, '')
                        .replace(/([A-Z])/g, ' $1')
                        .trim()}
                    </label>
                  );
                })}
              </div>

              {/* Grid Style Selector */}
              <div className="mt-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Grid size={12} /> Grid Style
                </h3>
                <select
                  value={viewOptions.gridStyle}
                  onChange={(e) =>
                    setViewOptions({ ...viewOptions, gridStyle: e.target.value as any })
                  }
                  className="w-full text-xs p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="none">None</option>
                  <option value="dots">Dots</option>
                  <option value="squares">Squares</option>
                </select>
              </div>

              <div className="mt-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <GitMerge size={12} /> Line Style
                </h3>
                <div className="flex bg-slate-100 dark:bg-slate-700 p-0.5 rounded border border-slate-200 dark:border-slate-600">
                  <button
                    onClick={() =>
                      setViewOptions({
                        ...viewOptions,
                        lineStyle: 'curved',
                      })
                    }
                    className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${viewOptions.lineStyle === 'curved' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                  >
                    Curved
                  </button>
                  <button
                    onClick={() =>
                      setViewOptions({
                        ...viewOptions,
                        lineStyle: 'orthogonal',
                      })
                    }
                    className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${viewOptions.lineStyle === 'orthogonal' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                  >
                    Quadratic
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <main
            ref={mainRef}
            className="flex-1 bg-slate-50 dark:bg-slate-900 relative overflow-hidden transition-colors duration-200 touch-none"
            onPointerDown={handleCanvasPointerDown}
            style={{
              backgroundImage: getGridBackground(),
              backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
              cursor: isPanning
                ? 'grabbing'
                : isConnecting
                  ? 'crosshair'
                  : dragInfo.isDragging
                    ? 'grabbing'
                    : 'grab',
            }}
          >
            <div
              className="absolute top-0 left-0 w-full h-full origin-top-left"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <svg
                className="absolute top-0 left-0 w-[10000px] h-[10000px] pointer-events-none z-0"
                style={{ transform: 'translate(-5000px, -5000px)' }}
              >
                <defs>
                  <marker
                    id="oneStart"
                    markerWidth="12"
                    markerHeight="12"
                    refX="0"
                    refY="6"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <line x1="1" y1="0" x2="1" y2="12" stroke={strokeColor} strokeWidth="1.5" />
                    <line x1="5" y1="0" x2="5" y2="12" stroke={strokeColor} strokeWidth="1.5" />
                  </marker>

                  {/* Standard One to Many */}
                  <marker
                    id="manyEnd"
                    markerWidth="12"
                    markerHeight="12"
                    refX="11"
                    refY="6"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path
                      d="M0,6 L11,6 M11,0 L0,6 L11,12"
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="1.5"
                    />
                    <line x1="7" y1="0" x2="7" y2="12" stroke={strokeColor} strokeWidth="1.5" />
                  </marker>

                  {/* Standard One to One */}
                  <marker
                    id="oneEnd"
                    markerWidth="12"
                    markerHeight="12"
                    refX="11"
                    refY="6"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <line x1="7" y1="0" x2="7" y2="12" stroke={strokeColor} strokeWidth="1.5" />
                    <line x1="11" y1="0" x2="11" y2="12" stroke={strokeColor} strokeWidth="1.5" />
                  </marker>

                  {/* Zero to Many (Circle + Crow Foot) */}
                  <marker
                    id="zeroManyEnd"
                    markerWidth="14"
                    markerHeight="12"
                    refX="13"
                    refY="6"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <circle
                      cx="5"
                      cy="6"
                      r="3"
                      fill={theme === 'dark' ? '#1e293b' : 'white'}
                      stroke={strokeColor}
                      strokeWidth="1.5"
                    />
                    <path
                      d="M8,6 L13,6 M13,0 L8,6 L13,12"
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="1.5"
                    />
                  </marker>

                  {/* Zero to One (Circle + Line) */}
                  <marker
                    id="zeroOneEnd"
                    markerWidth="14"
                    markerHeight="12"
                    refX="13"
                    refY="6"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <circle
                      cx="5"
                      cy="6"
                      r="3"
                      fill={theme === 'dark' ? '#1e293b' : 'white'}
                      stroke={strokeColor}
                      strokeWidth="1.5"
                    />
                    <line x1="13" y1="0" x2="13" y2="12" stroke={strokeColor} strokeWidth="1.5" />
                    <line x1="8" y1="6" x2="13" y2="6" stroke={strokeColor} strokeWidth="1.5" />
                  </marker>
                </defs>
                <g transform="translate(5000, 5000)">
                  {viewRelationships.map((rel) => {
                    const isSelected = relMenu && relMenu.id === rel.id;
                    let startM: string | undefined = 'url(#oneStart)';
                    let endM: string | undefined = 'url(#manyEnd)';
                    let startLabel = '1',
                      endLabel = 'N';

                    if (rel.type === '1:1') {
                      endM = 'url(#oneEnd)';
                      endLabel = '1';
                    }
                    if (rel.type === '1:0..N') {
                      endM = 'url(#zeroManyEnd)';
                      endLabel = '0..N';
                    }
                    if (rel.type === '1:0..1') {
                      endM = 'url(#zeroOneEnd)';
                      endLabel = '0..1';
                    }

                    if (rel.type === 'N:M') {
                      startM = 'url(#manyEnd)';
                      endM = 'url(#manyEnd)';
                      startLabel = 'N';
                      endLabel = 'M';
                    }
                    if (rel.type === 'N:1') {
                      startM = 'url(#manyEnd)';
                      endM = 'url(#oneEnd)';
                      startLabel = 'N';
                      endLabel = '1';
                    }

                    if (!viewOptions.showCardinality) {
                      startM = undefined;
                      endM = undefined;
                    }

                    // Calculate position for text labels
                    const pts = getConnectorPoints(rel, viewTables); // Use viewTables for calculation
                    const midpoint = getCurveMidpoint(rel, viewTables, viewOptions.lineStyle);

                    // Calculate dynamic width for the label background based on character count
                    const charWidth = 6; // Approximate width per character in pixels
                    const padding = 16;
                    const labelWidth = (rel.name ? rel.name.length * charWidth : 40) + padding;

                    return (
                      <g
                        key={rel.id}
                        className="pointer-events-auto cursor-pointer group"
                        onClick={(e) => handleRelClick(e, rel.id)}
                      >
                        {/* Hit area */}
                        <path
                          d={calculatePath(rel, viewTables, viewOptions.lineStyle)}
                          stroke="transparent"
                          strokeWidth="15"
                          fill="none"
                        />
                        {/* Visible line */}
                        <path
                          d={calculatePath(rel, viewTables, viewOptions.lineStyle)}
                          stroke={isSelected ? '#2563eb' : strokeColor}
                          strokeWidth={isSelected ? '2.5' : '1.5'}
                          fill="none"
                          markerStart={startM}
                          markerEnd={endM}
                          className="transition-colors duration-200"
                        />

                        {/* Cardinality Labels */}
                        {viewOptions.showCardinalityNumeric && pts && (
                          <>
                            <text
                              x={
                                pts.p1x +
                                (pts.p1x >
                                viewTables.find((t) => t.id === rel.fromTable)?.x! + TABLE_WIDTH / 2
                                  ? 10
                                  : -10)
                              }
                              y={pts.p1y - 5}
                              textAnchor={
                                pts.p1x >
                                viewTables.find((t) => t.id === rel.fromTable)?.x! + TABLE_WIDTH / 2
                                  ? 'start'
                                  : 'end'
                              }
                              className="text-[10px] font-bold fill-slate-500 dark:fill-slate-400"
                            >
                              {startLabel}
                            </text>
                            <text
                              x={
                                pts.p2x +
                                (pts.p2x >
                                viewTables.find((t) => t.id === rel.toTable)?.x! + TABLE_WIDTH / 2
                                  ? 10
                                  : -10)
                              }
                              y={pts.p2y - 5}
                              textAnchor={
                                pts.p2x >
                                viewTables.find((t) => t.id === rel.toTable)?.x! + TABLE_WIDTH / 2
                                  ? 'start'
                                  : 'end'
                              }
                              className="text-[10px] font-bold fill-slate-500 dark:fill-slate-400"
                            >
                              {endLabel}
                            </text>
                          </>
                        )}

                        {/* Relationship Name Label */}
                        {viewOptions.showRelationshipNames && rel.name && (
                          <g transform={`translate(${midpoint.x}, ${midpoint.y})`}>
                            <rect
                              x={-(labelWidth / 2)}
                              y="-9"
                              width={labelWidth}
                              height="18"
                              rx="4"
                              fill={theme === 'dark' ? '#1e293b' : '#f8fafc'}
                              stroke={theme === 'dark' ? '#475569' : '#cbd5e1'}
                              strokeWidth="1"
                              className="shadow-sm"
                            />
                            <text
                              x="0"
                              y="3"
                              textAnchor="middle"
                              className={`text-[10px] font-mono font-bold pointer-events-none select-none ${isSelected ? 'fill-blue-600 dark:fill-blue-400' : 'fill-slate-600 dark:fill-slate-300'}`}
                            >
                              {rel.name}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                  {isConnecting && tempConnection && (
                    <path
                      d={`M ${tempConnection.startX} ${tempConnection.startY} L ${mousePos.x / zoom} ${mousePos.y / zoom}`}
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      fill="none"
                      markerEnd="url(#manyEnd)"
                    />
                  )}
                </g>
              </svg>

              {viewTables.map((table) => (
                <TableNode
                  key={table.id}
                  table={table}
                  tables={viewTables}
                  isSelected={selectedId === table.id}
                  viewMode={viewMode}
                  viewOptions={viewOptions}
                  isConnecting={isConnecting}
                  tempConnection={tempConnection}
                  zoom={zoom}
                  globalEditable={globalEditable}
                  onPointerDown={handleTablePointerDown}
                  onStartConnection={startConnection}
                  onCompleteConnection={completeConnection}
                  onCompleteNewColConnection={completeConnectionToNewColumn}
                  onAddColumn={addColumn}
                  onUpdateTable={updateTable}
                  onUpdateColumn={updateColumn}
                  onMoveColumn={moveColumn}
                  onDeleteColumn={deleteColumn}
                  onConfig={() => handleConfigTable(table.id)}
                />
              ))}
            </div>
          </main>

          {/* Floating Action Buttons (FABs) - Mobile/Desktop */}
          <div className="md:hidden fixed bottom-6 right-6 z-40">
            <button
              onClick={addTable}
              className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              title="Add New Table"
            >
              <Plus size={28} />
            </button>
          </div>

          {selectedId &&
            !selectedId.startsWith('virt_') &&
            (globalEditable || selectedTable?.isManuallyEditable) && (
              <div className="md:hidden fixed bottom-6 left-6 z-40">
                <button
                  onClick={deleteTable}
                  className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                  title="Delete Selected Table"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            )}

          {relMenu && (
            <div
              className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-1 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-100"
              style={{ left: relMenu.x, top: relMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-bold text-slate-400 px-2 py-1 border-b border-slate-100 dark:border-slate-700 uppercase tracking-wider">
                Relationship
              </div>

              <div className="px-2 py-1">
                <input
                  type="text"
                  className="w-full text-xs p-1 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded font-mono text-slate-700 dark:text-slate-300 focus:border-blue-400 outline-none"
                  value={relationships.find((r) => r.id === relMenu.id)?.name || ''}
                  onChange={(e) => updateRelName(relMenu.id, e.target.value)}
                  placeholder="Relationship Name"
                />
              </div>

              <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-0.5"></div>

              <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Cardinality
              </div>

              <button
                onClick={() => updateRelType('1:1')}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
              >
                <span>One to One (1:1)</span>
              </button>

              <button
                onClick={() => updateRelType('1:0..1')}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
              >
                <span>One to Zero-or-One (1:0..1)</span>
              </button>

              <button
                onClick={() => updateRelType('1:N')}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
              >
                <span>One to Many (1:N)</span>
              </button>

              <button
                onClick={() => updateRelType('1:0..N')}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
              >
                <span>One to Zero-or-Many (1:0..N)</span>
              </button>

              <button
                onClick={() => updateRelType('N:M')}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs text-slate-700 dark:text-slate-300 rounded text-left transition-colors"
              >
                <span>Many to Many (N:M)</span>
              </button>

              <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-0.5"></div>

              <button
                onClick={deleteRel}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs text-red-600 dark:text-red-400 rounded text-left font-medium transition-colors"
              >
                <Trash2 size={14} /> Delete Relationship
              </button>
            </div>
          )}

          {selectedTable && isPropertiesPanelOpen && (
            // Mobile: Overlay. Desktop: Flex panel (but here we just position it appropriately or wrap it)
            // Since PropertiesPanel component handles its own layout, we just need to ensure it sits on top in mobile
            <div className="fixed inset-0 z-40 md:static md:z-auto md:w-auto bg-white/50 dark:bg-black/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none flex flex-col justify-end md:block">
              <PropertiesPanel
                width={sidebarWidth}
                onResizeStart={() => setIsResizingSidebar(true)}
                selectedTable={selectedTable}
                relationships={relationships}
                onClose={() => setIsPropertiesPanelOpen(false)}
                onUpdateTable={updateTable}
                onAddColumn={addColumn}
                onUpdateColumn={updateColumn}
                onDeleteColumn={deleteColumn}
                onMoveColumn={moveColumn}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
