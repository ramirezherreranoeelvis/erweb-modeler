// Helper to find closest point on a line segment to a point P
export function getClosestPointOnSegment(
      p: { x: number; y: number },
      a: { x: number; y: number },
      b: { x: number; y: number },
) {
      const atob = { x: b.x - a.x, y: b.y - a.y };
      const atop = { x: p.x - a.x, y: p.y - a.y };
      const lenSq = atob.x * atob.x + atob.y * atob.y;
      let dot = atop.x * atob.x + atop.y * atob.y;
      let t = Math.min(1, Math.max(0, dot / lenSq));
      return {
            x: a.x + atob.x * t,
            y: a.y + atob.y * t,
            t: t,
      };
}

// Distance squared
function distSq(p1: { x: number; y: number }, p2: { x: number; y: number }) {
      return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
}

// Find index to insert new point
export function getInsertIndex(
      points: { x: number; y: number }[],
      click: { x: number; y: number },
) {
      let minDist = Infinity;
      let insertIdx = 1;

      for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const close = getClosestPointOnSegment(click, p1, p2);
            const d = distSq(click, close);
            if (d < minDist) {
                  minDist = d;
                  insertIdx = i + 1;
            }
      }
      return insertIdx;
}
