export interface DragInfo {
      isDragging: boolean;
      offset: { x: number; y: number };
      targetId: string | null;
}
