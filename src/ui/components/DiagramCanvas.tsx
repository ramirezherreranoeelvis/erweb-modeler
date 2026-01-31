import React, { forwardRef } from 'react';
import type { Table, Relationship, ViewOptions, TempConnection, DragInfo } from '../types';
import {
  calculatePath,
  getConnectorPoints,
  getCurveMidpoint,
  TABLE_WIDTH,
} from '../../utils/geometry';
import TableNode from './table-nodes';

interface DiagramCanvasProps {
  viewTables: Table[];
  viewRelationships: Relationship[];
  viewOptions: ViewOptions;
  viewMode: string;
  zoom: number;
  pan: { x: number; y: number };
  theme: 'light' | 'dark';
  isPanning: boolean;
  isConnecting: boolean;
  tempConnection: TempConnection | null;
  dragInfo: DragInfo;
  mousePos: { x: number; y: number };
  selectedId: string | null;
  relMenuId: string | null;
  globalEditable: boolean;

  // Handlers
  onPointerDown: (e: React.PointerEvent) => void;
  onRelPointerDown: (e: React.PointerEvent, relId: string) => void;
  onRelClick: (e: React.MouseEvent, relId: string) => void;
  onTablePointerDown: (e: React.PointerEvent, id: string) => void;
  onStartConnection: (
    e: React.PointerEvent,
    tableId: string,
    colId: string,
    side: 'left' | 'right',
  ) => void;
  onCompleteConnection: (e: React.MouseEvent, targetTableId: string, targetColId: string) => void;
  onCompleteNewColConnection: (e: React.MouseEvent, targetTableId: string) => void;

  // Table CRUD handlers needed for TableNode
  onAddColumn: (tableId: string) => void;
  onUpdateTable: (id: string, field: string, value: any) => void;
  onUpdateColumn: (tableId: string, colId: string, field: string, value: any) => void;
  onMoveColumn: (tableId: string, fromIndex: number, toIndex: number) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onConfigTable: (id: string) => void;
}

const DiagramCanvas = forwardRef<HTMLDivElement, DiagramCanvasProps>(
  (
    {
      viewTables,
      viewRelationships,
      viewOptions,
      viewMode,
      zoom,
      pan,
      theme,
      isPanning,
      isConnecting,
      tempConnection,
      dragInfo,
      mousePos,
      selectedId,
      relMenuId,
      globalEditable,
      onPointerDown,
      onRelPointerDown,
      onRelClick,
      onTablePointerDown,
      onStartConnection,
      onCompleteConnection,
      onCompleteNewColConnection,
      onAddColumn,
      onUpdateTable,
      onUpdateColumn,
      onMoveColumn,
      onDeleteColumn,
      onConfigTable,
    },
    ref,
  ) => {
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
        ref={ref}
        className="flex-1 bg-slate-50 dark:bg-slate-900 relative overflow-hidden transition-colors duration-200 touch-none"
        onPointerDown={onPointerDown}
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
                    onPointerDown={(e) => onRelPointerDown(e, rel.id)}
                    onClick={(e) => onRelClick(e, rel.id)}
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
              onPointerDown={onTablePointerDown}
              onStartConnection={onStartConnection}
              onCompleteConnection={onCompleteConnection}
              onCompleteNewColConnection={onCompleteNewColConnection}
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
  },
);

export default DiagramCanvas;
