import type { Table, Relationship } from '../ui/types';
import { TABLE_WIDTH } from './constants';
import {
  getColumnRelativeY,
  getTableHeight,
  isVerticalSegmentColliding,
} from './tableCalculations';

// --- Spline Helpers ---
function getSplinePath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  // Catmull-Rom to Cubic Bezier conversion
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

// --- Polyline Helper (Straight segments) ---
function getPolylinePath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
}

export const getConnectorPoints = (r: Relationship, tables: Table[]) => {
  const startTable = tables.find((t) => t.id === r.fromTable);
  const endTable = tables.find((t) => t.id === r.toTable);

  if (!startTable || !endTable) return null;

  const startYRel = getColumnRelativeY(startTable, r.fromCol);
  const endYRel = getColumnRelativeY(endTable, r.toCol);

  const startY = startTable.y + startYRel;
  const endY = endTable.y + endYRel;

  // Dynamic curvature based on vertical distance
  const distY = Math.abs(endY - startY);
  const curvature = Math.max(60, Math.min(300, distY * 0.2));

  const startLeft = startTable.x;
  const startRight = startTable.x + TABLE_WIDTH;
  const endLeft = endTable.x;
  const endRight = endTable.x + TABLE_WIDTH;

  const startH = getTableHeight(startTable);
  const endH = getTableHeight(endTable);

  const verticalGap = Math.max(
    0,
    endTable.y - (startTable.y + startH),
    startTable.y - (endTable.y + endH),
  );
  const hasSafeGap = verticalGap > 40;

  const overlapAllowance = hasSafeGap ? TABLE_WIDTH + 200 : -60;

  const isStartLeftOfEnd = startRight - overlapAllowance < endLeft;
  const isStartRightOfEnd = startLeft > endRight - overlapAllowance;

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

  // Self Reference Override
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

  // --- MANUAL OVERRIDES ---
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

  if (r.fromTable === r.toTable && r.sourceSide && r.targetSide && r.sourceSide === r.targetSide) {
    const loopOffset = 60;
    if (r.sourceSide === 'left') {
      c1x = startLeft - loopOffset;
      c2x = endLeft - loopOffset;
    } else {
      c1x = startRight + loopOffset;
      c2x = endRight + loopOffset;
    }
  }

  return { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y };
};

// Return array of vertices that make up the path
export const getRoutePoints = (
  r: Relationship,
  tables: Table[],
  style: 'curved' | 'orthogonal' = 'curved',
): { x: number; y: number }[] => {
  const pts = getConnectorPoints(r, tables);
  if (!pts) return [];
  const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;

  // Case 1: Manual Control Points
  if (r.controlPoints && r.controlPoints.length > 0) {
    return [{ x: p1x, y: p1y }, ...r.controlPoints, { x: p2x, y: p2y }];
  }

  // Case 2: Orthogonal (Quadratic) Automatic Routing
  if (style === 'orthogonal') {
    const dir1 = c1x > p1x ? 1 : -1;
    const dir2 = c2x > p2x ? 1 : -1;
    const isCShape = dir1 === dir2;

    if (isCShape) {
      const buffer = 40;
      let railX;
      if (dir1 === 1) {
        railX = Math.max(p1x, p2x) + buffer;
      } else {
        railX = Math.min(p1x, p2x) - buffer;
      }
      // C-Shape Points
      return [
        { x: p1x, y: p1y },
        { x: railX, y: p1y },
        { x: railX, y: p2y },
        { x: p2x, y: p2y },
      ];
    } else {
      const midX = (p1x + p2x) / 2;
      const startTable = tables.find((t) => t.id === r.fromTable);
      const endTable = tables.find((t) => t.id === r.toTable);

      let hasCollision = false;
      if (startTable && isVerticalSegmentColliding(midX, p1y, p2y, startTable)) hasCollision = true;
      if (!hasCollision && endTable && isVerticalSegmentColliding(midX, p1y, p2y, endTable))
        hasCollision = true;

      if (hasCollision) {
        const buffer = 40;
        const railX1 = p1x + dir1 * buffer;
        const railX2 = p2x + dir2 * buffer;
        const t1 = startTable!;
        const t2 = endTable!;
        const t1Bottom = t1.y + getTableHeight(t1);
        const t2Bottom = t2.y + getTableHeight(t2);
        const isT1Above = t1Bottom < t2.y;
        const isT2Above = t2Bottom < t1.y;

        let railY;
        if (isT1Above) railY = (t1Bottom + t2.y) / 2;
        else if (isT2Above) railY = (t2Bottom + t1.y) / 2;
        else railY = Math.max(t1Bottom, t2Bottom) + 20;

        // Z-Shape around collision
        return [
          { x: p1x, y: p1y },
          { x: railX1, y: p1y },
          { x: railX1, y: railY },
          { x: railX2, y: railY },
          { x: railX2, y: p2y },
          { x: p2x, y: p2y },
        ];
      }
      // Simple S-Shape
      return [
        { x: p1x, y: p1y },
        { x: midX, y: p1y },
        { x: midX, y: p2y },
        { x: p2x, y: p2y },
      ];
    }
  }

  // Case 3: Curved Automatic (Bezier) - Just return anchors
  // Typically bezier control points are not "vertices" on the line, so we just return start/end
  return [
    { x: p1x, y: p1y },
    { x: p2x, y: p2y },
  ];
};

export const calculatePath = (
  r: Relationship,
  tables: Table[],
  style: 'curved' | 'orthogonal' = 'curved',
): string => {
  const pts = getConnectorPoints(r, tables);
  if (!pts) return '';

  // For Orthogonal (Automatic or Manual) and Manual Curved, use the route points
  if (style === 'orthogonal' || (r.controlPoints && r.controlPoints.length > 0)) {
    const points = getRoutePoints(r, tables, style);
    if (style === 'orthogonal') {
      return getPolylinePath(points);
    } else {
      return getSplinePath(points);
    }
  }

  // Fallback for Automatic Curved (Original Bezier Logic)
  // We keep this separate because getRoutePoints doesn't return bezier handles
  const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;
  return `M ${p1x} ${p1y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2x} ${p2y}`;
};

export const getCurveMidpoint = (
  r: Relationship,
  tables: Table[],
  style: 'curved' | 'orthogonal' = 'curved',
) => {
  // If we have route points (Manual or Orthogonal), find geometric center of path approximation
  const points = getRoutePoints(r, tables, style);

  // For orthogonal or manual, pick the middle point or middle segment center
  if (points.length > 2) {
    // Quick midpoint: Picking the middle vertex or middle segment
    if (points.length % 2 !== 0) {
      // Odd number of points, pick the middle one
      return points[Math.floor(points.length / 2)];
    } else {
      // Even number, pick midpoint of middle segment
      const midIdx = Math.floor(points.length / 2);
      const p1 = points[midIdx - 1];
      const p2 = points[midIdx];
      return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
  }

  // Fallback for default bezier curve (Simple Start/End)
  const pts = getConnectorPoints(r, tables);
  if (!pts) return { x: 0, y: 0 };
  const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;

  const t = 0.5;
  const mt = 1 - t;
  const x = mt * mt * mt * p1x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * p2x;
  const y = mt * mt * mt * p1y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * p2y;
  return { x, y };
};
