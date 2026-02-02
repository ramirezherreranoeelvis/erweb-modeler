import React, { useRef, useState } from 'react';
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
} from '../../utils/geometry';
import TableNode from './table-nodes';

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
  onAddControlPoint,
  onUpdateControlPoint,
  onDeleteControlPoint,
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

  // Connection State
  const [isConnecting, setIsConnecting] = useState(false);
  const [tempConnection, setTempConnection] = useState<TempConnection | null>(null);

  // Refs
  const touchDist = useRef<number | null>(null);

  // --- Handlers ---

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.isPrimary && e.button === 0) {
      setSelectedId(null);
      setIsPropertiesPanelOpen(false);
      setRelMenu(null);
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

  const handleRelPointerDown = (e: React.PointerEvent, relId: string) => {
    e.stopPropagation();
  };

  const handleControlPointPointerDown = (
    e: React.PointerEvent,
    relId: string,
    routeIndex: number,
    currentX: number,
    currentY: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setRelMenu(null);

    if (!mainRef.current) return;
    const canvasRect = mainRef.current.getBoundingClientRect();
    const rawX = e.clientX - canvasRect.left;
    const rawY = e.clientY - canvasRect.top;
    const clickX = (rawX - pan.x) / zoom;
    const clickY = (rawY - pan.y) / zoom;

    // The routeIndex comes from getRoutePoints which returns [Start, ...Intermediates, End]
    // Manual control points stored in state correspond to the Intermediates.
    // So index 0 in controlPoints array = index 1 in routePoints array.
    const manualIndex = routeIndex - 1;

    // Check if we need to "materialize" automatic points into manual control points
    const rel = relationships.find((r) => r.id === relId);
    if (rel && (!rel.controlPoints || rel.controlPoints.length === 0)) {
      // It's currently automatic. Freeze the current shape!
      const allPoints = getRoutePoints(rel, viewTables, viewOptions.lineStyle);
      // Extract only the intermediate points (exclude Start and End)
      const newControlPoints = allPoints.slice(1, -1);

      // Update the relationship to have these points manually set
      setRelationships((prev) =>
        prev.map((r) => {
          if (r.id === relId) {
            return { ...r, controlPoints: newControlPoints };
          }
          return r;
        }),
      );
    }

    // Calculate offset so the point doesn't jump to mouse center
    const offsetX = clickX - currentX;
    const offsetY = clickY - currentY;

    setDragInfo({
      isDragging: true,
      offset: { x: offsetX, y: offsetY },
      // We target the manual index now (which we either just created or already existed)
      targetId: `cp:${relId}:${manualIndex}`,
    });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleRelClick = (e: React.MouseEvent, relId: string) => {
    e.stopPropagation();
    if (relId.startsWith('virt_')) return;
    setRelMenu({ id: relId, x: e.clientX, y: e.clientY });
  };

  const handleRelDoubleClick = (e: React.MouseEvent, relId: string) => {
    e.stopPropagation();
    if (!mainRef.current) return;

    const rel = viewRelationships.find((r) => r.id === relId);
    if (!rel) return;

    const canvasRect = mainRef.current.getBoundingClientRect();
    const rawX = e.clientX - canvasRect.left;
    const rawY = e.clientY - canvasRect.top;

    const clickX = (rawX - pan.x) / zoom;
    const clickY = (rawY - pan.y) / zoom;

    const pts = getConnectorPoints(rel, viewTables);
    if (pts) {
      // Construct array of all points to find segment
      const allPoints = getRoutePoints(rel, viewTables, viewOptions.lineStyle);

      // Find which segment the click is closest to, to insert the point in correct order
      // The getInsertIndex returns the index in the allPoints array.
      // We need to convert that to the index in the controlPoints array (subtract 1 because start point is index 0)
      const insertIdx = getInsertIndex(allPoints, { x: clickX, y: clickY }) - 1;

      // If it was automatic, addControlPoint handles creating the array,
      // but passing the index correctly ensures it goes to the right segment
      onAddControlPoint(relId, clickX, clickY, insertIdx);
    }

    setRelMenu(null);
  };

  const handleTablePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setRelMenu(null);
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
    side: 'left' | 'right',
  ) => {
    e.stopPropagation();
    setRelMenu(null);

    const table = viewTables.find((t) => t.id === tableId);
    if (!table) return;
    if (tableId.startsWith('virt_')) return;

    // Calculate start position accurately
    const relativeY = getColumnRelativeY(table, colId);

    setIsConnecting(true);
    setTempConnection({
      sourceTableId: tableId,
      sourceColId: colId,
      startX: table.x + (side === 'right' ? TABLE_WIDTH : 0),
      startY: table.y + relativeY,
      side,
    });
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

      if (sourceTId === targetTableId && sourceCId === targetColId) {
        setIsConnecting(false);
        setTempConnection(null);
        return;
      }

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

      if (!sourceCol || !targetTable || !targetCol) return;

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

        // Apply offset to keep the point under the mouse relative to click
        const newX = x - dragInfo.offset.x;
        const newY = y - dragInfo.offset.y;

        onUpdateControlPoint(relId, index, newX, newY);
        return;
      }

      // Virtual Table Dragging
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
      className="flex-1 bg-slate-50 dark:bg-slate-900 relative overflow-hidden transition-colors duration-200 touch-none"
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
              const isSelected = relMenuId === rel.id;
              const isHovered = hoveredRelId === rel.id;
              // Check if we are currently dragging a point belonging to this relationship
              const isDraggingThisRel = dragInfo.targetId?.includes(`cp:${rel.id}:`);
              const areDotsVisible = isHovered || isDraggingThisRel;

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

              // Get ALL route points (Auto + Manual) for rendering vertices
              const routePoints = getRoutePoints(rel, viewTables, viewOptions.lineStyle);

              // Calculate dynamic width for the label background based on character count
              const charWidth = 6; // Approximate width per character in pixels
              const padding = 16;
              const labelWidth = (rel.name ? rel.name.length * charWidth : 40) + padding;

              return (
                <g
                  key={rel.id}
                  className="pointer-events-auto cursor-pointer group"
                  onPointerDown={(e) => handleRelPointerDown(e, rel.id)}
                  onClick={(e) => handleRelClick(e, rel.id)}
                  onDoubleClick={(e) => handleRelDoubleClick(e, rel.id)}
                  onPointerEnter={() => setHoveredRelId(rel.id)}
                  onPointerLeave={() => setHoveredRelId(null)}
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

                  {/* Vertices / Control Points (Green Dots) */}
                  {/* We render ALL points returned by getRoutePoints as visual vertices when hovered */}
                  {/* BUT we filter out Start (0) and End (last) because those are anchors, not draggable control points */}
                  {areDotsVisible &&
                    routePoints.map((cp, idx) => {
                      if (idx === 0 || idx === routePoints.length - 1) return null;

                      // Map route index to manual control point index
                      const manualIndex = idx - 1;

                      return (
                        <circle
                          key={`${rel.id}-pt-${idx}`}
                          cx={cp.x}
                          cy={cp.y}
                          r={4}
                          fill="#10b981" // Green-500
                          stroke="white"
                          strokeWidth="1.5"
                          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                          className="cursor-move hover:scale-125 transition-transform drop-shadow-md"
                          onPointerDown={(e) =>
                            handleControlPointPointerDown(e, rel.id, idx, cp.x, cp.y)
                          }
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            // If it's a manual point (already materialized), we can delete it.
                            if (rel.controlPoints && rel.controlPoints.length > 0) {
                              onDeleteControlPoint(rel.id, manualIndex);
                            }
                          }}
                        />
                      );
                    })}

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
            onAddColumn={onAddColumn}
            onUpdateTable={onUpdateTable}
            onUpdateColumn={onUpdateColumn}
            onMoveColumn={onMoveColumn}
            onDeleteColumn={onDeleteColumn}
            onConfig={() => onConfigTable(table.id)}
          />
        ))}
      </div>
    </main>
  );
};

export default DiagramCanvas;
