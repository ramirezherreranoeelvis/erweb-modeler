import type { Column } from './column';

export interface Table {
      id: string;
      name: string;
      logicalName: string;
      x: number;
      y: number;
      isManuallyEditable?: boolean;
      columns: Column[];
}
