export interface Relationship {
      id: string;
      name: string;
      logicalName?: string;
      fromTable: string;
      fromCol: string;
      toTable: string;
      toCol: string;
      type: '1:1' | '1:N' | 'N:1' | 'N:M' | '1:0..N' | '1:0..1';
      virtualColNames?: Record<string, string>;
      isManuallyEditable?: boolean;
      x?: number;
      y?: number;
      sourceSide?: 'left' | 'right' | 'top' | 'bottom';
      targetSide?: 'left' | 'right' | 'top' | 'bottom';
      controlPoints?: { x: number; y: number }[];
}
