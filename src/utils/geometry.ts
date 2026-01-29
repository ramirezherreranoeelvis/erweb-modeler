import { Table, Relationship } from "../types";

export const HEADER_HEIGHT = 40;
export const ROW_HEIGHT = 28;
export const TABLE_WIDTH = 280;

export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const getColumnRelativeY = (table: Table, colId: string): number => {
      const colIndex = table.columns.findIndex((c) => c.id === colId);
      if (colIndex === -1) return HEADER_HEIGHT / 2;
      return HEADER_HEIGHT + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
};

export const getConnectorPoints = (r: Relationship, tables: Table[]) => {
      const startTable = tables.find((t) => t.id === r.fromTable);
      const endTable = tables.find((t) => t.id === r.toTable);

      if (!startTable || !endTable) return null;

      const startYRel = getColumnRelativeY(startTable, r.fromCol);
      const endYRel = getColumnRelativeY(endTable, r.toCol);

      const startY = startTable.y + startYRel;
      const endY = endTable.y + endYRel;

      const startLeft = startTable.x;
      const startRight = startTable.x + TABLE_WIDTH;
      const endLeft = endTable.x;
      const endRight = endTable.x + TABLE_WIDTH;

      // Heuristic: Check for horizontal overlap to determine if we should route around
      const gapBuffer = 30;
      const isStartLeftOfEnd = startRight + gapBuffer < endLeft;
      const isStartRightOfEnd = startLeft > endRight + gapBuffer;

      let p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y;

      if (isStartLeftOfEnd) {
            // Standard Right -> Left
            p1x = startRight;
            p1y = startY;
            p2x = endLeft;
            p2y = endY;

            c1x = p1x + 60;
            c1y = p1y;
            c2x = p2x - 60;
            c2y = p2y;
      } else if (isStartRightOfEnd) {
            // Standard Left -> Right
            p1x = startLeft;
            p1y = startY;
            p2x = endRight;
            p2y = endY;

            c1x = p1x - 60;
            c1y = p1y;
            c2x = p2x + 60;
            c2y = p2y;
      } else {
            // Overlap (Vertical alignment) - Route around the side to avoid crossing
            const leftDist = Math.abs(startLeft - endLeft);
            const rightDist = Math.abs(startRight - endRight);

            if (leftDist < rightDist) {
                  // Route via Left side
                  p1x = startLeft;
                  p1y = startY;
                  p2x = endLeft;
                  p2y = endY;

                  const curveFactor = 80;
                  c1x = p1x - curveFactor;
                  c1y = p1y;
                  c2x = p2x - curveFactor;
                  c2y = p2y;
            } else {
                  // Route via Right side
                  p1x = startRight;
                  p1y = startY;
                  p2x = endRight;
                  p2y = endY;

                  const curveFactor = 80;
                  c1x = p1x + curveFactor;
                  c1y = p1y;
                  c2x = p2x + curveFactor;
                  c2y = p2y;
            }
      }

      // Self Reference Override (Force Right-side loop)
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

      return { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y };
};

export const calculatePath = (
      r: Relationship,
      tables: Table[],
      style: "curved" | "orthogonal" = "curved",
): string => {
      const pts = getConnectorPoints(r, tables);
      if (!pts) return "";
      const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;

      if (style === "orthogonal") {
            const dir1 = c1x > p1x ? 1 : -1;
            const dir2 = c2x > p2x ? 1 : -1;

            // Check if both are pointing same direction (C-Shape) or opposite (S-Shape)
            const isCShape = dir1 === dir2;

            if (isCShape) {
                  // C-Shape: Use a "rail" on the side
                  // If pointing Right, use max X + buffer. If pointing Left, use min X - buffer.
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
                  // S-Shape: Use midpoint X
                  const midX = (p1x + p2x) / 2;
                  return `M ${p1x} ${p1y} L ${midX} ${p1y} L ${midX} ${p2y} L ${p2x} ${p2y}`;
            }
      }

      // Curved (Bezier)
      return `M ${p1x} ${p1y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2x} ${p2y}`;
};

export const getCurveMidpoint = (
      r: Relationship,
      tables: Table[],
      style: "curved" | "orthogonal" = "curved",
) => {
      const pts = getConnectorPoints(r, tables);
      if (!pts) return { x: 0, y: 0 };
      const { p1x, p1y, p2x, p2y, c1x, c1y, c2x, c2y } = pts;

      if (style === "orthogonal") {
            const dir1 = c1x > p1x ? 1 : -1;
            const dir2 = c2x > p2x ? 1 : -1;
            const isCShape = dir1 === dir2;

            if (isCShape) {
                  const buffer = 40;
                  const railX =
                        dir1 === 1
                              ? Math.max(p1x, p2x) + buffer
                              : Math.min(p1x, p2x) - buffer;
                  return { x: railX, y: (p1y + p2y) / 2 };
            } else {
                  const midX = (p1x + p2x) / 2;
                  return { x: midX, y: (p1y + p2y) / 2 };
            }
      }

      // Bezier midpoint approximation (t=0.5)
      // B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
      const t = 0.5;
      const mt = 1 - t;
      const x =
            mt * mt * mt * p1x +
            3 * mt * mt * t * c1x +
            3 * mt * t * t * c2x +
            t * t * t * p2x;
      const y =
            mt * mt * mt * p1y +
            3 * mt * mt * t * c1y +
            3 * mt * t * t * c2y +
            t * t * t * p2y;
      return { x, y };
};
