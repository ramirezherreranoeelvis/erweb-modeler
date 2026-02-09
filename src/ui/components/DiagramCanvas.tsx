import React, { useRef, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize, Plus, Trash2, Settings2 } from 'lucide-react';
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
import { areTypesCompatible, getCanonicalType } from '../../utils/dbDataTypes';
import Minimap from './Minimap';
import CanvasContextMenu from './CanvasContextMenu';

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
  setZoom: React.Dispatch<React.SetStateAction<number>>; // Changed to full Dispatch for functional updates
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;

  // Configuration
  viewOptions: ViewOptions;
  // We need the setter here for the context menu
  setViewOptions?: React.Dispatch<React.SetStateAction<ViewOptions>>;
  viewMode: string;
  setViewMode?: (mode: string) => void;
  theme: 'light' | 'dark';
  dbEngine: DbEngine;
  setDbEngine?: (engine: DbEngine) => void;
  globalEditable: boolean;

  // UI Setters
  setSelectedId: (id: string | null) => void;
  setIsPropertiesPanelOpen: (isOpen: boolean) => void;
  setRelMenu: (menu: { id: string; x: number; y: number } | null) => void;
  setWarningModal: (data: WarningData | null) => void;

  // Current UI State (from Parent)
  selectedId: string | null;
  relMenuId: string | null;
  selectedTableIds?: Set<string>; // Added Prop for Multi-Select
  setSelectedTableIds?: (ids: Set<string>) => void; // Added Prop for Multi-Select

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

  // App Actions (passed down for UI buttons inside canvas)
  onAddTable?: () => void;
  onDeleteSelected?: () => void;
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
  setViewOptions,
  viewMode,
  setViewMode,
  theme,
  dbEngine,
  setDbEngine,
  globalEditable,
  setSelectedId,
  setIsPropertiesPanelOpen,
  setRelMenu,
  setWarningModal,
  selectedId,
  relMenuId,
  selectedTableIds,
  setSelectedTableIds,
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
  onAddTable,
  onDeleteSelected,
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

  // --- Context Menu State ---
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number } | null>(null);

  // --- Selection Box State ---
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Track selected Control Point for deletion
  const [selectedCP, setSelectedCP] = useState<{ relId: string; index: number } | null>(null);

  // Connection State
  const [isConnecting, setIsConnecting] = useState(false);
  const [tempConnection, setTempConnection] = useState<TempConnection | null>(null);

  // Canvas Dimensions for Minimap
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Refs
  const touchDist = useRef<number | null>(null);

  // Refs for current zoom/pan to be used in non-passive event listeners
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  // Sync refs with state
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

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

  // --- Wheel Event Listener (Native, Non-Passive) ---
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // Stop browser zoom

        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;

        // Calculate new zoom level
        const newZoom = Math.min(Math.max(0.1, currentZoom + delta * currentZoom), 2);

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate world coordinates before zoom
        const worldX = (mouseX - currentPan.x) / currentZoom;
        const worldY = (mouseY - currentPan.y) / currentZoom;

        // Calculate new pan to keep mouse pointing at same world coordinates
        const newPanX = mouseX - worldX * newZoom;
        const newPanY = mouseY - worldY * newZoom;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [setZoom, setPan]);

  // --- Keyboard Listener for Delete ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    // Only handle if it wasn't prevented by a child (e.g., table/rel menu)
    // Actually, TableNode prevents context menu only if Ctrl is NOT held.
    // Here we want the BACKGROUND context menu.
    if (e.defaultPrevented) return;

    e.preventDefault();
    setRelMenu(null);
    setCanvasMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Hide context menus on any click
    if (e.isPrimary) {
      setCanvasMenu(null);
    }

    // Only accept Left Click (button 0) for these primary actions
    if (!e.isPrimary || e.button !== 0) return;

    const isCtrl = e.ctrlKey || e.metaKey;
    const currentMode = viewOptions.interactionMode;

    setRelMenu(null);
    setSelectedCP(null);

    // DETERMINE EFFECTIVE MODE
    // Logic: Ctrl swaps the current mode.
    // Pan Mode + Ctrl -> Select
    // Select Mode + Ctrl -> Pan
    let effectiveMode = currentMode;
    if (isCtrl) {
      effectiveMode = currentMode === 'pan' ? 'select' : 'pan';
    }

    if (effectiveMode === 'pan') {
      // --- PANNING LOGIC ---
      if (currentMode === 'pan' && !isCtrl) {
        setSelectedId(null);
        if (setSelectedTableIds) setSelectedTableIds(new Set());
        setIsPropertiesPanelOpen(false);
      }

      setIsPanning(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      // --- SELECTING LOGIC ---
      if (currentMode === 'select' && !isCtrl) {
        setSelectedId(null);
        if (setSelectedTableIds) setSelectedTableIds(new Set());
        setIsPropertiesPanelOpen(false);
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      setIsSelecting(true);
      setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
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
      setZoom((prev) => Math.min(Math.max(0.5, prev * scale), 2));
      touchDist.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    touchDist.current = null;
  };

  const handleRelPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  // ... (geometry helpers omitted) ...
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
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setRelMenu(null);
    setIsPropertiesPanelOpen(false);
    setSelectedId(null);
    if (setSelectedTableIds) setSelectedTableIds(new Set());
    if (!mainRef.current) return;
    const newCPs = materializeRoute(relId);
    const canvasRect = mainRef.current.getBoundingClientRect();
    const clickX = (e.clientX - canvasRect.left - pan.x) / zoom;
    const clickY = (e.clientY - canvasRect.top - pan.y) / zoom;
    let bestIndex = -1,
      minD = Infinity;
    newCPs.forEach((p, idx) => {
      const d = Math.hypot(p.x - currentX, p.y - currentY);
      if (d < minD) {
        minD = d;
        bestIndex = idx;
      }
    });
    if (bestIndex === -1) bestIndex = Math.max(0, Math.min(routeIndex - 1, newCPs.length - 1));
    setSelectedCP({ relId, index: bestIndex });
    setDragInfo({
      isDragging: true,
      offset: { x: clickX - currentX, y: clickY - currentY },
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
    const isOverExisting = allPoints.some((p) => Math.hypot(p.x - clickX, p.y - clickY) < 20);
    if (isOverExisting) return;
    let currentControlPoints = rel.controlPoints || [];
    if (currentControlPoints.length === 0 && allPoints.length > 2) {
      currentControlPoints = allPoints.slice(1, -1);
    }
    const insertIdx = getInsertIndex(allPoints, { x: clickX, y: clickY }) - 1;
    const newPoints = [...currentControlPoints];
    if (insertIdx >= 0 && insertIdx <= newPoints.length)
      newPoints.splice(insertIdx, 0, { x: clickX, y: clickY });
    else newPoints.push({ x: clickX, y: clickY });
    setRelationships((prev) =>
      prev.map((r) => (r.id === relId ? { ...r, controlPoints: newPoints } : r)),
    );
    setRelMenu(null);
  };

  const handleTablePointerDown = (e: React.PointerEvent, id: string) => {
    // Only allow Left Click (0)
    if (e.button !== 0) return;

    e.stopPropagation();
    setRelMenu(null);
    setSelectedCP(null);
    setCanvasMenu(null); // Close context menu if checking table

    const isMultiSelectModifier = e.ctrlKey || e.metaKey;

    // --- Selection Logic ---
    if (setSelectedTableIds && selectedTableIds) {
      if (isMultiSelectModifier) {
        // Toggle Logic (Ctrl + Left)
        const newSet = new Set(selectedTableIds);
        if (newSet.has(id)) {
          newSet.delete(id);
          // If we deselect the "primary" one, clear panel context if needed
          if (selectedId === id) setSelectedId(null);
        } else {
          newSet.add(id);
          setSelectedId(id);
        }
        setSelectedTableIds(newSet);
      } else {
        // Single Select Logic (Left Click Only)
        // If not already selected, select it exclusively.
        if (!selectedTableIds.has(id)) {
          setSelectedTableIds(new Set([id]));
          setSelectedId(id);
        } else {
          // Keep selection (allows dragging groups), but update primary context
          setSelectedId(id);
        }
      }
    } else {
      setSelectedId(id);
    }

    if (window.innerWidth >= 768) setIsPropertiesPanelOpen(true);

    const targetTable = viewTables.find((t) => t.id === id);
    const isLocked = globalEditable || (targetTable && targetTable.isManuallyEditable);

    // --- Drag Logic ---
    if (!isLocked) {
      const rect = e.currentTarget.getBoundingClientRect();
      setDragInfo({
        isDragging: true,
        offset: { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom },
        targetId: id,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  // ... (connection helpers omitted) ...
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
    if (!table || tableId.startsWith('virt_')) return;
    let startY = 0,
      startX = 0;
    if (viewOptions.connectionMode === 'table') {
      const rect = { x: table.x, y: table.y, w: TABLE_WIDTH, h: table.columns.length * 28 + 40 };
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
    setTempConnection({ sourceTableId: tableId, sourceColId: colId, startX, startY, side });
  };

  const completeConnection = (
    e: React.PointerEvent,
    targetTableId: string,
    targetColId: string,
  ) => {
    if (isConnecting && tempConnection) {
      e.stopPropagation();
      const sourceTId = tempConnection.sourceTableId;
      const sourceCId = tempConnection.sourceColId;

      if (
        sourceTId === targetTableId ||
        targetTableId.startsWith('virt_') ||
        sourceTId.startsWith('virt_')
      ) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      const sourceTable = tables.find((t) => t.id === sourceTId);
      const sourceCol = sourceTable?.columns.find((c) => c.id === sourceCId);
      const targetTable = tables.find((t) => t.id === targetTableId);

      if (!sourceCol || !targetTable) return;

      if (viewOptions.connectionMode === 'table') {
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
        const existingTargetCol = targetTable.columns.find(
          (c) => c.name.toLowerCase() === sourceCol.name.toLowerCase(),
        );
        if (existingTargetCol) {
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
          completeConnectionToNewColumn(e, targetTableId);
        }
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

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
      if (exists || targetCol.isFk) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

      const compatibleTypes = areTypesCompatible(sourceCol.type, targetCol.type, dbEngine);
      const expectedLength = sourceCol.length;
      const lengthMismatch = targetCol.length !== expectedLength && sourceCol.type.includes('CHAR');
      const expectedNullable = sourceCol.isIdentity || !sourceCol.isNullable ? false : true;
      const hasMismatch =
        !compatibleTypes || lengthMismatch || targetCol.isNullable !== expectedNullable;

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
    if (isConnecting && tempConnection) {
      e.stopPropagation();
      const sourceTable = tables.find((t) => t.id === tempConnection.sourceTableId);
      const sourceCol = sourceTable?.columns.find((c) => c.id === tempConnection.sourceColId);
      const targetTable = tables.find((t) => t.id === targetTableId);
      if (targetTableId.startsWith('virt_') || !sourceCol || !targetTable) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }
      let newName = sourceCol.name;
      let newLogicalName = sourceCol.logicalName;
      let counter = 2;
      while (targetTable.columns.some((c) => c.name.toLowerCase() === newName.toLowerCase())) {
        newName = `${sourceCol.name}${counter}`;
        newLogicalName = `${sourceCol.logicalName} ${counter}`;
        counter++;
      }
      const targetType = getCanonicalType(sourceCol.type, dbEngine);
      const newColId = generateId();
      const newCol: Column = {
        id: newColId,
        name: newName,
        logicalName: newLogicalName,
        type: targetType,
        length: sourceCol.length,
        isPk: false,
        isFk: true,
        isNullable: sourceCol.isIdentity || !sourceCol.isNullable ? false : true,
        isUnique: false,
        isIdentity: false,
      };
      setTables((prev) =>
        prev.map((t) => (t.id === targetTableId ? { ...t, columns: [...t.columns, newCol] } : t)),
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
    const canvasRect = mainRef.current.getBoundingClientRect();
    const rawX = e.clientX - canvasRect.left;
    const rawY = e.clientY - canvasRect.top;

    // 1. Handle Panning
    if (isPanning) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }

    // 2. Handle Marquee Selection (Dragging the box)
    if (isSelecting && selectionBox) {
      setSelectionBox((prev) => (prev ? { ...prev, currentX: rawX, currentY: rawY } : null));
    }

    const x = (rawX - pan.x) / zoom;
    const y = (rawY - pan.y) / zoom;
    setMousePos({ x: rawX - pan.x, y: rawY - pan.y });

    if (dragInfo.isDragging && dragInfo.targetId) {
      // ... (Control Points and Table drag logic omitted for brevity - same as before) ...
      if (dragInfo.targetId.startsWith('cp:')) {
        const parts = dragInfo.targetId.split(':');
        onUpdateControlPoint(
          parts[1],
          parseInt(parts[2], 10),
          x - dragInfo.offset.x,
          y - dragInfo.offset.y,
        );
        return;
      }
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
      if (dragInfo.targetId.startsWith('virt_')) {
        const relId = dragInfo.targetId.replace('virt_', '');
        let newX = x - dragInfo.offset.x;
        let newY = y - dragInfo.offset.y;
        if (viewOptions.snapToGrid) {
          newX = Math.round(newX / 20) * 20;
          newY = Math.round(newY / 20) * 20;
        }
        setRelationships((prev) =>
          prev.map((r) => (r.id === relId ? { ...r, x: newX, y: newY } : r)),
        );
        return;
      }

      const tableId = dragInfo.targetId;
      const targetTable = tables.find((t) => t.id === tableId);

      if (targetTable) {
        let newTx = x - dragInfo.offset.x;
        let newTy = y - dragInfo.offset.y;
        if (viewOptions.snapToGrid) {
          newTx = Math.round(newTx / 20) * 20;
          newTy = Math.round(newTy / 20) * 20;
        }

        const dx = newTx - targetTable.x;
        const dy = newTy - targetTable.y;

        // Multi-move Logic
        const isDraggingSelected = selectedTableIds?.has(tableId);

        setTables((prev) =>
          prev.map((t) => {
            if (t.id === tableId) return { ...t, x: newTx, y: newTy };
            if (isDraggingSelected && selectedTableIds?.has(t.id))
              return { ...t, x: t.x + dx, y: t.y + dy };
            return t;
          }),
        );

        if (viewOptions.lineStyle === 'orthogonal') {
          setRelationships((prev) =>
            prev.map((r) => {
              if (!r.controlPoints || r.controlPoints.length === 0) return r;
              const fromMoved =
                r.fromTable === tableId ||
                (isDraggingSelected && selectedTableIds?.has(r.fromTable));
              const toMoved =
                r.toTable === tableId || (isDraggingSelected && selectedTableIds?.has(r.toTable));
              if (!fromMoved && !toMoved) return r;
              let newCPs = [...r.controlPoints];
              let modified = false;
              if (fromMoved && toMoved) {
                newCPs = newCPs.map((cp) => ({ x: cp.x + dx, y: cp.y + dy }));
                modified = true;
              } else {
                if (fromMoved) {
                  const firstCP = newCPs[0];
                  const prevPt = getRoutePoints(
                    r,
                    tables,
                    'orthogonal',
                    viewOptions.connectionMode,
                  )[0];
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
                if (toMoved) {
                  const lastIdx = newCPs.length - 1;
                  const lastCP = newCPs[lastIdx];
                  const routePts = getRoutePoints(
                    r,
                    tables,
                    'orthogonal',
                    viewOptions.connectionMode,
                  );
                  const endAnchor = routePts[routePts.length - 1];
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
              }
              return modified ? { ...r, controlPoints: newCPs } : r;
            }),
          );
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // 1. Finish Marquee Selection
    if (isSelecting && selectionBox && setSelectedTableIds) {
      const x1 = Math.min(selectionBox.startX, selectionBox.currentX);
      const y1 = Math.min(selectionBox.startY, selectionBox.currentY);
      const x2 = Math.max(selectionBox.startX, selectionBox.currentX);
      const y2 = Math.max(selectionBox.startY, selectionBox.currentY);

      // Don't select if it was just a tiny click
      if (Math.abs(x2 - x1) > 2 && Math.abs(y2 - y1) > 2) {
        const worldX1 = (x1 - pan.x) / zoom;
        const worldY1 = (y1 - pan.y) / zoom;
        const worldX2 = (x2 - pan.x) / zoom;
        const worldY2 = (y2 - pan.y) / zoom;

        const selectedInBox = new Set<string>();

        // Keep existing if Ctrl held, else start fresh
        if (e.ctrlKey || (e.metaKey && selectedTableIds)) {
          selectedTableIds?.forEach((id) => selectedInBox.add(id));
        }

        viewTables.forEach((t) => {
          const tW = TABLE_WIDTH;
          const tH = getTableHeight(t);
          // AABB Collision Detection
          if (t.x < worldX2 && t.x + tW > worldX1 && t.y < worldY2 && t.y + tH > worldY1) {
            selectedInBox.add(t.id);
          }
        });

        setSelectedTableIds(selectedInBox);

        // Set primary to last selected if any
        if (selectedInBox.size > 0 && setSelectedId) {
          setSelectedId(Array.from(selectedInBox).pop() || null);
        }
      }
    }

    setIsPanning(false);
    setIsSelecting(false);
    setSelectionBox(null);
    setDragInfo({ isDragging: false, offset: { x: 0, y: 0 }, targetId: null });
    if (isConnecting) {
      setIsConnecting(false);
      setTempConnection(null);
    }
    if (e.target instanceof Element && e.target.hasPointerCapture(e.pointerId)) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  // SVG Colors
  const strokeColor = theme === 'dark' ? '#94a3b8' : '#475569';
  const gridColor = theme === 'dark' ? '#334155' : '#cbd5e1';
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
      onContextMenu={handleCanvasContextMenu} // Added Context Menu Handler
      style={{
        backgroundImage: getGridBackground(),
        backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: isPanning
          ? 'grabbing'
          : isConnecting
            ? 'crosshair'
            : viewOptions.interactionMode === 'select'
              ? 'default'
              : dragInfo.isDragging
                ? 'grabbing'
                : 'grab',
      }}
    >
      <div
        className="absolute top-0 left-0 w-full h-full origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
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
              const targetTable = viewTables.find((t) => t.id === rel.toTable);
              const targetCol = targetTable?.columns.find((c) => c.id === rel.toCol);
              const isOptional = targetCol?.isNullable;
              const isIdentifying = targetCol?.isPk;
              const dashArray = isIdentifying ? 'none' : '4,4';
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
                if (isTop) return { x: x + 6, y: y - 12, anchor: 'start' };
                if (isBottom) return { x: x + 6, y: y + 20, anchor: 'start' };
                if (isLeft) return { x: x - 8, y: y - 6, anchor: 'end' };
                if (isRight) return { x: x + 8, y: y - 6, anchor: 'start' };
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
                      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 20) return null;
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
                            fill={isPtSelected ? '#f97316' : '#10b981'}
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
                              if (rel.controlPoints && rel.controlPoints.length > 0)
                                onDeleteControlPoint(rel.id, manualIndex);
                            }}
                          />
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
                  {viewOptions.showCardinalityNumeric && pts && (
                    <>
                      {' '}
                      <text
                        x={startLabelProps.x}
                        y={startLabelProps.y}
                        textAnchor={startLabelProps.anchor as any}
                        className="text-[10px] font-bold fill-slate-500 dark:fill-slate-400 pointer-events-none select-none"
                      >
                        {startLabel}
                      </text>{' '}
                      <text
                        x={endLabelProps.x}
                        y={endLabelProps.y}
                        textAnchor={endLabelProps.anchor as any}
                        className="text-[10px] font-bold fill-slate-500 dark:fill-slate-400 pointer-events-none select-none"
                      >
                        {endLabel}
                      </text>{' '}
                    </>
                  )}
                  {viewOptions.showRelationshipNames && rel.name && (
                    <g transform={`translate(${midpoint.x}, ${midpoint.y})`}>
                      {' '}
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
                      />{' '}
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        className={`text-[10px] font-mono font-bold pointer-events-none select-none ${isSelected ? 'fill-blue-600 dark:fill-blue-400' : 'fill-slate-600 dark:fill-slate-300'}`}
                      >
                        {rel.name}
                      </text>{' '}
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
            isSelected={
              selectedId === table.id || (selectedTableIds ? selectedTableIds.has(table.id) : false)
            }
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

      {/* MARQUEE SELECTION BOX */}
      {isSelecting && selectionBox && (
        <div
          className="absolute border border-blue-500 bg-blue-500/20 pointer-events-none z-50"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.currentX),
            top: Math.min(selectionBox.startY, selectionBox.currentY),
            width: Math.abs(selectionBox.currentX - selectionBox.startX),
            height: Math.abs(selectionBox.currentY - selectionBox.startY),
          }}
        />
      )}

      {/* CANVAS CONTEXT MENU */}
      {canvasMenu && setViewOptions && (
        <CanvasContextMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          viewOptions={viewOptions}
          setViewOptions={setViewOptions}
          viewMode={viewMode}
          setViewMode={setViewMode}
          dbEngine={dbEngine}
          setDbEngine={setDbEngine}
          onClose={() => setCanvasMenu(null)}
        />
      )}

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
      <div className="absolute bottom-6 left-6 z-40 flex items-end gap-3">
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg shadow-lg flex flex-col items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
            title="Zoom In (Ctrl +)"
          >
            <ZoomIn size={20} />
          </button>
          <div className="w-10 py-1 text-center font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 border-y border-slate-100 dark:border-slate-700 my-0.5 select-none">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
            title="Zoom Out (Ctrl -)"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors border-t border-slate-100 dark:border-slate-700 mt-1"
            title="Reset View (Ctrl 0)"
          >
            <Maximize size={16} />
          </button>
          {/* Mobile Config Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Position menu slightly above this button
              const rect = e.currentTarget.getBoundingClientRect();
              setRelMenu(null);
              setCanvasMenu({ x: rect.left + 50, y: rect.top - 50 });
            }}
            className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-blue-600 dark:text-blue-400 transition-colors border-t border-slate-100 dark:border-slate-700 mt-1"
            title="Global Settings"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Add Table Button (Mobile) - Added stopPropagation on pointerDown */}
      {onAddTable && (
        <div
          className="md:hidden absolute bottom-6 right-6 z-40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={onAddTable}
            className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            title="Add New Table"
          >
            <Plus size={28} />
          </button>
        </div>
      )}

      {/* Delete Selected Button (Mobile) - Added stopPropagation on pointerDown */}
      {selectedId && onDeleteSelected && (
        <div
          className="md:hidden absolute bottom-24 right-6 z-40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={onDeleteSelected}
            className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            title="Delete Selected Table"
          >
            <Trash2 size={24} />
          </button>
        </div>
      )}
    </main>
  );
};

export default DiagramCanvas;
