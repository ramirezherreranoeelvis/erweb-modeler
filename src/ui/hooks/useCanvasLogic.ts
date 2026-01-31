import { useState, useRef } from 'react';
import { TABLE_WIDTH } from '../../utils/geometry';
import type { Table, Relationship, DragInfo } from '../types';

interface UseCanvasLogicProps {
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  relationships: Relationship[];
  setRelationships: React.Dispatch<React.SetStateAction<Relationship[]>>;
  viewTables: Table[];
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  setSelectedId: (id: string | null) => void;
  setIsPropertiesPanelOpen: (isOpen: boolean) => void;
  setRelMenu: (menu: { id: string; x: number; y: number } | null) => void;
  globalEditable: boolean;
  mainRef: React.RefObject<HTMLDivElement | null>;
  isConnecting: boolean;
  setIsConnecting: (val: boolean) => void;
  setTempConnection: (val: any) => void;
}

export const useCanvasLogic = ({
  tables,
  setTables,
  relationships,
  setRelationships,
  viewTables,
  setSidebarWidth,
  setSelectedId,
  setIsPropertiesPanelOpen,
  setRelMenu,
  globalEditable,
  mainRef,
  isConnecting,
  setIsConnecting,
  setTempConnection,
}: UseCanvasLogicProps) => {
  // --- Local State for Interactions ---
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragInfo, setDragInfo] = useState<DragInfo>({
    isDragging: false,
    offset: { x: 0, y: 0 },
    targetId: null,
  });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

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
      setZoom((prev) => Math.min(Math.max(0.5, prev * scale), 2));
      touchDist.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    touchDist.current = null;
  };

  const handleRelPointerDown = (e: React.PointerEvent, relId: string) => {
    e.stopPropagation();
    setRelMenu(null);
    setDragInfo({ isDragging: true, offset: { x: 0, y: 0 }, targetId: relId });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
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

  const handlePointerMove = (e: React.PointerEvent) => {
    // 1. Sidebar Resizing
    if (isResizingSidebar) {
      const newWidth = Math.max(300, window.innerWidth - e.clientX);
      setSidebarWidth(newWidth);
      return;
    }

    if (!mainRef.current) return;

    // 2. Canvas Panning
    if (isPanning) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }

    // 3. Coordinate Calculation
    const canvasRect = mainRef.current.getBoundingClientRect();
    const rawX = e.clientX - canvasRect.left;
    const rawY = e.clientY - canvasRect.top;

    const x = (rawX - pan.x) / zoom;
    const y = (rawY - pan.y) / zoom;

    setMousePos({ x: rawX - pan.x, y: rawY - pan.y });

    // 4. Dragging Logic
    if (dragInfo.isDragging && dragInfo.targetId) {
      // Relationship Dragging
      const draggingRel = relationships.find((r) => r.id === dragInfo.targetId);
      if (draggingRel) {
        const sourceTable = viewTables.find((t) => t.id === draggingRel.fromTable);
        const targetTable = viewTables.find((t) => t.id === draggingRel.toTable);

        if (sourceTable && targetTable) {
          const sourceCenter = sourceTable.x + TABLE_WIDTH / 2;
          const targetCenter = targetTable.x + TABLE_WIDTH / 2;

          const newSourceSide = x < sourceCenter ? 'left' : 'right';
          const newTargetSide = x < targetCenter ? 'left' : 'right';

          if (
            draggingRel.sourceSide !== newSourceSide ||
            draggingRel.targetSide !== newTargetSide
          ) {
            setRelationships((prev) =>
              prev.map((r) =>
                r.id === draggingRel.id
                  ? { ...r, sourceSide: newSourceSide, targetSide: newTargetSide }
                  : r,
              ),
            );
          }
        }
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
    setIsResizingSidebar(false);
    setDragInfo({ isDragging: false, offset: { x: 0, y: 0 }, targetId: null });
    if (isConnecting) {
      setIsConnecting(false);
      setTempConnection(null);
    }
    if (e.target instanceof Element && e.target.hasPointerCapture(e.pointerId)) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    dragInfo,
    mousePos,
    isResizingSidebar,
    setIsResizingSidebar,
    handleCanvasPointerDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleRelPointerDown,
    handleTablePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
};
