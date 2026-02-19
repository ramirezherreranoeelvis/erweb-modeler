export interface ConversionChange {
      tableName: string;
      columnName: string;

      // Type Info
      oldType: string;
      newType: string; // This will hold the *selected* type
      newLength: string;

      // Default Value Info
      oldDefault?: string;
      newDefault?: string;

      // UI Options
      typeOptions?: { type: string; length: string }[]; // List of alternatives (e.g. TEXT vs VARCHAR(255))
}
