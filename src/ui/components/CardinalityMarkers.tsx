import React from 'react';

interface CardinalityMarkersProps {
  theme: 'light' | 'dark';
}

export const CardinalityMarkers: React.FC<CardinalityMarkersProps> = ({ theme }) => {
  const strokeColor = theme === 'dark' ? '#94a3b8' : '#475569';
  const circleFill = theme === 'dark' ? '#1e293b' : 'white';

  // Reduced width to 22px (from 24px) for tighter aesthetic
  const w = 22;
  const h = 12;
  const midY = 6;

  return (
    <>
      {/* 
        START MARKERS (Origin Side) 
        refX=0: Attaches to the table border at x=0.
        We ensure a "rayita" (line gap) exists before the symbols start.
      */}

      {/* Mandatory One (Start): || with spacing */}
      <marker
        id="oneStart"
        markerWidth={w}
        markerHeight={h}
        refX="0"
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line: Table(0) -> Symbols */}
        <line x1="0" y1={midY} x2={16} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Bars positioned to leave a gap (rayita) from 0 to 10 */}
        <line x1="10" y1="0" x2="10" y2={h} stroke={strokeColor} strokeWidth="1.5" />
        <line x1="16" y1="0" x2="16" y2={h} stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* Optional One (Start): |O with spacing */}
      <marker
        id="zeroOneStart"
        markerWidth={w}
        markerHeight={h}
        refX="0"
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line */}
        <line x1="0" y1={midY} x2={w} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Bar at 8, Circle at 15. Gap from 0 to 8. */}
        <line x1="8" y1="0" x2="8" y2={h} stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="15" cy={midY} r="3" fill={circleFill} stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* 
        END MARKERS (Target Side) 
        refX=22: Attaches to the table border at x=22.
        Symbols are FLUSH with the table (x=22) to remove "extra line".
      */}

      {/* Many (End): Crow's Foot */}
      <marker
        id="manyEnd"
        markerWidth={w}
        markerHeight={h}
        refX={w}
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line */}
        <line x1="6" y1={midY} x2={w} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Vertical Bar at 12 */}
        <line x1="12" y1="0" x2="12" y2={h} stroke={strokeColor} strokeWidth="1.5" />

        {/* Crow's Foot Tips at 22 (Flush) */}
        <path d={`M22,0 L12,${midY} L22,${h}`} fill="none" stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* One (End): || */}
      <marker
        id="oneEnd"
        markerWidth={w}
        markerHeight={h}
        refX={w}
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line */}
        <line x1="0" y1={midY} x2={w} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Bars: One at 16, Second at 22 (Flush with Table) */}
        <line x1="16" y1="0" x2="16" y2={h} stroke={strokeColor} strokeWidth="1.5" />
        <line x1="22" y1="0" x2="22" y2={h} stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* Zero to Many (End): O< */}
      <marker
        id="zeroManyEnd"
        markerWidth={w}
        markerHeight={h}
        refX={w}
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line */}
        <line x1="0" y1={midY} x2={w} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Circle at 8 */}
        <circle cx="8" cy={midY} r="3" fill={circleFill} stroke={strokeColor} strokeWidth="1.5" />

        {/* Crow's Foot Tips at 22 (Flush) */}
        <path d={`M22,0 L11,${midY} L22,${h}`} fill="none" stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* Zero to One (End): |O */}
      <marker
        id="zeroOneEnd"
        markerWidth={w}
        markerHeight={h}
        refX={w}
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line */}
        <line x1="0" y1={midY} x2={w} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Vertical Bar at 22 (Flush) */}
        <line x1="22" y1="0" x2="22" y2={h} stroke={strokeColor} strokeWidth="1.5" />

        {/* Circle at 14 */}
        <circle cx="14" cy={midY} r="3" fill={circleFill} stroke={strokeColor} strokeWidth="1.5" />
      </marker>
    </>
  );
};
