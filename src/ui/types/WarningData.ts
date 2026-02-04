
import type { Column } from './Column';

export interface WarningData {
  isOpen: boolean;
  type: 'integrity' | 'collision'; // 'integrity' for type mismatch, 'collision' for name conflict
  data: {
    sourceTId: string;
    sourceCId: string;
    targetTId: string;
    targetCId?: string; // Optional in collision check
    sourceCol: Column;
    targetCol?: Column; // Optional if we haven't selected one yet
  };
}
