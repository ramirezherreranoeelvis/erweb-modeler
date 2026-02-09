
export interface ViewOptions {
  showTypes: boolean;
  showLength: boolean;
  showNulls: boolean;
  showPk: boolean;
  showFk: boolean;
  showUnique: boolean;
  showIdentity: boolean;
  showDefaultValue: boolean; // New option
  showCardinality: boolean;
  showCardinalityNumeric: boolean;
  showRelationshipNames: boolean;
  showMinimap: boolean;
  snapToGrid: boolean;
  gridStyle: 'none' | 'dots' | 'squares';
  lineStyle: 'curved' | 'orthogonal';
  connectionMode: 'column' | 'table';
  interactionMode: 'pan' | 'select'; // New option for Cursor Mode
}
