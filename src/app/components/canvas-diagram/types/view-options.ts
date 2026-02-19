export interface ViewOptions {
      showTypes: boolean;
      showLength: boolean;
      showNulls: boolean;
      showPk: boolean;
      showFk: boolean;
      showUnique: boolean;
      showIdentity: boolean;
      showDefaultValue: boolean;
      showCardinality: boolean;
      showCardinalityNumeric: boolean;
      showRelationshipNames: boolean;
      showMinimap: boolean;
      showZoomControls: boolean; // New option
      snapToGrid: boolean;
      gridStyle: 'none' | 'dots' | 'squares';
      lineStyle: 'curved' | 'orthogonal';
      connectionMode: 'column' | 'table';
      interactionMode: 'pan' | 'select';
}
