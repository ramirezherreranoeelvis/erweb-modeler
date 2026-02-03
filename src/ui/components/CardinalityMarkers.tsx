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
      {/* START CARDINALITY */}

      {/* 1-1 */}
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
        <line x1="6" y1="0" x2="6" y2={h} stroke={strokeColor} strokeWidth="1.5" />
        <line x1="12" y1="0" x2="12" y2={h} stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* 1-0 */}
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
        <line x1="6" y1="0" x2="6" y2={h} stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="10" cy={midY} r="3" fill={circleFill} stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* Many */}
      <marker
        id="manyStart"
        markerWidth={w}
        markerHeight={h}
        refX="2"
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line */}
        <line x1="0" y1={midY} x2={16} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Crow's Foot Tips at 0 (RefX=2 puts this slightly inside table, similar to manyEnd) */}
        <path d={`M0,0 L8,${midY} L0,${h}`} fill="none" stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* END CARDINALITY*/}

      {/* 1-M */}
      <marker
        id="oneManyEnd"
        markerWidth={w}
        markerHeight={h}
        refX={w}
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line */}
        <line x1="10" y1={midY} x2={24} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Vertical Bar at 12 */}
        <line x1="16" y1="0" x2="16" y2={h} stroke={strokeColor} strokeWidth="1.5" />

        {/* Crow's Foot Tips at 22 (Flush) */}
        <path d={`M24,0 L16,${midY} L24,${h}`} fill="none" stroke={strokeColor} strokeWidth="1.5" />
      </marker>

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
        <line x1="10" y1={midY} x2={24} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Crow's Foot Tips at 22 (Flush) */}
        <path d={`M24,0 L16,${midY} L24,${h}`} fill="none" stroke={strokeColor} strokeWidth="1.5" />
      </marker>
      {/* 1-1 */}
      <marker
        id="oneEnd"
        markerWidth={w}
        markerHeight={h}
        refX={w}
        refY={midY}
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        {/* Connector Line: Table(0) -> Symbols */}
        <line x1="6" y1={midY} x2={22} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Bars positioned to leave a gap (rayita) from 0 to 10 */}
        <line x1="10" y1="0" x2="10" y2={h} stroke={strokeColor} strokeWidth="1.5" />
        <line x1="16" y1="0" x2="16" y2={h} stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* 1-0-M */}
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
        <line x1="10" y1={midY} x2={24} y2={midY} stroke={strokeColor} strokeWidth="1.5" />

        {/* Circle at 8 */}
        <circle cx="12" cy={midY} r="3" fill={circleFill} stroke={strokeColor} strokeWidth="1.5" />

        {/* Vertical Bar at 12 */}
        <line x1="16" y1="0" x2="16" y2={h} stroke={strokeColor} strokeWidth="1.5" />

        {/* Crow's Foot Tips at 22 (Flush) */}
        <path d={`M24,0 L16,${midY} L24,${h}`} fill="none" stroke={strokeColor} strokeWidth="1.5" />
      </marker>

      {/* 1-0 */}
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

        {/* Bar at 8, Circle at 15. Gap from 0 to 8. */}
        <line x1="15" y1="0" x2="15" y2={h} stroke={strokeColor} strokeWidth="1.5" />
        <circle cx="12" cy={midY} r="3" fill={circleFill} stroke={strokeColor} strokeWidth="1.5" />
      </marker>
    </>
  );
};
