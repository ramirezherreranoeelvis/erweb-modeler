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
