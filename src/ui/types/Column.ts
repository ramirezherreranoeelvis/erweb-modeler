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
