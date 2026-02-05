import React, { useRef, useState, useEffect } from 'react';
import type {
  Table,
  Relationship,
  ViewOptions,
  WarningData,
  DragInfo,
  TempConnection,
  Column,
} from '../types';
import {
  calculatePath,
  getConnectorPoints,
  getCurveMidpoint,
  getInsertIndex,
  getRoutePoints,
  TABLE_WIDTH,
  generateId,
  getColumnRelativeY,
  getTableHeight,
} from '../../utils/geometry';
import TableNode from './table-nodes/TableNode';
import { CardinalityMarkers } from './CardinalityMarkers';
import type { DbEngine } from '../../utils/dbDataTypes';
import Minimap from './Minimap';

interface DiagramCanvasProps {
  // Data State
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  relationships: Relationship[];
  setRelationships: React.Dispatch<React.SetStateAction<Relationship[]>>;

  // Computed Data
  viewTables: Table[];
  viewRelationships: Relationship[];

  // View State (Shared with Toolbar)
  zoom: number;
  setZoom: (z: number) => void;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;

  // Configuration
  viewOptions: ViewOptions;
  viewMode: string;
  theme: 'light' | 'dark';
  dbEngine: DbEngine;
  globalEditable: boolean;

  // UI Setters
  setSelectedId: (id: string | null) => void;
  setIsPropertiesPanelOpen: (isOpen: boolean) => void;
  setRelMenu: (menu: { id: string; x: number; y: number } | null) => void;
  setWarningModal: (data: WarningData | null) => void;

  // Current UI State (from Parent)
  selectedId: string | null;
  relMenuId: string | null;

  // Business Logic Handlers
  onApplyConnection: (
    sourceTId: string,
    sourceCId: string,
    targetTId: string,
    targetCId: string,
  ) => void;
  onAddColumn: (tableId: string) => void;
  onUpdateTable: (id: string, field: string, value: any) => void;
  onUpdateColumn: (tableId: string, colId: string, field: string, value: any) => void;
  onMoveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onConfigTable: (id: string) => void;

  // Control Point Actions
  onAddControlPoint: (relId: string, x: number, y: number, index?: number) => void;
  onUpdateControlPoint: (relId: string, index: number, x: number, y: number) => void;
  onDeleteControlPoint: (relId: string, index: number) => void;
  onSetControlPoints?: (relId: string, points: { x: number; y: number }[]) => void;
}

const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  tables,
  setTables,
  relationships,
  setRelationships,
  viewTables,
  viewRelationships,
  zoom,
  setZoom,
  pan,
  setPan,
  viewOptions,
  viewMode,
  theme,
  dbEngine,
  globalEditable,
  setSelectedId,
  setIsPropertiesPanelOpen,
  setRelMenu,
  setWarningModal,
  selectedId,
  relMenuId,
  onApplyConnection,
  onAddColumn,
  onUpdateTable,
  onUpdateColumn,
  onMoveColumn,
  onDeleteColumn,
  onConfigTable,
  onUpdateControlPoint,
  onDeleteControlPoint,
  onSetControlPoints,
}) => {
  const mainRef = useRef<HTMLDivElement>(null);

  // --- Local State for Interactions ---
  const [isPanning, setIsPanning] = useState(false);
  const [dragInfo, setDragInfo] = useState<DragInfo>({
    isDragging: false,
    offset: { x: 0, y: 0 },
    targetId: null,
  });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredRelId, setHoveredRelId] = useState<string | null>(null);

  // Track selected Control Point for deletion
  const [selectedCP, setSelectedCP] = useState<{ relId: string; index: number } | null>(null);

  // Connection State
  const [isConnecting, setIsConnecting] = useState(false);
  const [tempConnection, setTempConnection] = useState<TempConnection | null>(null);

  // Canvas Dimensions for Minimap
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Refs
  const touchDist = useRef<number | null>(null);

  // --- Resize Observer for Minimap ---
  useEffect(() => {
    if (!mainRef.current) return;

    const updateSize = () => {
      if (mainRef.current) {
        setContainerSize({
          width: mainRef.current.clientWidth,
          height: mainRef.current.clientHeight,
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(mainRef.current);

    return () => observer.disconnect();
  }, []);

  // --- Keyboard Listener for Delete ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCP) {
        e.preventDefault();
        onDeleteControlPoint(selectedCP.relId, selectedCP.index);
        setSelectedCP(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCP, onDeleteControlPoint]);

  // --- Handlers ---

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.isPrimary && e.button === 0) {
      setSelectedId(null);
      setIsPropertiesPanelOpen(false);
      setRelMenu(null);
      setSelectedCP(null); // Deselect CP
      setIsPanning(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

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
      setZoom(Math.min(Math.max(0.5, zoom * scale), 2));
      touchDist.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    touchDist.current = null;
  };

  const handleRelPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  // Helper: "Bake" the current visual route into manual control points
  const materializeRoute = (relId: string) => {
    const rel = viewRelationships.find((r) => r.id === relId);
    if (!rel) return [];

    const visualPoints = getRoutePoints(
      rel,
      viewTables,
      viewOptions.lineStyle,
      viewOptions.connectionMode,
    );

    const uniquePoints = visualPoints.filter((p, i) => {
      if (i === 0) return true;
      const prev = visualPoints[i - 1];
      return Math.hypot(p.x - prev.x, p.y - prev.y) > 5;
    });

    if (uniquePoints.length < 2) return [];

    // Strip start/end (Table Anchors)
    const newControlPoints = uniquePoints.slice(1, -1);

    if (onSetControlPoints) {
      onSetControlPoints(relId, newControlPoints);
    }
    return newControlPoints;
  };

  const handleControlPointPointerDown = (
    e: React.PointerEvent,
    relId: string,
    routeIndex: number,
    currentX: number,
    currentY: number,
  ) => {
    e.stopPropagation();
    // Force blur any active input (like table name edit) to ensure Delete key is captured by window
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setRelMenu(null);
    setIsPropertiesPanelOpen(false); // Close panel to reduce distraction and input focus risk
    setSelectedId(null); // Deselect table

    if (!mainRef.current) return;

    // 1. Materialize
    const newCPs = materializeRoute(relId);

    const canvasRect = mainRef.current.getBoundingClientRect();
    const clickX = (e.clientX - canvasRect.left - pan.x) / zoom;
    const clickY = (e.clientY - canvasRect.top - pan.y) / zoom;

    // Find the best matching index
    let bestIndex = -1;
    let minD = Infinity;

    newCPs.forEach((p, idx) => {
      const d = Math.hypot(p.x - currentX, p.y - currentY);
      if (d < minD) {
        minD = d;
        bestIndex = idx;
      }
    });

    if (bestIndex === -1) bestIndex = Math.max(0, Math.min(routeIndex - 1, newCPs.length - 1));

    setSelectedCP({ relId, index: bestIndex });

    const offsetX = clickX - currentX;
    const offsetY = clickY - currentY;

    setDragInfo({
      isDragging: true,
      offset: { x: offsetX, y: offsetY },
      targetId: `cp:${relId}:${bestIndex}`,
    });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleSegmentPointerDown = (
    e: React.PointerEvent,
    relId: string,
    segmentStartIndex: number,
    isVertical: boolean,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setRelMenu(null);
    setSelectedCP(null);

    if (!mainRef.current) return;

    materializeRoute(relId);

    const canvasRect = mainRef.current.getBoundingClientRect();
    const clickX = (e.clientX - canvasRect.left - pan.x) / zoom;
    const clickY = (e.clientY - canvasRect.top - pan.y) / zoom;

    setDragInfo({
      isDragging: true,
      offset: { x: clickX, y: clickY },
      targetId: `seg:${relId}:${segmentStartIndex}:${isVertical ? 'v' : 'h'}`,
    });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleRelClick = (e: React.MouseEvent, relId: string) => {
    e.stopPropagation();
    // Allow clicking virtual relationships to enable context menu for promotion
    setRelMenu({ id: relId, x: e.clientX, y: e.clientY });
  };

  const handleRelDoubleClick = (e: React.MouseEvent, relId: string) => {
    e.stopPropagation();
    if (!mainRef.current) return;

    const rel = viewRelationships.find((r) => r.id === relId);
    if (!rel) return;

    const canvasRect = mainRef.current.getBoundingClientRect();
    const clickX = (e.clientX - canvasRect.left - pan.x) / zoom;
    const clickY = (e.clientY - canvasRect.top - pan.y) / zoom;

    const allPoints = getRoutePoints(
      rel,
      viewTables,
      viewOptions.lineStyle,
      viewOptions.connectionMode,
    );

    // Prevent adding point if too close to existing (Increased radius to 20px)
    const isOverExisting = allPoints.some((p) => Math.hypot(p.x - clickX, p.y - clickY) < 20);
    if (isOverExisting) return;

    let currentControlPoints = rel.controlPoints || [];
    if (currentControlPoints.length === 0 && allPoints.length > 2) {
      currentControlPoints = allPoints.slice(1, -1);
    }

    const insertIdx = getInsertIndex(allPoints, { x: clickX, y: clickY }) - 1;

    const newPoints = [...currentControlPoints];
    if (insertIdx >= 0 && insertIdx <= newPoints.length) {
      newPoints.splice(insertIdx, 0, { x: clickX, y: clickY });
    } else {
      newPoints.push({ x: clickX, y: clickY });
    }

    setRelationships((prev) =>
      prev.map((r) => {
        if (r.id === relId) return { ...r, controlPoints: newPoints };
        return r;
      }),
    );

    setRelMenu(null);
  };

  const handleTablePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setRelMenu(null);
    setSelectedCP(null);
    const targetTable = viewTables.find((t) => t.id === id);
    const isLocked = globalEditable || (targetTable && targetTable.isManuallyEditable);

    if (isLocked) {
      setSelectedId(id);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = (e.clientX - rect.left) / zoom;
    const offsetY = (e.clientY - rect.top) / zoom;

    setDragInfo({ isDragging: true, offset: { x: offsetX, y: offsetY }, targetId: id });
    setSelectedId(id);

    if (window.innerWidth >= 768) {
      setIsPropertiesPanelOpen(true);
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const startConnection = (
    e: React.PointerEvent,
    tableId: string,
    colId: string,
    side: 'left' | 'right' | 'top' | 'bottom',
  ) => {
    e.stopPropagation();
    setRelMenu(null);
    setSelectedCP(null);

    const table = viewTables.find((t) => t.id === tableId);
    if (!table) return;
    if (tableId.startsWith('virt_')) return;

    // Determine Y start position based on mode
    let startY = 0;
    let startX = 0;

    if (viewOptions.connectionMode === 'table') {
      // Approximate start based on side
      const rect = { x: table.x, y: table.y, w: TABLE_WIDTH, h: table.columns.length * 28 + 40 }; // approx height
      if (side === 'left') {
        startX = rect.x;
        startY = rect.y + rect.h / 2;
      } else if (side === 'right') {
        startX = rect.x + rect.w;
        startY = rect.y + rect.h / 2;
      } else if (side === 'top') {
        startX = rect.x + rect.w / 2;
        startY = rect.y;
      } else if (side === 'bottom') {
        startX = rect.x + rect.w / 2;
        startY = rect.y + rect.h;
      }
    } else {
      const relativeY = getColumnRelativeY(table, colId);
      startX = table.x + (side === 'right' ? TABLE_WIDTH : 0);
      startY = table.y + relativeY;
    }

    setIsConnecting(true);
    setTempConnection({
      sourceTableId: tableId,
      sourceColId: colId,
      startX: startX,
      startY: startY,
      side: side,
    });
  };

  const completeConnection = (
    e: React.PointerEvent,
    targetTableId: string,
    targetColId: string, // This might be a placeholder in Table Mode if dropped on table directly
  ) => {
    if (isConnecting && tempConnection) {
      e.stopPropagation();

      const sourceTId = tempConnection.sourceTableId;
      const sourceCId = tempConnection.sourceColId;

      // 1. Basic Validations
      if (sourceTId === targetTableId) {
        // Prevent self-connection for simplicity in this logic
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      if (targetTableId.startsWith('virt_') || sourceTId.startsWith('virt_')) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      const sourceTable = tables.find((t) => t.id === sourceTId);
      const sourceCol = sourceTable?.columns.find((c) => c.id === sourceCId);
      const targetTable = tables.find((t) => t.id === targetTableId);

      if (!sourceCol || !targetTable) return;

      // --- TABLE MODE CONNECTION LOGIC ---
      if (viewOptions.connectionMode === 'table') {
        // In Table Mode, we check for Name Collisions with Source PK
        // We ignore `targetColId` because we dropped on the table (or a row treated as table)

        // 1. Check if relationship already exists between these tables
        const existingRel = relationships.find(
          (r) =>
            (r.fromTable === sourceTId && r.toTable === targetTableId) ||
            (r.fromTable === targetTableId && r.toTable === sourceTId),
        );

        if (existingRel) {
          setIsConnecting(false);
          setTempConnection(null);
          return;
        }

        // 2. Check for Name Collision
        const existingTargetCol = targetTable.columns.find(
          (c) => c.name.toLowerCase() === sourceCol.name.toLowerCase(),
        );

        if (existingTargetCol) {
          // COLLISION DETECTED: Prompt user
          setWarningModal({
            isOpen: true,
            type: 'collision',
            data: {
              sourceTId,
              sourceCId,
              targetTId: targetTableId,
              targetCId: existingTargetCol.id,
              sourceCol,
              targetCol: existingTargetCol,
            },
          });
        } else {
          // NO COLLISION: Auto-create new column (Standard behavior)
          completeConnectionToNewColumn(e, targetTableId);
          // completeConnectionToNewColumn handles cleanup
          return;
        }

        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      // --- COLUMN MODE CONNECTION LOGIC ---
      // We are connecting to a SPECIFIC target column `targetColId`
      const targetCol = targetTable.columns.find((c) => c.id === targetColId);
      if (!targetCol) return;

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
          type: 'integrity',
          data: {
            sourceTId,
            sourceCId,
            targetTId: targetTableId,
            targetCId: targetColId,
            sourceCol,
            targetCol,
          },
        });
      } else {
        onApplyConnection(sourceTId, sourceCId, targetTableId, targetColId);
      }

      setIsConnecting(false);
      setTempConnection(null);
    }
  };

  const completeConnectionToNewColumn = (e: React.PointerEvent, targetTableId: string) => {
    // This function creates a NEW column on the target table and links it
    if (isConnecting && tempConnection) {
      e.stopPropagation();

      const sourceTable = tables.find((t) => t.id === tempConnection.sourceTableId);
      const sourceCol = sourceTable?.columns.find((c) => c.id === tempConnection.sourceColId);
      const targetTable = tables.find((t) => t.id === targetTableId);

      if (targetTableId.startsWith('virt_')) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      if (!sourceCol || !targetTable) return;

      // Auto-increment name if collision exists (e.g. user_id -> user_id2)
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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!mainRef.current) return;

    // 1. Canvas Panning
    if (isPanning) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }

    // 2. Coordinate Calculation
    const canvasRect = mainRef.current.getBoundingClientRect();
    const rawX = e.clientX - canvasRect.left;
    const rawY = e.clientY - canvasRect.top;

    const x = (rawX - pan.x) / zoom;
    const y = (rawY - pan.y) / zoom;

    setMousePos({ x: rawX - pan.x, y: rawY - pan.y });

    // 3. Dragging Logic
    if (dragInfo.isDragging && dragInfo.targetId) {
      // Control Point Dragging
      if (dragInfo.targetId.startsWith('cp:')) {
        const parts = dragInfo.targetId.split(':');
        const relId = parts[1];
        const index = parseInt(parts[2], 10);

        const newX = x - dragInfo.offset.x;
        const newY = y - dragInfo.offset.y;

        onUpdateControlPoint(relId, index, newX, newY);
        return;
      }

      // Segment Dragging
      if (dragInfo.targetId.startsWith('seg:')) {
        const parts = dragInfo.targetId.split(':');
        const relId = parts[1];
        const routeStartIndex = parseInt(parts[2], 10);
        const axis = parts[3];

        const rel = relationships.find((r) => r.id === relId);
        if (!rel || !rel.controlPoints) return;

        const cpIndices = [routeStartIndex - 1, routeStartIndex];

        const updateCP = (idx: number, newCoord: number, type: 'x' | 'y') => {
          if (idx < 0 || idx >= rel.controlPoints!.length) return;
          const pt = rel.controlPoints![idx];
          onUpdateControlPoint(
            relId,
            idx,
            type === 'x' ? newCoord : pt.x,
            type === 'y' ? newCoord : pt.y,
          );
        };

        if (axis === 'v') {
          updateCP(cpIndices[0], x, 'x');
          updateCP(cpIndices[1], x, 'x');
        } else {
          updateCP(cpIndices[0], y, 'y');
          updateCP(cpIndices[1], y, 'y');
        }
        return;
      }

      // Virtual Table Dragging
      if (dragInfo.targetId.startsWith('virt_')) {
        const relId = dragInfo.targetId.replace('virt_', '');
        let newX = x - dragInfo.offset.x;
        let newY = y - dragInfo.offset.y;

        // Apply Snap to Grid
        if (viewOptions.snapToGrid) {
          newX = Math.round(newX / 20) * 20;
          newY = Math.round(newY / 20) * 20;
        }

        setRelationships((prev) =>
          prev.map((r) => (r.id === relId ? { ...r, x: newX, y: newY } : r)),
        );
        return;
      }

      // Normal Table Dragging
      const tableId = dragInfo.targetId;
      const targetTable = tables.find((t) => t.id === tableId);

      if (targetTable) {
        let newTx = x - dragInfo.offset.x;
        let newTy = y - dragInfo.offset.y;

        // Apply Snap to Grid
        if (viewOptions.snapToGrid) {
          newTx = Math.round(newTx / 20) * 20;
          newTy = Math.round(newTy / 20) * 20;
        }

        const dx = newTx - targetTable.x;
        const dy = newTy - targetTable.y;

        // Update table position
        setTables(tables.map((t) => (t.id === tableId ? { ...t, x: newTx, y: newTy } : t)));

        // SMART DRAG: Update connected relationships' control points
        // This prevents diagonal skewing by moving connected orthogonal points WITH the table
        if (viewOptions.lineStyle === 'orthogonal') {
          setRelationships((prev) =>
            prev.map((r) => {
              if (!r.controlPoints || r.controlPoints.length === 0) return r;

              let newCPs = [...r.controlPoints];
              let modified = false;

              // If table is Source, check first Control Point
              if (r.fromTable === tableId) {
                const firstCP = newCPs[0];
                // Improved Smart Drag:
                // If the segment from Table to CP[0] is predominantly vertical, shift CP[0].x by dx
                // If horizontal, shift CP[0].y by dy

                const prevPt = getRoutePoints(
                  r,
                  tables,
                  'orthogonal',
                  viewOptions.connectionMode,
                )[0]; // Start point (anchor)
                const isSegVertical =
                  Math.abs(prevPt.x - firstCP.x) < Math.abs(prevPt.y - firstCP.y);

                if (isSegVertical) {
                  newCPs[0] = { ...firstCP, x: firstCP.x + dx };
                  modified = true;
                } else {
                  newCPs[0] = { ...firstCP, y: firstCP.y + dy };
                  modified = true;
                }
              }

              // If table is Target, check last Control Point
              if (r.toTable === tableId) {
                const lastIdx = newCPs.length - 1;
                const lastCP = newCPs[lastIdx];
                const routePts = getRoutePoints(
                  r,
                  tables,
                  'orthogonal',
                  viewOptions.connectionMode,
                );
                const endAnchor = routePts[routePts.length - 1]; // End anchor

                const isSegVertical =
                  Math.abs(endAnchor.x - lastCP.x) < Math.abs(endAnchor.y - lastCP.y);

                if (isSegVertical) {
                  newCPs[lastIdx] = { ...lastCP, x: lastCP.x + dx };
                  modified = true;
                } else {
                  newCPs[lastIdx] = { ...lastCP, y: lastCP.y + dy };
                  modified = true;
                }
              }

              return modified ? { ...r, controlPoints: newCPs } : r;
            }),
          );
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    setDragInfo({ isDragging: false, offset: { x: 0, y: 0 }, targetId: null });
    if (isConnecting) {
      setIsConnecting(false);
      setTempConnection(null);
    }
    if (e.target instanceof Element && e.target.hasPointerCapture(e.pointerId)) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  // --- Rendering ---

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
    <main
      ref={mainRef}
      className="flex-1 bg-slate-50 dark:bg-[#0B1120] relative overflow-hidden transition-colors duration-200 touch-none"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
            <CardinalityMarkers theme={theme} />
          </defs>
          <g transform="translate(5000, 5000)">
            {viewRelationships.map((rel) => {
              const isSelected = relMenuId === rel.id;
              const isHovered = hoveredRelId === rel.id;
              const isDraggingThisRel = dragInfo.targetId?.includes(`:${rel.id}:`);
              const isCPSelected = selectedCP?.relId === rel.id;
              const areDotsVisible = isHovered || isDraggingThisRel || isSelected || isCPSelected;

              // Check if Identifying or Non-Identifying
              const targetTable = viewTables.find((t) => t.id === rel.toTable);
              const targetCol = targetTable?.columns.find((c) => c.id === rel.toCol);

              const isOptional = targetCol?.isNullable;

              // Identifying: FK is PK (Solid). Non-Identifying: FK is NOT PK (Dashed).
              const isIdentifying = targetCol?.isPk;
              const dashArray = isIdentifying ? 'none' : '4,4';

              // Determine Markers based on type AND nullability
              let startM: string | undefined = isOptional ? 'url(#zeroOneStart)' : 'url(#oneStart)';
              let endM: string | undefined = 'url(#oneManyEnd)';
              let startLabel = '1',
                endLabel = 'N';

              if (rel.type === '1:1') {
                endM = 'url(#oneEnd)';
                endLabel = '1';
              }
              if (rel.type === '1:0..N') {
                endM = 'url(#zeroManyEnd)';
                endLabel = '0..1..N';
              }
              if (rel.type === '1:0..1') {
                endM = 'url(#zeroOneEnd)';
                endLabel = '0..1';
              }

              if (rel.type === 'N:M') {
                startM = 'url(#manyStart)';
                endM = 'url(#manyEnd)';
                startLabel = 'N';
                endLabel = 'M';
              }
              if (rel.type === 'N:1') {
                startM = 'url(#manyStart)';
                endM = 'url(#oneEnd)';
                startLabel = 'N';
                endLabel = '1';
              }

              if (!viewOptions.showCardinality) {
                startM = undefined;
                endM = undefined;
              }

              // Calculate position for text labels
              const pts = getConnectorPoints(rel, viewTables, viewOptions.connectionMode);
              const midpoint = getCurveMidpoint(
                rel,
                viewTables,
                viewOptions.lineStyle,
                viewOptions.connectionMode,
              );

              const routePoints = getRoutePoints(
                rel,
                viewTables,
                viewOptions.lineStyle,
                viewOptions.connectionMode,
              );

              const charWidth = 6;
              const padding = 16;
              const labelWidth = (rel.name ? rel.name.length * charWidth : 40) + padding;

              const getLabelProps = (x: number, y: number, table?: Table) => {
                if (!table) return { x, y: y - 5, anchor: 'middle' };

                const h = getTableHeight(table);
                const isTop = Math.abs(y - table.y) <= 5;
                const isBottom = Math.abs(y - (table.y + h)) <= 5;
                const isLeft = Math.abs(x - table.x) <= 5;
                const isRight = Math.abs(x - (table.x + TABLE_WIDTH)) <= 5;

                // Increased separation for vertical labels to fix overlap
                if (isTop) return { x: x + 6, y: y - 12, anchor: 'start' };
                if (isBottom) return { x: x + 6, y: y + 20, anchor: 'start' };
                if (isLeft) return { x: x - 8, y: y - 6, anchor: 'end' };
                if (isRight) return { x: x + 8, y: y - 6, anchor: 'start' };

                // Fallback
                const centerX = table.x + TABLE_WIDTH / 2;
                return {
                  x: x + (x > centerX ? 10 : -10),
                  y: y - 5,
                  anchor: x > centerX ? 'start' : 'end',
                };
              };

              const startTable = viewTables.find((t) => t.id === rel.fromTable);
              const endTable = viewTables.find((t) => t.id === rel.toTable);

              const startLabelProps = pts
                ? getLabelProps(pts.p1x, pts.p1y, startTable)
                : { x: 0, y: 0, anchor: 'middle' };
              const endLabelProps = pts
                ? getLabelProps(pts.p2x, pts.p2y, endTable)
                : { x: 0, y: 0, anchor: 'middle' };

              return (
                <g
                  key={rel.id}
                  className="pointer-events-auto cursor-pointer group"
                  onPointerDown={(e) => handleRelPointerDown(e)}
                  onClick={(e) => handleRelClick(e, rel.id)}
                  onDoubleClick={(e) => handleRelDoubleClick(e, rel.id)}
                  onPointerEnter={() => setHoveredRelId(rel.id)}
                  onPointerLeave={() => setHoveredRelId(null)}
                >
                  {/* Hit area */}
                  <path
                    d={calculatePath(
                      rel,
                      viewTables,
                      viewOptions.lineStyle,
                      viewOptions.connectionMode,
                    )}
                    stroke="transparent"
                    strokeWidth="20"
                    fill="none"
                  />
                  {/* Visible line */}
                  <path
                    d={calculatePath(
                      rel,
                      viewTables,
                      viewOptions.lineStyle,
                      viewOptions.connectionMode,
                    )}
                    stroke={isSelected ? '#2563eb' : strokeColor}
                    strokeWidth={isSelected ? '2.5' : '1.5'}
                    fill="none"
                    markerStart={startM}
                    markerEnd={endM}
                    strokeDasharray={dashArray}
                    className="transition-colors duration-200"
                  />

                  {/* Segment Handles (Blue Rectangles) - Only for Manual or Orthogonal lines */}
                  {areDotsVisible &&
                    routePoints.length > 2 &&
                    routePoints.map((p1, idx) => {
                      if (idx >= routePoints.length - 1) return null;

                      if (idx === 0 || idx === routePoints.length - 2) return null;

                      const p2 = routePoints[idx + 1];

                      const isVertical = Math.abs(p1.x - p2.x) < 2;
                      const isHorizontal = Math.abs(p1.y - p2.y) < 2;

                      if (!isVertical && !isHorizontal) return null;

                      const midX = (p1.x + p2.x) / 2;
                      const midY = (p1.y + p2.y) / 2;

                      const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                      if (segLen < 20) return null;

                      return (
                        <rect
                          key={`seg-${idx}`}
                          x={midX - (isVertical ? 4 : 8)}
                          y={midY - (isVertical ? 8 : 4)}
                          width={isVertical ? 8 : 16}
                          height={isVertical ? 16 : 8}
                          rx={2}
                          fill="#3b82f6"
                          stroke="black"
                          strokeWidth="1"
                          className="cursor-move hover:fill-blue-400"
                          onPointerDown={(e) =>
                            handleSegmentPointerDown(e, rel.id, idx, isVertical)
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      );
                    })}

                  {/* Vertices / Control Points (Green Dots) */}
                  {areDotsVisible &&
                    routePoints.map((cp, idx) => {
                      if (idx === 0 || idx === routePoints.length - 1) return null;
                      const manualIndex = idx - 1;
                      const isPtSelected =
                        selectedCP?.relId === rel.id && selectedCP?.index === manualIndex;

                      return (
                        <g key={`${rel.id}-pt-${idx}`}>
                          <circle
                            cx={cp.x}
                            cy={cp.y}
                            r={isPtSelected ? 6 : 4}
                            fill={isPtSelected ? '#f97316' : '#10b981'} // Orange if selected, Green default
                            stroke="white"
                            strokeWidth="1.5"
                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                            className="cursor-move hover:scale-125 transition-transform drop-shadow-md"
                            onPointerDown={(e) =>
                              handleControlPointPointerDown(e, rel.id, idx, cp.x, cp.y)
                            }
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (rel.controlPoints && rel.controlPoints.length > 0) {
                                onDeleteControlPoint(rel.id, manualIndex);
                              }
                            }}
                          />
                          {/* Trash Button for Selected Point - Hidden on Desktop (md:hidden) */}
                          {isPtSelected && (
                            <g
                              className="md:hidden cursor-pointer hover:opacity-80"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteControlPoint(rel.id, manualIndex);
                                setSelectedCP(null);
                              }}
                              transform={`translate(${cp.x + 10}, ${cp.y - 12})`}
                            >
                              <rect
                                width="20"
                                height="20"
                                rx="4"
                                fill="#ef4444"
                                stroke="white"
                                strokeWidth="1"
                              />
                              <g transform="translate(4, 4) scale(0.6)">
                                <path
                                  d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </g>
                            </g>
                          )}
                        </g>
                      );
                    })}

                  {/* Cardinality Labels */}
                  {viewOptions.showCardinalityNumeric && pts && (
                    <>
                      <text
                        x={startLabelProps.x}
                        y={startLabelProps.y}
                        textAnchor={startLabelProps.anchor as any}
                        className="text-[10px] font-bold fill-slate-500 dark:fill-slate-400 pointer-events-none select-none"
                      >
                        {startLabel}
                      </text>
                      <text
                        x={endLabelProps.x}
                        y={endLabelProps.y}
                        textAnchor={endLabelProps.anchor as any}
                        className="text-[10px] font-bold fill-slate-500 dark:fill-slate-400 pointer-events-none select-none"
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
                markerEnd="url(#oneManyEnd)"
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
            dbEngine={dbEngine}
            globalEditable={globalEditable}
            onPointerDown={handleTablePointerDown}
            onStartConnection={startConnection}
            onCompleteConnection={completeConnection}
            onCompleteNewColConnection={completeConnectionToNewColumn}
            onAddColumn={onAddColumn}
            onUpdateTable={onUpdateTable}
            onUpdateColumn={onUpdateColumn}
            onMoveColumn={onMoveColumn}
            onDeleteColumn={onDeleteColumn}
            onConfig={() => onConfigTable(table.id)}
          />
        ))}
      </div>

      {viewOptions.showMinimap && (
        <Minimap
          tables={viewTables}
          relationships={viewRelationships}
          viewOptions={viewOptions}
          zoom={zoom}
          pan={pan}
          setPan={setPan}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          theme={theme}
        />
      )}
    </main>
  );
};

export default DiagramCanvas;
