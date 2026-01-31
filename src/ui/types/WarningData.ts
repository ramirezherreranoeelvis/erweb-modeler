import type { Column } from './Column';

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
