
import React, { useMemo, useRef, useState } from 'react';
import type { Table, Relationship, ViewOptions } from '../types';
import { TABLE_WIDTH } from '../../utils/constants';
import { getTableHeight } from '../../utils/tableCalculations';
import { calculatePath } from '../../utils/geometry';

interface MinimapProps {
  tables: Table[];
  relationships: Relationship[];
  viewOptions: ViewOptions;
  zoom: number;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number }) => void;
  containerWidth: number;
  containerHeight: number;
  theme: 'light' | 'dark';
}

const MINIMAP_WIDTH = 240;
const MINIMAP_HEIGHT = 160;
const PADDING = 50; // Padding in world units

const Minimap: React.FC<MinimapProps> = ({
  tables,
  relationships,
  viewOptions,
  zoom,
  pan,
  setPan,
  containerWidth,
  containerHeight,
  theme,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 1. Calculate World Bounds
  const bounds = useMemo(() => {
    if (tables.length === 0) {
      return { minX: 0, minY: 0, width: 1000, height: 1000 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    tables.forEach((t) => {
      if (t.x < minX) minX = t.x;
      if (t.y < minY) minY = t.y;
      
      const h = getTableHeight(t);
      if (t.x + TABLE_WIDTH > maxX) maxX = t.x + TABLE_WIDTH;
      if (t.y + h > maxY) maxY = t.y + h;
    });

    // Add padding to bounds
    minX -= PADDING;
    minY -= PADDING;
    maxX += PADDING;
    maxY += PADDING;

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [tables]);

  // 2. Calculate Scale to fit World into Minimap
  const scale = useMemo(() => {
    const scaleX = MINIMAP_WIDTH / bounds.width;
    const scaleY = MINIMAP_HEIGHT / bounds.height;
    return Math.min(scaleX, scaleY);
  }, [bounds]);

  // 3. Helper to convert World Coordinate to Minimap Coordinate
  const toMap = (val: number, isX: boolean) => {
    const offset = isX ? bounds.minX : bounds.minY;
    return (val - offset) * scale;
  };

  // 4. Viewport Rectangle Calculation
  const viewportRect = {
    x: toMap(-pan.x / zoom, true),
    y: toMap(-pan.y / zoom, false),
    w: (containerWidth / zoom) * scale,
    h: (containerHeight / zoom) * scale,
  };

  // 5. Pre-calculate relationship paths for the minimap
  // We use the same calculation logic as the main canvas
  const relPaths = useMemo(() => {
    return relationships.map((rel) => {
      const d = calculatePath(
        rel,
        tables,
        viewOptions.lineStyle,
        viewOptions.connectionMode
      );
      return { id: rel.id, d };
    });
  }, [relationships, tables, viewOptions.lineStyle, viewOptions.connectionMode]);

  // 6. Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    updatePosition(e.clientX, e.clientY);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      e.stopPropagation();
      e.preventDefault();
      updatePosition(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const updatePosition = (clientX: number, clientY: number) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    
    const mapX = clientX - rect.left;
    const mapY = clientY - rect.top;

    const worldX = (mapX / scale) + bounds.minX;
    const worldY = (mapY / scale) + bounds.minY;

    const viewWorldWidth = containerWidth / zoom;
    const viewWorldHeight = containerHeight / zoom;

    const targetViewX = worldX - viewWorldWidth / 2;
    const targetViewY = worldY - viewWorldHeight / 2;

    const newPanX = -targetViewX * zoom;
    const newPanY = -targetViewY * zoom;

    setPan({ x: newPanX, y: newPanY });
  };

  if (tables.length === 0) return null;

  return (
    <div
      ref={mapRef}
      className="absolute bottom-6 right-6 z-30 bg-white/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl overflow-hidden hidden md:block select-none"
      style={{
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* SVG Layer for Relationships */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40"
      >
        <g transform={`scale(${scale}) translate(${-bounds.minX}, ${-bounds.minY})`}>
           {relPaths.map((rel) => (
             <path
               key={rel.id}
               d={rel.d}
               fill="none"
               stroke={theme === 'dark' ? '#94a3b8' : '#475569'}
               // We need a thicker stroke in world space so it shows up when scaled down
               strokeWidth={2 / scale} 
             />
           ))}
        </g>
      </svg>

      {/* Tables Preview */}
      <div className="relative w-full h-full opacity-60">
        {tables.map((table) => {
          const x = toMap(table.x, true);
          const y = toMap(table.y, false);
          const w = TABLE_WIDTH * scale;
          const h = getTableHeight(table) * scale;
          
          return (
            <div
              key={table.id}
              className="absolute bg-slate-300 dark:bg-slate-500 border border-slate-400 dark:border-slate-400 rounded-sm"
              style={{
                left: x,
                top: y,
                width: w,
                height: h,
              }}
            />
          );
        })}
      </div>

      {/* Viewport Indicator */}
      <div
        className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move"
        style={{
          left: viewportRect.x,
          top: viewportRect.y,
          width: viewportRect.w,
          height: viewportRect.h,
          transform: 'translate3d(0,0,0)', // GPU acceleration
        }}
      />
    </div>
  );
};

export default Minimap;
