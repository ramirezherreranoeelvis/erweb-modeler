export interface Column {
      id: string;
      name: string;
      logicalName: string;
      type: string;
      length: string;
      defaultValue?: string;
      isPk: boolean;
      isFk: boolean;
      isNullable: boolean;
      isUnique: boolean;
      isIdentity: boolean;
      originalType?: string; // Stores the semantic type (e.g. 'BOOLEAN') if converted to a generic one (e.g. 'BIT')
}
