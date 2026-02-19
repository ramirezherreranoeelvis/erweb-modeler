export interface TempConnection {
      sourceTableId: string;
      sourceColId: string;
      startX: number;
      startY: number;
      side: 'left' | 'right' | 'top' | 'bottom';
}
