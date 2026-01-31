export type ColumnType =
  | 'INT'
  | 'BIGINT'
  | 'VARCHAR'
  | 'CHAR'
  | 'TEXT'
  | 'DATETIME'
  | 'DATE'
  | 'DECIMAL'
  | 'BOOLEAN';

export interface Column {
  id: string;
  name: string;
  logicalName: string;
  type: string;
  length: string;
  isPk: boolean;
  isFk: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isIdentity: boolean;
}

export interface Table {
  id: string;
  name: string;
  logicalName: string;
  x: number;
  y: number;
  isManuallyEditable?: boolean;
  columns: Column[];
}

export interface Relationship {
  id: string;
  name: string;
  logicalName?: string; // New field for the logical name of the relationship/intersection table
  fromTable: string;
  fromCol: string;
  toTable: string;
  toCol: string;
  type: '1:1' | '1:N' | 'N:1' | 'N:M' | '1:0..N' | '1:0..1';
  // Stores custom names for the columns in the virtual intersection table
  // Key is the generated column ID, Value is the new name
  virtualColNames?: Record<string, string>;
  isManuallyEditable?: boolean;
  x?: number; // For N:M intersection table position
  y?: number; // For N:M intersection table position
}

export interface ViewOptions {
  showTypes: boolean;
  showLength: boolean;
  showNulls: boolean;
  showPk: boolean;
  showFk: boolean;
  showUnique: boolean;
  showIdentity: boolean;
  showCardinality: boolean;
  showCardinalityNumeric: boolean;
  showRelationshipNames: boolean;
  gridStyle: 'none' | 'dots' | 'squares';
  lineStyle: 'curved' | 'orthogonal';
}

export interface DragInfo {
  isDragging: boolean;
  offset: { x: number; y: number };
  targetId: string | null;
}

export interface TempConnection {
  sourceTableId: string;
  sourceColId: string;
  startX: number;
  startY: number;
  side: 'left' | 'right';
}

export interface WarningData {
  isOpen: boolean;
  pendingData: {
    sourceTId: string;
    sourceCId: string;
    targetTId: string;
    targetCId: string;
    sourceCol: Column;
    targetCol: Column;
  };
}
