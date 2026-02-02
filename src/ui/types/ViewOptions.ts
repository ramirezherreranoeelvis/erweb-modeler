export interface ViewOptions {
  showTypes: boolean;
  showLength: boolean;
  showNulls: boolean;
  showPk: boolean;
  showFk: boolean;
  showUnique: boolean;
  showIdentity: boolean;
  showCardinality: boolean;
  showCardinalityNumeric: boolean;
  showRelationshipNames: boolean;
  gridStyle: 'none' | 'dots' | 'squares';
  lineStyle: 'curved' | 'orthogonal';
}