import { Table } from '../types/table';
import { Relationship } from '../types/relationship';
import { TABLE_WIDTH } from './constants';
import {
      getColumnRelativeY,
      isVerticalSegmentColliding,
      getTableHeight,
} from './tableCalculations';
import { getSmartTableRoute } from './smartRouting';

// --- Helper: Remove collinear points and handle overlapping backtracking ---
function simplifyOrthogonalPoints(points: { x: number; y: number }[]) {
      if (points.length < 3) return points;

      const uniquePoints = points.filter((p, i) => {
            if (i === 0) return true;
            const prev = points[i - 1];
            return Math.hypot(p.x - prev.x, p.y - prev.y) > 5;
      });

      if (uniquePoints.length < 2) return uniquePoints;

      const result = [uniquePoints[0]];

      for (let i = 1; i < uniquePoints.length - 1; i++) {
            const prev = result[result.length - 1];
            const curr = uniquePoints[i];
            const next = uniquePoints[i + 1];

            const isHorizontal = Math.abs(prev.y - curr.y) < 2 && Math.abs(curr.y - next.y) < 2;
            const isVertical = Math.abs(prev.x - curr.x) < 2 && Math.abs(curr.x - next.x) < 2;

            if (isHorizontal || isVertical) {
                  continue;
            }

            result.push(curr);
      }

      result.push(uniquePoints[uniquePoints.length - 1]);
      return result;
}

// --- Spline Helpers ---
function getSplinePath(points: { x: number; y: number }[]) {
      if (points.length < 2) return '';

      if (points.length === 2) {
            return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
      }

      let d = `M ${points[0].x} ${points[0].y}`;
      const k = 1;

      for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i - 1] || points[i];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2] || p2;

            const cp1x = p1.x + ((p2.x - p0.x) / 6) * k;
            const cp1y = p1.y + ((p2.y - p0.y) / 6) * k;

            const cp2x = p2.x - ((p3.x - p1.x) / 6) * k;
            const cp2y = p2.y - ((p3.y - p1.y) / 6) * k;

            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }

      return d;
}

function getPolylinePath(points: { x: number; y: number }[]) {
      if (points.length < 2) return '';
      return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
}

// Helper to calculate Table-to-Table connection points based on relative position
const getTableBoundaryPoint = (
      table: Table,
      otherTable: Table,
      sideOverride?: 'left' | 'right' | 'top' | 'bottom',
) => {
      const tCenter = { x: table.x + TABLE_WIDTH / 2, y: table.y + getTableHeight(table) / 2 };
      const oCenter = {
            x: otherTable.x + TABLE_WIDTH / 2,
            y: otherTable.y + getTableHeight(otherTable) / 2,
      };

      const dx = oCenter.x - tCenter.x;
      const dy = oCenter.y - tCenter.y;

      // Determine strict direction if no override
      let side = sideOverride;

      if (!side) {
            if (Math.abs(dx) > Math.abs(dy)) {
                  side = dx > 0 ? 'right' : 'left';
            } else {
                  side = dy > 0 ? 'bottom' : 'top';
            }
      }

      switch (side) {
            case 'right':
                  return {
                        x: table.x + TABLE_WIDTH,
                        y: tCenter.y,
                        cx: table.x + TABLE_WIDTH + 40,
                        cy: tCenter.y,
                  };
            case 'left':
                  return { x: table.x, y: tCenter.y, cx: table.x - 40, cy: tCenter.y };
            case 'bottom':
                  return {
                        x: tCenter.x,
                        y: table.y + getTableHeight(table),
                        cx: tCenter.x,
                        cy: table.y + getTableHeight(table) + 40,
                  };
            case 'top':
                  return { x: tCenter.x, y: table.y, cx: tCenter.x, cy: table.y - 40 };
            default:
                  return { x: tCenter.x, y: tCenter.y, cx: tCenter.x, cy: tCenter.y };
      }
};

export const getConnectorPoints = (
      r: Relationship,
      tables: Table[],
      connectionMode: 'column' | 'table' = 'column',
) => {
      const startTable = tables.find((t) => t.id === r.fromTable);
      const endTable = tables.find((t) => t.id === r.toTable);

      if (!startTable || !endTable) return null;

      // --- TABLE MODE LOGIC ---
      if (connectionMode === 'table') {
            // Use the Smart Routing logic to determine optimal points directly
            // However, this function signature expects {p1, p2, c1, c2} for standard Bezier/Rendering.
            // We will perform a simplified boundary calc here for "Curved" lines in table mode,
            // but "Orthogonal" mode will bypass this via getRoutePoints and smartRouting.ts.

            const startPt = getTableBoundaryPoint(startTable, endTable, r.sourceSide as any);
            const endPt = getTableBoundaryPoint(endTable, startTable, r.targetSide as any);

            return {
                  p1x: startPt.x,
                  p1y: startPt.y,
                  p2x: endPt.x,
                  p2y: endPt.y,
                  c1x: startPt.cx,
                  c1y: startPt.cy,
                  c2x: endPt.cx,
                  c2y: endPt.cy,
            };
      }

      // --- COLUMN MODE LOGIC (Original) ---
      const startYRel = getColumnRelativeY(startTable, r.fromCol);
      const endYRel = getColumnRelativeY(endTable, r.toCol);

      let startY = startTable.y + startYRel;
      let endY = endTable.y + endYRel;

      if (Math.abs(startY - endY) < 5) {
            endY = startY;
      }

      const distY = Math.abs(endY - startY);
      const curvature = Math.max(40, Math.min(100, distY * 0.2));

      const startLeft = startTable.x;
      const startRight = startTable.x + TABLE_WIDTH;
      const endLeft = endTable.x;
      const endRight = endTable.x + TABLE_WIDTH;

      const isStartLeftOfEnd = startRight < endLeft;
      const isStartRightOfEnd = startLeft > endRight;

      let p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y;

      if (isStartLeftOfEnd) {
            p1x = startRight;
            p1y = startY;
            p2x = endLeft;
            p2y = endY;
            c1x = p1x + curvature;
            c1y = p1y;
            c2x = p2x - curvature;
            c2y = p2y;
      } else if (isStartRightOfEnd) {
            p1x = startLeft;
            p1y = startY;
            p2x = endRight;
            p2y = endY;
            c1x = p1x - curvature;
            c1y = p1y;
            c2x = p2x + curvature;
            c2y = p2y;
      } else {
            const leftDist = Math.abs(startLeft - endLeft);
            const rightDist = Math.abs(startRight - endRight);

            if (leftDist < rightDist) {
                  p1x = startLeft;
                  p1y = startY;
                  p2x = endLeft;
                  p2y = endY;
                  c1x = p1x - curvature;
                  c1y = p1y;
                  c2x = p2x - curvature;
                  c2y = p2y;
            } else {
                  p1x = startRight;
                  p1y = startY;
                  p2x = endRight;
                  p2y = endY;
                  c1x = p1x + curvature;
                  c1y = p1y;
                  c2x = p2x + curvature;
                  c2y = p2y;
            }
      }

      if (r.fromTable === r.toTable) {
            p1x = startRight;
            p1y = startY;
            p2x = endRight;
            p2y = endY;
            c1x = p1x + 60;
            c1y = p1y;
            c2x = p2x + 60;
            c2y = p2y;
      }

      // Only apply strict side overrides if they are specifically 'left' or 'right' in Column mode
      if (r.sourceSide === 'left') {
            p1x = startLeft;
            c1x = p1x - curvature;
      } else if (r.sourceSide === 'right') {
            p1x = startRight;
            c1x = p1x + curvature;
      }

      if (r.targetSide === 'left') {
            p2x = endLeft;
            c2x = p2x - curvature;
      } else if (r.targetSide === 'right') {
            p2x = endRight;
            c2x = p2x + curvature;
      }

      return { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y };
};

export const getRoutePoints = (
      r: Relationship,
      tables: Table[],
      style: 'curved' | 'orthogonal' = 'curved',
      connectionMode: 'column' | 'table' = 'column',
): { x: number; y: number }[] => {
      // --- MANUAL CONTROL POINTS ---
      // If user has manually modified the path, respect it absolutely.
      if (r.controlPoints && r.controlPoints.length > 0) {
            const pts = getConnectorPoints(r, tables, connectionMode);
            if (!pts) return [];
            const { p1x, p1y, p2x, p2y } = pts;

            if (style === 'orthogonal') {
                  const rawPoints = [{ x: p1x, y: p1y }, ...r.controlPoints, { x: p2x, y: p2y }];
                  const orthoPoints: { x: number; y: number }[] = [];

                  for (let i = 0; i < rawPoints.length - 1; i++) {
                        const curr = rawPoints[i];
                        const next = rawPoints[i + 1];

                        orthoPoints.push(curr);
                        if (Math.abs(curr.x - next.x) > 2 && Math.abs(curr.y - next.y) > 2) {
                              orthoPoints.push({ x: next.x, y: curr.y });
                        }
                  }
                  orthoPoints.push(rawPoints[rawPoints.length - 1]);
                  return simplifyOrthogonalPoints(orthoPoints);
            }
            return [{ x: p1x, y: p1y }, ...r.controlPoints, { x: p2x, y: p2y }];
      }

      // --- SMART TABLE ROUTING (NEW) ---
      // If in Table Mode and Orthogonal style, use the new smart logic
      if (connectionMode === 'table' && style === 'orthogonal') {
            const startTable = tables.find((t) => t.id === r.fromTable);
            const endTable = tables.find((t) => t.id === r.toTable);
            if (startTable && endTable) {
                  return getSmartTableRoute(startTable, endTable, r);
            }
      }

      // --- DEFAULT ROUTING (Column Mode or Curved) ---
      const pts = getConnectorPoints(r, tables, connectionMode);
      if (!pts) return [];
      const { p1x, p1y, p2x, p2y } = pts;

      if (style === 'orthogonal') {
            const { c1x, c2x } = pts;
            const dir1 = c1x > p1x ? 1 : -1;
            const dir2 = c2x > p2x ? 1 : -1;
            const isCShape = dir1 === dir2;

            if (isCShape) {
                  const buffer = 30;
                  let railX;
                  if (dir1 === 1) railX = Math.max(p1x, p2x) + buffer;
                  else railX = Math.min(p1x, p2x) - buffer;
                  return [
                        { x: p1x, y: p1y },
                        { x: railX, y: p1y },
                        { x: railX, y: p2y },
                        { x: p2x, y: p2y },
                  ];
            } else {
                  const midX = (p1x + p2x) / 2;
                  const midY = (p1y + p2y) / 2;

                  const dx = Math.abs(p1x - p2x);
                  const dy = Math.abs(p1y - p2y);

                  // Basic Z-Shape Logic
                  // If predominantly vertical stacking (often happens in table mode if fallback used), do a Z-shape via Y
                  if (connectionMode === 'table' && dy > dx + 50) {
                        return [
                              { x: p1x, y: p1y },
                              { x: p1x, y: midY },
                              { x: p2x, y: midY },
                              { x: p2x, y: p2y },
                        ];
                  }

                  // Default horizontal S-Shape logic
                  const startTable = tables.find((t) => t.id === r.fromTable);
                  const endTable = tables.find((t) => t.id === r.toTable);

                  let hasCollision = false;
                  if (startTable && isVerticalSegmentColliding(midX, p1y, p2y, startTable))
                        hasCollision = true;
                  if (
                        !hasCollision &&
                        endTable &&
                        isVerticalSegmentColliding(midX, p1y, p2y, endTable)
                  )
                        hasCollision = true;

                  if (hasCollision) {
                        const buffer = 30;
                        const railX1 = p1x + dir1 * buffer;
                        const railX2 = p2x + dir2 * buffer;
                        return [
                              { x: p1x, y: p1y },
                              { x: railX1, y: p1y },
                              { x: railX1, y: midY },
                              { x: railX2, y: midY },
                              { x: railX2, y: p2y },
                              { x: p2x, y: p2y },
                        ];
                  }
                  return [
                        { x: p1x, y: p1y },
                        { x: midX, y: p1y },
                        { x: midX, y: p2y },
                        { x: p2x, y: p2y },
                  ];
            }
      }

      return [
            { x: p1x, y: p1y },
            { x: p2x, y: p2y },
      ];
};

export const calculatePath = (
      r: Relationship,
      tables: Table[],
      style: 'curved' | 'orthogonal' = 'curved',
      connectionMode: 'column' | 'table' = 'column',
): string => {
      const pts = getConnectorPoints(r, tables, connectionMode);
      if (!pts) return '';

      // Always use route points for orthogonal to ensure smart routing is applied
      if (style === 'orthogonal' || (r.controlPoints && r.controlPoints.length > 0)) {
            const points = getRoutePoints(r, tables, style, connectionMode);
            if (style === 'orthogonal') {
                  return getPolylinePath(points);
            } else {
                  return getSplinePath(points);
            }
      }

      const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;
      return `M ${p1x} ${p1y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2x} ${p2y}`;
};

export const getCurveMidpoint = (
      r: Relationship,
      tables: Table[],
      style: 'curved' | 'orthogonal' = 'curved',
      connectionMode: 'column' | 'table' = 'column',
) => {
      const points = getRoutePoints(r, tables, style, connectionMode);

      if (points.length > 2) {
            if (points.length % 2 !== 0) {
                  return points[Math.floor(points.length / 2)];
            } else {
                  const midIdx = Math.floor(points.length / 2);
                  const p1 = points[midIdx - 1];
                  const p2 = points[midIdx];
                  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            }
      }

      const pts = getConnectorPoints(r, tables, connectionMode);
      if (!pts) return { x: 0, y: 0 };
      const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;

      const t = 0.5;
      const mt = 1 - t;
      const x = mt * mt * mt * p1x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * p2x;
      const y = mt * mt * mt * p1y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * p2y;
      return { x, y };
};
