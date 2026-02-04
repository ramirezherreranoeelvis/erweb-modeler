
import type { Table, Relationship } from '../ui/types';
import { TABLE_WIDTH } from './constants';
import { getTableHeight } from './tableCalculations';

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Helper to get center
const getCenter = (r: Rect): Point => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2
});

// Helper to get anchors matching table boundaries exactly
const getAnchors = (r: Rect) => ({
  top: { x: r.x + r.w / 2, y: r.y },
  bottom: { x: r.x + r.w / 2, y: r.y + r.h },
  left: { x: r.x, y: r.y + r.h / 2 },
  right: { x: r.x + r.w, y: r.y + r.h / 2 }
});

// Helper to remove redundant inline points
function simplifyPoints(points: Point[]): Point[] {
    if (points.length < 3) return points;
    const res = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const prev = res[res.length - 1];
        const curr = points[i];
        const next = points[i+1];
        // If vertical alignment (x is same)
        if (Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1) continue;
        // If horizontal alignment (y is same)
        if (Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1) continue;
        res.push(curr);
    }
    res.push(points[points.length-1]);
    return res;
}

export const getSmartTableRoute = (
  source: Table,
  target: Table,
  rel: Relationship
): Point[] => {
  const sRect: Rect = { x: source.x, y: source.y, w: TABLE_WIDTH, h: getTableHeight(source) };
  const tRect: Rect = { x: target.x, y: target.y, w: TABLE_WIDTH, h: getTableHeight(target) };

  // 1. Calculate Overlaps to determine automatic sides
  // Horizontal Overlap (width of intersection on X axis)
  const xOverlap = Math.max(0, Math.min(sRect.x + sRect.w, tRect.x + tRect.w) - Math.max(sRect.x, tRect.x));
  // Vertical Overlap (height of intersection on Y axis)
  const yOverlap = Math.max(0, Math.min(sRect.y + sRect.h, tRect.y + tRect.h) - Math.max(sRect.y, tRect.y));

  let startSide = rel.sourceSide;
  let endSide = rel.targetSide;

  // Auto-determine sides if not set
  if (!startSide || !endSide) {
      if (xOverlap > 0) {
          // They overlap horizontally (stacked), so we should connect vertically (Top/Bottom)
          if (sRect.y < tRect.y) {
              startSide = startSide || 'bottom';
              endSide = endSide || 'top';
          } else {
              startSide = startSide || 'top';
              endSide = endSide || 'bottom';
          }
      } else if (yOverlap > 0) {
          // They overlap vertically (side-by-side), so connect horizontally (Left/Right)
          if (sRect.x < tRect.x) {
              startSide = startSide || 'right';
              endSide = endSide || 'left';
          } else {
              startSide = startSide || 'left';
              endSide = endSide || 'right';
          }
      } else {
          // No direct overlap (Diagonal). Pick the side facing the other table.
          const sC = getCenter(sRect);
          const tC = getCenter(tRect);
          const dx = tC.x - sC.x;
          const dy = tC.y - sC.y;
          
          if (Math.abs(dy) > Math.abs(dx)) {
              // More vertical distance
              startSide = startSide || (dy > 0 ? 'bottom' : 'top');
              endSide = endSide || (dy > 0 ? 'top' : 'bottom');
          } else {
              // More horizontal distance
              startSide = startSide || (dx > 0 ? 'right' : 'left');
              endSide = endSide || (dx > 0 ? 'left' : 'right');
          }
      }
  }

  // 2. Resolve coordinates based on chosen sides
  const sAnchors = getAnchors(sRect);
  const tAnchors = getAnchors(tRect);
  const startPt = sAnchors[startSide as keyof typeof sAnchors];
  const endPt = tAnchors[endSide as keyof typeof tAnchors];

  // 3. Construct Path (Orthogonal)
  const points: Point[] = [startPt];
  
  // Helpers to check side orientation
  const isVerticalStart = startSide === 'top' || startSide === 'bottom';
  const isVerticalEnd = endSide === 'top' || endSide === 'bottom';
  
  // --- Case A: Opposite Parallel Sides (Ideal Z-shape) ---
  // e.g. Bottom -> Top (with target below), or Right -> Left (with target to right)
  const isOppositeVertical = (startSide === 'bottom' && endSide === 'top') || (startSide === 'top' && endSide === 'bottom');
  const isOppositeHorizontal = (startSide === 'right' && endSide === 'left') || (startSide === 'left' && endSide === 'right');

  // Check if they are physically positioned correctly for a Z shape
  // (e.g. if Bottom -> Top, is Target actually below Source?)
  const validZVertical = isOppositeVertical && ((startSide === 'bottom' && startPt.y < endPt.y) || (startSide === 'top' && startPt.y > endPt.y));
  const validZHorizontal = isOppositeHorizontal && ((startSide === 'right' && startPt.x < endPt.x) || (startSide === 'left' && startPt.x > endPt.x));

  if (validZVertical) {
      const midY = (startPt.y + endPt.y) / 2;
      points.push({ x: startPt.x, y: midY });
      points.push({ x: endPt.x, y: midY });
  } 
  else if (validZHorizontal) {
      const midX = (startPt.x + endPt.x) / 2;
      points.push({ x: midX, y: startPt.y });
      points.push({ x: midX, y: endPt.y });
  }
  
  // --- Case B: Perpendicular Sides (L-shape or 2-turn) ---
  // e.g. Bottom -> Left
  else if (isVerticalStart !== isVerticalEnd) {
      // Breakout distance to avoid cutting corner immediately
      const breakout = 20; 
      
      let p1 = { ...startPt };
      if (startSide === 'top') p1.y -= breakout;
      if (startSide === 'bottom') p1.y += breakout;
      if (startSide === 'left') p1.x -= breakout;
      if (startSide === 'right') p1.x += breakout;
      
      points.push(p1);
      
      // Determine intersection point
      // If Start is Vertical, we moved Y. Now we move X to match End, then Y to match End.
      if (isVerticalStart) {
          // Current at (start.x, p1.y)
          // Move Horizontally to End.x
          points.push({ x: endPt.x, y: p1.y });
      } else {
          // Current at (p1.x, start.y)
          // Move Vertically to End.y
          points.push({ x: p1.x, y: endPt.y });
      }
  }
  
  // --- Case C: "Wrong" Side or Same Side (U-Turn / C-Shape) ---
  // e.g. Right -> Right, or Bottom -> Top when Target is actually ABOVE Source
  else {
     const buffer = 40;
     
     if (isVerticalStart) {
        // Vertical U-Turn
        // Decide whether to go "Above" min Y or "Below" max Y
        const minY = Math.min(startPt.y, endPt.y);
        const maxY = Math.max(startPt.y, endPt.y);
        
        let railY;
        // If connecting Top-to-Top, go above
        if (startSide === 'top' && endSide === 'top') railY = minY - buffer;
        // If connecting Bottom-to-Bottom, go below
        else if (startSide === 'bottom' && endSide === 'bottom') railY = maxY + buffer;
        else {
            // Mixed but wrong direction (e.g. Bottom -> Top but target is Above)
            // Go via the side that has more space or is "open"? 
            // Default to Right side loop for consistency
            const railX = Math.max(sRect.x + sRect.w, tRect.x + tRect.w) + buffer;
            points.push({ x: railX, y: startPt.y });
            points.push({ x: railX, y: endPt.y });
            points.push(endPt);
            return simplifyPoints(points);
        }

        points.push({ x: startPt.x, y: railY });
        points.push({ x: endPt.x, y: railY });
     } else {
        // Horizontal U-Turn (Left-Left or Right-Right)
        const minX = Math.min(startPt.x, endPt.x);
        const maxX = Math.max(startPt.x, endPt.x);
        
        let railX;
        if (startSide === 'left' && endSide === 'left') railX = minX - buffer;
        else if (startSide === 'right' && endSide === 'right') railX = maxX + buffer;
        else {
             // Mixed but wrong direction
             const railY = Math.max(sRect.y + sRect.h, tRect.y + tRect.h) + buffer;
             points.push({ x: startPt.x, y: railY });
             points.push({ x: endPt.x, y: railY });
             points.push(endPt);
             return simplifyPoints(points);
        }

        points.push({ x: railX, y: startPt.y });
        points.push({ x: railX, y: endPt.y });
     }
  }

  points.push(endPt);
  return simplifyPoints(points);
};
