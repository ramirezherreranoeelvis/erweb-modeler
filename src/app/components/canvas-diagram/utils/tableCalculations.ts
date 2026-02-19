import { Table } from '../types/table';
import { HEADER_HEIGHT, ROW_HEIGHT, TABLE_WIDTH } from './constants';

export const getColumnRelativeY = (table: Table, colId: string): number => {
      const colIndex = table.columns.findIndex((c) => c.id === colId);
      if (colIndex === -1) return HEADER_HEIGHT / 2;
      return HEADER_HEIGHT + colIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
};

export const getTableHeight = (table: Table): number => {
      // Add 4px buffer to account for 'pb-1' (padding-bottom: 4px) in TableBody.tsx
      // This ensures the connection point at the bottom is not covered by the table container.
      return HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + 4;
};

// Helper to check if a vertical line segment intersects a table
export const isVerticalSegmentColliding = (
      x: number,
      y1: number,
      y2: number,
      table: Table,
): boolean => {
      const tableLeft = table.x;
      const tableRight = table.x + TABLE_WIDTH;
      const tableTop = table.y;
      const tableBottom = table.y + getTableHeight(table);

      if (x < tableLeft + 5 || x > tableRight - 5) return false;
      const segTop = Math.min(y1, y2);
      const segBottom = Math.max(y1, y2);
      return segTop < tableBottom && segBottom > tableTop;
};
