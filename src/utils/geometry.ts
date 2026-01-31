import type { Table, Relationship } from '../ui/types';

export const HEADER_HEIGHT = 40;
export const ROW_HEIGHT = 28;
export const TABLE_WIDTH = 320;

export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const getColumnRelativeY = (table: Table, colId: string): number => {
  const colIndex = table.columns.findIndex((c) => c.id === colId);
  if (colIndex === -1) return HEADER_HEIGHT / 2;
  return HEADER_HEIGHT + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
};

export const getTableHeight = (table: Table): number => {
  return HEADER_HEIGHT + table.columns.length * ROW_HEIGHT;
};

// Helper to check if a vertical line segment intersects a table
const isVerticalSegmentColliding = (x: number, y1: number, y2: number, table: Table): boolean => {
  const tableLeft = table.x;
  const tableRight = table.x + TABLE_WIDTH;
  const tableTop = table.y;
  const tableBottom = table.y + getTableHeight(table);

  // Check X overlap: Is the vertical line within the table's width?
  // We add a small buffer (5px) to avoid touching borders
  if (x < tableLeft + 5 || x > tableRight - 5) return false;

  // Check Y overlap: Does the segment (y1 to y2) overlap with the table's height?
  const segTop = Math.min(y1, y2);
  const segBottom = Math.max(y1, y2);

  // Intersection logic:
  // The segment intersects if it starts above the bottom AND ends below the top
  return segTop < tableBottom && segBottom > tableTop;
};

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
  // Increase curvature factor for a "looser" feel, matching the user's sketch.
  // Base 60, scale with distance, max 300.
  const curvature = Math.max(60, Math.min(300, distY * 0.2));

  const startLeft = startTable.x;
  const startRight = startTable.x + TABLE_WIDTH;
  const endLeft = endTable.x;
  const endRight = endTable.x + TABLE_WIDTH;

  const startH = getTableHeight(startTable);
  const endH = getTableHeight(endTable);

  // Check for Vertical Gap
  const verticalGap = Math.max(
    0,
    endTable.y - (startTable.y + startH),
    startTable.y - (endTable.y + endH),
  );
  const hasSafeGap = verticalGap > 40;

  // Heuristic: Check for horizontal overlap to determine if we should route around.
  // To match the "green line" sketch (which crosses from Right to Left even when aligned),
  // we significantly increase the overlap allowance when a vertical gap exists.
  // This prioritizes S-shape (crossing) over C-shape (same side) for vertical layouts.
  const overlapAllowance = hasSafeGap ? TABLE_WIDTH + 200 : -60;

  const isStartLeftOfEnd = startRight - overlapAllowance < endLeft;
  const isStartRightOfEnd = startLeft > endRight - overlapAllowance;

  let p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y;

  if (isStartLeftOfEnd) {
    // Standard Right -> Left
    p1x = startRight;
    p1y = startY;
    p2x = endLeft;
    p2y = endY;

    c1x = p1x + curvature;
    c1y = p1y;
    c2x = p2x - curvature;
    c2y = p2y;
  } else if (isStartRightOfEnd) {
    // Standard Left -> Right
    p1x = startLeft;
    p1y = startY;
    p2x = endRight;
    p2y = endY;

    c1x = p1x - curvature;
    c1y = p1y;
    c2x = p2x + curvature;
    c2y = p2y;
  } else {
    // Close overlap without gap, or manual override situations
    // Default to the closest sides (C-Shape)
    const leftDist = Math.abs(startLeft - endLeft);
    const rightDist = Math.abs(startRight - endRight);

    if (leftDist < rightDist) {
      // Left side connection
      p1x = startLeft;
      p1y = startY;
      p2x = endLeft;
      p2y = endY;

      c1x = p1x - curvature;
      c1y = p1y;
      c2x = p2x - curvature;
      c2y = p2y;
    } else {
      // Right side connection
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

  // Adjust self-reference loop if manual sides are same
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

export const calculatePath = (
  r: Relationship,
  tables: Table[],
  style: 'curved' | 'orthogonal' = 'curved',
): string => {
  const pts = getConnectorPoints(r, tables);
  if (!pts) return '';
  const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;

  if (style === 'orthogonal') {
    const dir1 = c1x > p1x ? 1 : -1;
    const dir2 = c2x > p2x ? 1 : -1;

    // Check if both are pointing same direction (C-Shape)
    const isCShape = dir1 === dir2;

    if (isCShape) {
      // C-Shape: Use a "rail" on the side
      const buffer = 40;
      let railX;
      if (dir1 === 1) {
        // Right
        railX = Math.max(p1x, p2x) + buffer;
      } else {
        // Left
        railX = Math.min(p1x, p2x) - buffer;
      }
      return `M ${p1x} ${p1y} L ${railX} ${p1y} L ${railX} ${p2y} L ${p2x} ${p2y}`;
    } else {
      // S-Shape candidate
      const midX = (p1x + p2x) / 2;

      // ACCURATE COLLISION DETECTION
      const startTable = tables.find((t) => t.id === r.fromTable);
      const endTable = tables.find((t) => t.id === r.toTable);

      let hasCollision = false;

      if (startTable && isVerticalSegmentColliding(midX, p1y, p2y, startTable)) {
        hasCollision = true;
      }
      if (!hasCollision && endTable && isVerticalSegmentColliding(midX, p1y, p2y, endTable)) {
        hasCollision = true;
      }

      if (hasCollision) {
        // Collision detected with the direct path.
        // Try to find a path through the vertical gap between tables.

        const buffer = 40;
        const railX1 = p1x + dir1 * buffer;
        const railX2 = p2x + dir2 * buffer;

        // Determine if there is a gap
        const t1 = startTable!;
        const t2 = endTable!;
        const t1Bottom = t1.y + getTableHeight(t1);
        const t2Bottom = t2.y + getTableHeight(t2);

        const isT1Above = t1Bottom < t2.y;
        const isT2Above = t2Bottom < t1.y;

        let railY;

        if (isT1Above) {
          // Gap exists: T1 is above T2. Route through middle of gap.
          railY = (t1Bottom + t2.y) / 2;
        } else if (isT2Above) {
          // Gap exists: T2 is above T1. Route through middle of gap.
          railY = (t2Bottom + t1.y) / 2;
        } else {
          // No gap (overlap or touching): Route around the bottom (Safety Rail)
          const maxY = Math.max(t1Bottom, t2Bottom);
          railY = maxY + 20;
        }

        return `M ${p1x} ${p1y} L ${railX1} ${p1y} L ${railX1} ${railY} L ${railX2} ${railY} L ${railX2} ${p2y} L ${p2x} ${p2y}`;
      }

      // Standard S-Shape (Safe diagonal)
      return `M ${p1x} ${p1y} L ${midX} ${p1y} L ${midX} ${p2y} L ${p2x} ${p2y}`;
    }
  }

  // Curved (Bezier)
  return `M ${p1x} ${p1y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2x} ${p2y}`;
};

export const getCurveMidpoint = (
  r: Relationship,
  tables: Table[],
  style: 'curved' | 'orthogonal' = 'curved',
) => {
  const pts = getConnectorPoints(r, tables);
  if (!pts) return { x: 0, y: 0 };
  const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;

  if (style === 'orthogonal') {
    const dir1 = c1x > p1x ? 1 : -1;
    const dir2 = c2x > p2x ? 1 : -1;
    const isCShape = dir1 === dir2;

    if (isCShape) {
      const buffer = 40;
      const railX = dir1 === 1 ? Math.max(p1x, p2x) + buffer : Math.min(p1x, p2x) - buffer;
      return { x: railX, y: (p1y + p2y) / 2 };
    } else {
      const midX = (p1x + p2x) / 2;
      const startTable = tables.find((t) => t.id === r.fromTable);
      const endTable = tables.find((t) => t.id === r.toTable);

      let hasCollision = false;
      if (startTable && isVerticalSegmentColliding(midX, p1y, p2y, startTable)) hasCollision = true;
      if (!hasCollision && endTable && isVerticalSegmentColliding(midX, p1y, p2y, endTable))
        hasCollision = true;

      if (hasCollision) {
        // Calculate midpoint on the rail
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

        // Midpoint is the center of the horizontal segment crossing the gap
        const buffer = 40;
        const railX1 = p1x + dir1 * buffer;
        const railX2 = p2x + dir2 * buffer;
        return { x: (railX1 + railX2) / 2, y: railY };
      }

      return { x: midX, y: (p1y + p2y) / 2 };
    }
  }

  // Bezier midpoint approximation
  const t = 0.5;
  const mt = 1 - t;
  const x = mt * mt * mt * p1x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * p2x;
  const y = mt * mt * mt * p1y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * p2y;
  return { x, y };
};
