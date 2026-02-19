import {
      Component,
      input,
      signal,
      computed,
      ElementRef,
      AfterViewInit,
      OnDestroy,
      output,
      viewChild,
      effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Table } from '../types/table';
import { Relationship } from '../types/relationship';
import { ViewOptions } from '../types/view-options';
import { TempConnection } from '../types/temp-connection';
import { DbEngine } from '../utils/dbDataTypes';
import {
      calculatePath,
      getRoutePoints,
      getCurveMidpoint,
      getInsertIndex,
      TABLE_WIDTH,
      getTableHeight,
} from '../utils/geometry';
import { Minimap } from './minimap/minimap';
import { CardinalityMarkers } from './cardinality/cardinality-markers';
import { TableNode } from './table-nodes/table-node';

@Component({
      selector: 'panel-canvas',
      imports: [CommonModule, Minimap, CardinalityMarkers, TableNode],
      templateUrl: './panel-canvas.html',
      styles: [
            `
                  :host {
                        display: block;
                        width: 100%;
                        height: 100%;
                        flex: 1;
                        overflow: hidden;
                        position: relative;
                  }
            `,
      ],
      host: {
            '(window:keydown)': 'handleKeyDown($event)',
      },
})
export class PanelCanvas implements AfterViewInit, OnDestroy {
      // Inputs
      tables = input.required<Table[]>();
      relationships = input.required<Relationship[]>();
      viewOptions = input.required<ViewOptions>();
      viewMode = input.required<string>();
      dbEngine = input.required<DbEngine>();
      theme = input<'light' | 'dark'>('light');
      globalEditable = input<boolean>(false);
      selectedId = input<string | null>(null);
      selectedTableIds = input<Set<string> | null>(null);

      // Business Outputs
      selectId = output<string | null>();
      selectTableIds = output<Set<string>>();
      openTableProperties = output<string>(); // NEW Output
      relationshipClick = output<{ id: string; x: number; y: number }>();
      applyConnection = output<{
            sourceTId: string;
            sourceCId: string;
            targetTId: string;
            targetCId: string;
      }>();
      reconnectRelationship = output<{
            relId: string;
            sourceTId: string;
            sourceCId: string;
            targetTId: string;
            targetCId: string;
      }>();
      createFkConnection = output<{
            sourceTableId: string;
            sourceColId: string;
            targetTableId: string;
      }>();
      updateTable = output<{ id: string; field: string; value: any }>();
      updateColumn = output<{ tableId: string; colId: string; field: string; value: any }>();
      moveColumn = output<{ tableId: string; fromIndex: number; toIndex: number }>();
      deleteColumn = output<{ tableId: string; colId: string }>();
      addColumn = output<string>();
      configTable = output<string>();

      // Canvas Outputs
      tablePositionChange = output<{ id: string; x: number; y: number }>();
      controlPointChange = output<{ relId: string; index: number; x: number; y: number }>();
      controlPointsSet = output<{ relId: string; points: { x: number; y: number }[] }>();
      deleteControlPoint = output<{ relId: string; index: number }>();
      addControlPoint = output<{ relId: string; x: number; y: number; index?: number }>();
      clearMenus = output<void>();

      // State
      zoom = signal(1);
      pan = signal({ x: 0, y: 0 });
      containerSize = signal({ width: 0, height: 0 });

      // Interaction State
      isConnecting = signal(false);
      tempConnection = signal<TempConnection | null>(null);
      mousePos = signal({ x: 0, y: 0 });
      hoveredRelId = signal<string | null>(null);
      reconnectingRelId = signal<string | null>(null);
      selectedControlPoint = signal<{ relId: string; index: number } | null>(null);

      // Selection Box State
      isSelecting = signal(false);
      selectionBox = signal<{
            startX: number;
            startY: number;
            currentX: number;
            currentY: number;
      } | null>(null);

      // Drag State
      dragState = signal<{
            type: 'pan' | 'table' | 'cp' | 'segment' | 'select' | null;
            targetId?: string;
            offset: { x: number; y: number };
            data?: any;
            draggedTableIds?: Set<string>;
            tempPoints?: { x: number; y: number }[]; // Store temporary points during async update
      }>({ type: null, offset: { x: 0, y: 0 } });

      readonly mainRef = viewChild<ElementRef<HTMLElement>>('mainRef');
      private resizeObserver!: ResizeObserver;

      constructor() {
            effect(() => {
                  const el = this.mainRef()?.nativeElement;
                  if (el) {
                        el.removeEventListener('wheel', this.handleWheel);
                        el.addEventListener('wheel', this.handleWheel, { passive: false });
                  }
            });
      }

      // --- COMPUTED VISUALS ---

      zoomPercentage = computed(() => Math.round(this.zoom() * 100));

      transformStyle = computed(
            () => `translate(${this.pan().x}px, ${this.pan().y}px) scale(${this.zoom()})`,
      );

      cursorStyle = computed(() => {
            const dragging = this.dragState().type;
            if (dragging === 'pan' || dragging === 'table' || dragging === 'cp') return 'grabbing';
            if (this.isConnecting()) return 'crosshair';
            if (this.viewOptions().interactionMode === 'select') return 'default';
            return 'grab';
      });

      gridSize = computed(() => {
            const size = this.viewOptions().gridStyle === 'dots' ? 40 : 90;
            return `${size * this.zoom()}px ${size * this.zoom()}px`;
      });
      gridPosition = computed(() => `${this.pan().x}px ${this.pan().y}px`);

      strokeColor = computed(() => (this.theme() === 'dark' ? '#94a3b8' : '#475569'));

      gridBackground = computed(() => {
            const style = this.viewOptions().gridStyle;
            const isDark = this.theme() === 'dark';
            const color = isDark ? '#33415580' : '#cbd5e1';
            if (style === 'dots') return `radial-gradient(${color} 1px, transparent 1px)`;
            if (style === 'squares')
                  return `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`;
            return 'none';
      });

      selectionRect = computed(() => {
            const box = this.selectionBox();
            if (!box) return { x: 0, y: 0, w: 0, h: 0 };
            return {
                  x: Math.min(box.startX, box.currentX),
                  y: Math.min(box.startY, box.currentY),
                  w: Math.abs(box.currentX - box.startX),
                  h: Math.abs(box.currentY - box.startY),
            };
      });

      // --- RELATIONSHIPS RENDERING COMPUTED ---
      renderedRelationships = computed(() => {
            const rels = this.relationships();
            const tables = this.tables();
            const opts = this.viewOptions();
            const hovered = this.hoveredRelId();
            const selectedId = this.selectedId();
            const dragging = this.dragState();
            const reconnectingId = this.reconnectingRelId();
            const selectedCP = this.selectedControlPoint();

            return rels.map((rel) => {
                  if (reconnectingId === rel.id) {
                        // Return empty/hidden if being reconnected
                        return {
                              ...rel,
                              path: '',
                              handles: [],
                              segments: [],
                              markerStart: '',
                              markerEnd: '',
                              numericLabels: null,
                              isSelected: undefined,
                              dashArray: undefined,
                              showControls: undefined,
                              midpoint: undefined,
                              labelWidth: undefined,
                        };
                  }

                  const isHovered = hovered === rel.id;
                  const isDraggingThis = dragging.targetId === rel.id;
                  // Keep controls visible if hovered, selected, dragging, OR if a control point of this rel is focused
                  const isChildControlPointSelected = selectedCP?.relId === rel.id;
                  const isSelected = selectedId === rel.id || isChildControlPointSelected;
                  const showControls =
                        isHovered || isSelected || isDraggingThis || isChildControlPointSelected;

                  const path = calculatePath(rel, tables, opts.lineStyle, opts.connectionMode);
                  const visualPoints = getRoutePoints(
                        rel,
                        tables,
                        opts.lineStyle,
                        opts.connectionMode,
                  );

                  // Handles Logic:
                  let handles: { x: number; y: number; index: number }[] = [];

                  // Generate handles for ALL intermediate corners (visualPoints 1 to N-1)
                  if (visualPoints.length > 2) {
                        for (let i = 1; i < visualPoints.length - 1; i++) {
                              const pt = visualPoints[i];
                              let realIndex = -999; // Virtual flag
                              if (rel.controlPoints) {
                                    const idx = rel.controlPoints.findIndex(
                                          (cp) =>
                                                Math.abs(cp.x - pt.x) < 2 &&
                                                Math.abs(cp.y - pt.y) < 2,
                                    );
                                    if (idx !== -1) realIndex = idx;
                              }
                              handles.push({ x: pt.x, y: pt.y, index: realIndex });
                        }
                  }

                  const targetTable = tables.find((t) => t.id === rel.toTable);
                  const targetCol = targetTable?.columns.find((c) => c.id === rel.toCol);
                  const isOptional = targetCol?.isNullable;
                  const isIdentifying = targetCol?.isPk;
                  const dashArray = isIdentifying ? 'none' : '4,4';

                  let markerStart = isOptional ? 'url(#zeroOneStart)' : 'url(#oneStart)';
                  let markerEnd = 'url(#oneManyEnd)';

                  if (rel.type === '1:1') markerEnd = 'url(#oneEnd)';
                  if (rel.type === '1:0..N') markerEnd = 'url(#zeroManyEnd)';
                  if (rel.type === '1:0..1') markerEnd = 'url(#zeroOneEnd)';
                  if (rel.type === 'N:M') {
                        markerStart = 'url(#manyStart)';
                        markerEnd = 'url(#manyEnd)';
                  }
                  if (rel.type === 'N:1') {
                        markerStart = 'url(#manyStart)';
                        markerEnd = 'url(#oneEnd)';
                  }
                  if (!opts.showCardinality) {
                        markerStart = '';
                        markerEnd = '';
                  }

                  const midpoint = getCurveMidpoint(
                        rel,
                        tables,
                        opts.lineStyle,
                        opts.connectionMode,
                  );
                  const labelWidth = (rel.name ? rel.name.length * 6 : 40) + 16;

                  const segments = [];
                  if (visualPoints.length > 2) {
                        // Only show segments between internal control points (Circle -> Circle)
                        // Exclude index 0 (Start -> First CP) and index length-2 (Last CP -> End)
                        for (let i = 1; i < visualPoints.length - 2; i++) {
                              const p1 = visualPoints[i];
                              const p2 = visualPoints[i + 1];

                              if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 10) {
                                    const isVertical = Math.abs(p1.x - p2.x) < 2;
                                    const isHorizontal = Math.abs(p1.y - p2.y) < 2;

                                    let orientation = 'diagonal';
                                    if (isVertical) orientation = 'vertical';
                                    else if (isHorizontal) orientation = 'horizontal';

                                    const midX = (p1.x + p2.x) / 2;
                                    const midY = (p1.y + p2.y) / 2;

                                    let w = 10;
                                    let h = 10;
                                    if (orientation === 'vertical') {
                                          w = 8;
                                          h = 16;
                                    } else if (orientation === 'horizontal') {
                                          w = 16;
                                          h = 8;
                                    }

                                    segments.push({
                                          index: i,
                                          x: midX - w / 2,
                                          y: midY - h / 2,
                                          width: w,
                                          height: h,
                                          orientation,
                                    });
                              }
                        }
                  }

                  // Numeric Labels Calculation
                  let numericLabels = null;
                  if (opts.showCardinalityNumeric && visualPoints.length >= 2) {
                        let startLabel = '1';
                        let endLabel = '1';

                        if (rel.type === '1:N') endLabel = 'N';
                        else if (rel.type === 'N:1') {
                              startLabel = 'N';
                              endLabel = '1';
                        } else if (rel.type === 'N:M') {
                              startLabel = 'N';
                              endLabel = 'M';
                        } else if (rel.type === '1:0..N') endLabel = '0..N';
                        else if (rel.type === '1:0..1') endLabel = '0..1';

                        // Start Position Calculation (p0 -> p1)
                        const p0 = visualPoints[0];
                        const p1 = visualPoints[1];
                        const dxS = p1.x - p0.x;
                        const dyS = p1.y - p0.y;

                        let sX = p0.x;
                        let sY = p0.y;
                        let sAnchor = 'middle';

                        if (Math.abs(dxS) > Math.abs(dyS)) {
                              // Horizontal
                              sX += (dxS > 0 ? 1 : -1) * 12;
                              sY -= 6;
                        } else {
                              // Vertical
                              sY += (dyS > 0 ? 1 : -1) * 12 + 3;
                              sX += 6;
                              sAnchor = 'start';
                        }

                        // End Position Calculation (pN -> pN-1)
                        const pN = visualPoints[visualPoints.length - 1];
                        const pN_1 = visualPoints[visualPoints.length - 2];
                        const dxE = pN_1.x - pN.x;
                        const dyE = pN_1.y - pN.y;

                        let eX = pN.x;
                        let eY = pN.y;
                        let eAnchor = 'middle';

                        if (Math.abs(dxE) > Math.abs(dyE)) {
                              // Horizontal
                              eX += (dxE > 0 ? 1 : -1) * 12;
                              eY -= 6;
                        } else {
                              // Vertical
                              eY += (dyE > 0 ? 1 : -1) * 12 + 3;
                              eX += 6;
                              eAnchor = 'start';
                        }

                        numericLabels = {
                              start: { text: startLabel, x: sX, y: sY, anchor: sAnchor },
                              end: { text: endLabel, x: eX, y: eY, anchor: eAnchor },
                        };
                  }

                  return {
                        ...rel,
                        path,
                        markerStart,
                        markerEnd,
                        dashArray,
                        midpoint,
                        labelWidth,
                        isSelected,
                        showControls,
                        visualPoints,
                        handles,
                        segments,
                        numericLabels,
                  };
            });
      });

      // --- LIFECYCLE ---

      ngAfterViewInit() {
            const el = this.mainRef()?.nativeElement;
            if (el) {
                  this.resizeObserver = new ResizeObserver((entries) => {
                        for (let entry of entries) {
                              this.containerSize.set({
                                    width: entry.contentRect.width,
                                    height: entry.contentRect.height,
                              });
                        }
                  });
                  this.resizeObserver.observe(el);
            }
      }

      ngOnDestroy() {
            this.resizeObserver?.disconnect();
            const el = this.mainRef()?.nativeElement;
            if (el) {
                  el.removeEventListener('wheel', this.handleWheel);
            }
      }

      // --- EVENT HANDLERS ---

      private isMobile(): boolean {
            return window.innerWidth < 768;
      }

      handleKeyDown(e: KeyboardEvent) {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                  return;

            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedControlPoint()) {
                  const cp = this.selectedControlPoint()!;
                  this.deleteControlPoint.emit({ relId: cp.relId, index: cp.index });
                  this.selectedControlPoint.set(null);
                  e.preventDefault();
                  e.stopPropagation();
            }
      }

      handleWheel = (e: WheelEvent) => {
            if (!this.mainRef()) return;
            if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  const sensitivity = 0.001;
                  const delta = -e.deltaY * sensitivity;
                  const currentZoom = this.zoom();
                  const currentPan = this.pan();
                  const newZoom = Math.min(Math.max(0.1, currentZoom + delta * currentZoom), 2);

                  const rect = this.mainRef()!.nativeElement.getBoundingClientRect();
                  const mouseX = e.clientX - rect.left;
                  const mouseY = e.clientY - rect.top;

                  const worldX = (mouseX - currentPan.x) / currentZoom;
                  const worldY = (mouseY - currentPan.y) / currentZoom;

                  const newPanX = mouseX - worldX * newZoom;
                  const newPanY = mouseY - worldY * newZoom;

                  this.zoom.set(newZoom);
                  this.pan.set({ x: newPanX, y: newPanY });
            } else {
                  this.pan.update((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
            }
      };

      handleCanvasPointerDown(e: PointerEvent) {
            if (!e.isPrimary || e.button !== 0) return;

            // Determine effective mode: Ctrl key toggles between Pan/Select
            const isCtrl = e.ctrlKey || e.metaKey;
            const mode = this.viewOptions().interactionMode;
            const effectiveMode = isCtrl ? (mode === 'pan' ? 'select' : 'pan') : mode;

            if (effectiveMode === 'pan' && !isCtrl) {
                  this.selectId.emit(null);
                  this.selectTableIds.emit(new Set());
                  this.selectedControlPoint.set(null);
            }

            if (effectiveMode === 'pan') {
                  this.dragState.set({ type: 'pan', offset: { x: 0, y: 0 } });
                  (e.target as Element).setPointerCapture(e.pointerId);
            } else {
                  if (!isCtrl) {
                        this.selectId.emit(null);
                        this.selectTableIds.emit(new Set());
                        this.selectedControlPoint.set(null);
                  }
                  const rect = this.mainRef()!.nativeElement.getBoundingClientRect();
                  const rawX = e.clientX - rect.left;
                  const rawY = e.clientY - rect.top;

                  this.isSelecting.set(true);
                  this.selectionBox.set({
                        startX: rawX,
                        startY: rawY,
                        currentX: rawX,
                        currentY: rawY,
                  });
                  (e.target as Element).setPointerCapture(e.pointerId);
            }
      }

      handleTableDown(evt: { event: PointerEvent; id: string }) {
            const e = evt.event;
            e.stopPropagation();

            this.selectedControlPoint.set(null);

            let draggedIds = new Set<string>();

            if (e.ctrlKey || e.metaKey) {
                  const currentSet = this.selectedTableIds() || new Set();
                  draggedIds = new Set(currentSet);
                  if (draggedIds.has(evt.id)) {
                        // Already selected, keep for dragging
                  } else {
                        draggedIds.add(evt.id);
                  }
            } else {
                  if (this.selectedTableIds()?.has(evt.id)) {
                        draggedIds = new Set(this.selectedTableIds());
                  } else {
                        draggedIds = new Set([evt.id]);
                        this.selectId.emit(evt.id);
                        this.selectTableIds.emit(draggedIds);
                  }
            }

            this.selectTableIds.emit(draggedIds);
            if (draggedIds.size === 1) this.selectId.emit(evt.id);

            const t = this.tables().find((t) => t.id === evt.id);
            if (!t) return;

            const isEditMode = this.globalEditable() || t.isManuallyEditable;

            if (isEditMode) {
                  // Single click opens properties in edit mode ONLY IF NOT MOBILE
                  if (!this.isMobile()) {
                        this.openTableProperties.emit(evt.id);
                  }
            } else {
                  // Dragging only allowed in non-edit mode
                  this.dragState.set({
                        type: 'table',
                        targetId: evt.id,
                        draggedTableIds: draggedIds,
                        offset: {
                              x: e.clientX / this.zoom() - t.x,
                              y: e.clientY / this.zoom() - t.y,
                        },
                  });
                  (e.target as Element).setPointerCapture(e.pointerId);
            }
      }

      handleTableDoubleClick(id: string) {
            // Double click opens properties ONLY IF NOT MOBILE
            if (!this.isMobile()) {
                  this.openTableProperties.emit(id);
            }
      }

      handleControlPointPointerDown(
            e: PointerEvent,
            relId: string,
            index: number,
            cx: number,
            cy: number,
      ) {
            e.stopPropagation();
            e.preventDefault();

            // Clear any parent menus so global delete key doesn't delete the relationship
            this.clearMenus.emit();

            // CRITICAL FIX: Clear table selection so parent delete handler doesn't delete tables
            this.selectTableIds.emit(new Set());

            const rel = this.relationships().find((r) => r.id === relId);
            if (!rel) return;

            // Recalculate visual points as raw 'rel' doesn't have them
            const visualPoints = getRoutePoints(
                  rel,
                  this.tables(),
                  this.viewOptions().lineStyle,
                  this.viewOptions().connectionMode,
            );

            if (!visualPoints || visualPoints.length === 0) return;

            // --- RECONNECTION LOGIC (Start/End Handles) ---
            if (index === -1) {
                  this.reconnectingRelId.set(relId);

                  // Setup temp connection from TARGET back to mouse
                  let startX = visualPoints[visualPoints.length - 1].x;
                  let startY = visualPoints[visualPoints.length - 1].y;

                  this.tempConnection.set({
                        sourceTableId: rel.toTable,
                        sourceColId: rel.toCol,
                        side: rel.targetSide || 'left',
                        startX,
                        startY,
                  });
                  this.isConnecting.set(true);
                  return;
            }

            if (index === -2) {
                  this.reconnectingRelId.set(relId);

                  // Setup temp connection from SOURCE to mouse
                  let startX = visualPoints[0].x;
                  let startY = visualPoints[0].y;

                  this.tempConnection.set({
                        sourceTableId: rel.fromTable,
                        sourceColId: rel.fromCol,
                        side: rel.sourceSide || 'right',
                        startX,
                        startY,
                  });
                  this.isConnecting.set(true);
                  return;
            }

            // --- VIRTUAL POINT MATERIALIZATION ---
            let tempPoints: { x: number; y: number }[] | undefined;
            let targetIndex = index;

            if (index === -999) {
                  const currentShape = visualPoints.slice(1, -1);
                  const newIndex = currentShape.findIndex(
                        (p) => Math.abs(p.x - cx) < 2 && Math.abs(p.y - cy) < 2,
                  );

                  this.controlPointsSet.emit({ relId, points: currentShape });
                  tempPoints = JSON.parse(JSON.stringify(currentShape));
                  targetIndex = newIndex;
            } else if (!rel.controlPoints || rel.controlPoints.length === 0) {
                  // Standard manual drag but somehow array was empty? Should be covered by above but safe check
                  const currentShape = visualPoints.slice(1, -1);
                  this.controlPointsSet.emit({ relId, points: currentShape });
                  tempPoints = JSON.parse(JSON.stringify(currentShape));
            }

            // Set selected state
            this.selectedControlPoint.set({ relId, index: targetIndex });
            this.selectId.emit(relId); // NEW: Select parent relationship

            const rect = this.mainRef()!.nativeElement.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - this.pan().x) / this.zoom();
            const mouseY = (e.clientY - rect.top - this.pan().y) / this.zoom();

            this.dragState.set({
                  type: 'cp',
                  targetId: relId,
                  data: { index: targetIndex },
                  offset: { x: mouseX - cx, y: mouseY - cy },
                  tempPoints, // Carry over temp points for smooth dragging
            });
            (e.target as Element).setPointerCapture(e.pointerId);
      }

      handleSegmentPointerDown(
            e: PointerEvent,
            relId: string,
            startIndex: number,
            orientation: string,
            segX: number,
            segY: number,
      ) {
            e.stopPropagation();
            e.preventDefault();
            this.clearMenus.emit(); // Clear parent menus

            // CRITICAL FIX: Clear table selection
            this.selectTableIds.emit(new Set());
            this.selectId.emit(relId); // Explicitly select relation

            const rel = this.relationships().find((r) => r.id === relId);
            if (!rel) return;

            const rect = this.mainRef()!.nativeElement.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - this.pan().x) / this.zoom();
            const mouseY = (e.clientY - rect.top - this.pan().y) / this.zoom();

            // IF AUTO-ROUTED: Materialize points first
            let tempPoints: { x: number; y: number }[] | undefined;

            if (!rel.controlPoints || rel.controlPoints.length === 0) {
                  const points = getRoutePoints(
                        rel,
                        this.tables(),
                        'orthogonal',
                        this.viewOptions().connectionMode,
                  );

                  if (points && points.length === 2) {
                        const newCP = { x: mouseX, y: mouseY };
                        this.controlPointsSet.emit({ relId, points: [newCP] });

                        this.dragState.set({
                              type: 'cp',
                              targetId: relId,
                              data: { index: 0 },
                              offset: { x: 0, y: 0 },
                              tempPoints: [newCP],
                        });
                        (e.target as Element).setPointerCapture(e.pointerId);
                        return;
                  }

                  if (!points || points.length < 2) return;
                  const newCPs = points.slice(1, -1);
                  this.controlPointsSet.emit({ relId, points: newCPs });
                  tempPoints = JSON.parse(JSON.stringify(newCPs));
            }

            let midX = segX;
            let midY = segY;
            if (orientation === 'vertical') {
                  midX += 4;
                  midY += 8;
            } else if (orientation === 'horizontal') {
                  midX += 8;
                  midY += 4;
            } else {
                  midX += 5;
                  midY += 5;
            }

            this.dragState.set({
                  type: 'segment',
                  targetId: relId,
                  data: { startIndex, orientation },
                  offset: { x: mouseX - midX, y: mouseY - midY },
                  tempPoints, // Carry over temp points
            });
            (e.target as Element).setPointerCapture(e.pointerId);
      }

      handlePointerMove(e: PointerEvent) {
            if (!this.mainRef()) return;
            const rect = this.mainRef()!.nativeElement.getBoundingClientRect();
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;

            this.mousePos.set({
                  x: (rawX - this.pan().x) / this.zoom(),
                  y: (rawY - this.pan().y) / this.zoom(),
            });

            if (this.isSelecting() && this.selectionBox()) {
                  this.selectionBox.update((b) =>
                        b ? { ...b, currentX: rawX, currentY: rawY } : null,
                  );
                  return;
            }

            const state = this.dragState();

            if (state.type === 'pan') {
                  this.pan.update((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
                  return;
            }

            if (state.type === 'table' && state.targetId) {
                  const newX = e.clientX / this.zoom() - state.offset.x;
                  const newY = e.clientY / this.zoom() - state.offset.y;

                  const snap = this.viewOptions().snapToGrid ? 20 : 1;
                  const snappedX = Math.round(newX / snap) * snap;
                  const snappedY = Math.round(newY / snap) * snap;

                  const targetTable = this.tables().find((t) => t.id === state.targetId);
                  if (targetTable) {
                        const dx = snappedX - targetTable.x;
                        const dy = snappedY - targetTable.y;

                        this.tablePositionChange.emit({
                              id: state.targetId,
                              x: snappedX,
                              y: snappedY,
                        });

                        if (state.draggedTableIds && state.draggedTableIds.size > 1) {
                              state.draggedTableIds.forEach((id) => {
                                    if (id !== state.targetId) {
                                          const t = this.tables().find((tbl) => tbl.id === id);
                                          if (t) {
                                                this.tablePositionChange.emit({
                                                      id,
                                                      x: t.x + dx,
                                                      y: t.y + dy,
                                                });
                                          }
                                    }
                              });
                        }
                  }
                  return;
            }

            if (state.type === 'cp' && state.targetId) {
                  const mouseX = (rawX - this.pan().x) / this.zoom();
                  const mouseY = (rawY - this.pan().y) / this.zoom();

                  const cpIndex = state.data.index;

                  if (state.tempPoints) {
                        if (state.tempPoints[cpIndex]) {
                              state.tempPoints[cpIndex] = {
                                    x: mouseX - state.offset.x,
                                    y: mouseY - state.offset.y,
                              };
                              this.controlPointsSet.emit({
                                    relId: state.targetId,
                                    points: state.tempPoints,
                              });
                        }
                  } else {
                        this.controlPointChange.emit({
                              relId: state.targetId,
                              index: cpIndex,
                              x: mouseX - state.offset.x,
                              y: mouseY - state.offset.y,
                        });
                  }
            }

            if (state.type === 'segment' && state.targetId) {
                  const mouseX = (rawX - this.pan().x) / this.zoom();
                  const mouseY = (rawY - this.pan().y) / this.zoom();
                  const rel = this.relationships().find((r) => r.id === state.targetId);

                  // If we have tempPoints, we use them as the source of truth for the drag session
                  // otherwise we fall back to rel.controlPoints if it exists.
                  const activePoints = state.tempPoints || rel?.controlPoints;
                  if (!activePoints) return;

                  const idx1 = state.data.startIndex - 1;
                  const idx2 = state.data.startIndex;
                  const orientation = state.data.orientation;

                  const updateX = orientation === 'vertical' || orientation === 'diagonal';
                  const updateY = orientation === 'horizontal' || orientation === 'diagonal';

                  if (state.tempPoints) {
                        // Update local temp points and emit full set
                        if (idx1 >= 0 && state.tempPoints[idx1]) {
                              if (updateX) state.tempPoints[idx1].x = mouseX - state.offset.x;
                              if (updateY) state.tempPoints[idx1].y = mouseY - state.offset.y;
                        }
                        if (idx2 < state.tempPoints.length && state.tempPoints[idx2]) {
                              if (updateX) state.tempPoints[idx2].x = mouseX - state.offset.x;
                              if (updateY) state.tempPoints[idx2].y = mouseY - state.offset.y;
                        }
                        this.controlPointsSet.emit({
                              relId: state.targetId,
                              points: state.tempPoints,
                        });
                  } else if (rel) {
                        // Standard update
                        if (idx1 >= 0) {
                              if (rel.controlPoints && rel.controlPoints[idx1]) {
                                    this.controlPointChange.emit({
                                          relId: rel.id,
                                          index: idx1,
                                          x: updateX
                                                ? mouseX - state.offset.x
                                                : rel.controlPoints[idx1].x,
                                          y: updateY
                                                ? mouseY - state.offset.y
                                                : rel.controlPoints[idx1].y,
                                    });
                              }
                        }
                        if (idx2 < (rel.controlPoints?.length || 0)) {
                              if (rel.controlPoints && rel.controlPoints[idx2]) {
                                    this.controlPointChange.emit({
                                          relId: rel.id,
                                          index: idx2,
                                          x: updateX
                                                ? mouseX - state.offset.x
                                                : rel.controlPoints[idx2].x,
                                          y: updateY
                                                ? mouseY - state.offset.y
                                                : rel.controlPoints[idx2].y,
                                    });
                              }
                        }
                  }
            }
      }

      handlePointerUp(e: PointerEvent) {
            if (this.isSelecting() && this.selectionBox()) {
                  const box = this.selectionBox()!;
                  const x1 = Math.min(box.startX, box.currentX);
                  const y1 = Math.min(box.startY, box.currentY);
                  const x2 = Math.max(box.startX, box.currentX);
                  const y2 = Math.max(box.startY, box.currentY);

                  if (Math.abs(x2 - x1) > 2 && Math.abs(y2 - y1) > 2) {
                        const z = this.zoom();
                        const p = this.pan();
                        const worldX1 = (x1 - p.x) / z;
                        const worldY1 = (y1 - p.y) / z;
                        const worldX2 = (x2 - p.x) / z;
                        const worldY2 = (y2 - p.y) / z;

                        const selectedIds = new Set<string>();
                        if (e.ctrlKey || e.metaKey) {
                              this.selectedTableIds()?.forEach((id) => selectedIds.add(id));
                        }

                        this.tables().forEach((t) => {
                              const tH = getTableHeight(t);
                              if (
                                    t.x < worldX2 &&
                                    t.x + TABLE_WIDTH > worldX1 &&
                                    t.y < worldY2 &&
                                    t.y + tH > worldY1
                              ) {
                                    selectedIds.add(t.id);
                              }
                        });

                        this.selectTableIds.emit(selectedIds);
                        if (selectedIds.size > 0) {
                              const last = Array.from(selectedIds).pop();
                              if (last) this.selectId.emit(last);
                        }
                  }
                  this.isSelecting.set(false);
                  this.selectionBox.set(null);
            }

            this.dragState.set({ type: null, offset: { x: 0, y: 0 } });
            if (e.target instanceof Element && e.target.hasPointerCapture(e.pointerId)) {
                  e.target.releasePointerCapture(e.pointerId);
            }

            if (this.isConnecting()) {
                  this.isConnecting.set(false);
                  this.tempConnection.set(null);
                  this.reconnectingRelId.set(null);
            }
      }

      handleContextMenu(e: MouseEvent) {
            if (e.ctrlKey) return;
            e.preventDefault();
      }

      handleRelClick(e: MouseEvent, id: string) {
            e.stopPropagation();
            this.selectId.emit(id);
            this.selectTableIds.emit(new Set()); // CRITICAL: Clear table selection
            this.relationshipClick.emit({ id, x: e.clientX, y: e.clientY });
            this.selectedControlPoint.set(null);
      }

      handleRelContextMenu(e: MouseEvent, id: string) {
            e.preventDefault();
            e.stopPropagation();
            this.selectId.emit(id);
            this.selectTableIds.emit(new Set()); // CRITICAL: Clear table selection
            this.relationshipClick.emit({ id, x: e.clientX, y: e.clientY });
      }

      handleRelDoubleClick(e: MouseEvent, id: string) {
            e.stopPropagation();
            const rect = this.mainRef()!.nativeElement.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.pan().x) / this.zoom();
            const y = (e.clientY - rect.top - this.pan().y) / this.zoom();

            const rel = this.relationships().find((r) => r.id === id);
            if (!rel) return;

            const points = getRoutePoints(
                  rel,
                  this.tables(),
                  this.viewOptions().lineStyle,
                  this.viewOptions().connectionMode,
            );

            // FIX: If auto-routed (no controlPoints), materialize existing shape first
            if (!rel.controlPoints || rel.controlPoints.length === 0) {
                  if (!points || points.length < 2) return;
                  const currentShape = points.slice(1, -1);
                  this.controlPointsSet.emit({ relId: id, points: currentShape });

                  const insertIdx = getInsertIndex(points, { x, y });
                  const cpIndex = Math.max(0, insertIdx - 1);

                  currentShape.splice(cpIndex, 0, { x, y });
                  this.controlPointsSet.emit({ relId: id, points: currentShape });
            } else {
                  const insertIdx = getInsertIndex(points, { x, y }) - 1;
                  this.addControlPoint.emit({ relId: id, x, y, index: Math.max(0, insertIdx) });
            }
      }

      handleStartConnection(data: {
            event: PointerEvent;
            tableId: string;
            colId: string;
            side: 'left' | 'right' | 'top' | 'bottom';
      }) {
            this.isConnecting.set(true);
            const t = this.tables().find((t) => t.id === data.tableId);
            if (!t) return;

            let startX = 0,
                  startY = 0;

            if (this.viewOptions().connectionMode === 'table') {
                  const w = TABLE_WIDTH;
                  const h = getTableHeight(t);
                  if (data.side === 'left') {
                        startX = t.x;
                        startY = t.y + h / 2;
                  } else if (data.side === 'right') {
                        startX = t.x + w;
                        startY = t.y + h / 2;
                  } else if (data.side === 'top') {
                        startX = t.x + w / 2;
                        startY = t.y;
                  } else if (data.side === 'bottom') {
                        startX = t.x + w / 2;
                        startY = t.y + h;
                  }
            } else {
                  startX = t.x + (data.side === 'right' ? TABLE_WIDTH : 0);
                  startY = t.y + 40;
            }

            this.tempConnection.set({
                  sourceTableId: data.tableId,
                  sourceColId: data.colId,
                  side: data.side,
                  startX,
                  startY,
            });
      }

      handleCompleteConnection(evt: { event: PointerEvent; tableId: string; colId: string }) {
            const temp = this.tempConnection();
            const reconnectId = this.reconnectingRelId();

            if (temp && this.isConnecting()) {
                  if (reconnectId) {
                        const rel = this.relationships().find((r) => r.id === reconnectId);
                        if (rel) {
                              const isStartDrag = temp.sourceTableId === rel.toTable;
                              if (isStartDrag) {
                                    this.reconnectRelationship.emit({
                                          relId: reconnectId,
                                          sourceTId: evt.tableId,
                                          sourceCId: evt.colId,
                                          targetTId: rel.toTable,
                                          targetCId: rel.toCol,
                                    });
                              } else {
                                    this.reconnectRelationship.emit({
                                          relId: reconnectId,
                                          sourceTId: rel.fromTable,
                                          sourceCId: rel.fromCol,
                                          targetTId: evt.tableId,
                                          targetCId: evt.colId,
                                    });
                              }
                        }
                  } else {
                        this.applyConnection.emit({
                              sourceTId: temp.sourceTableId,
                              sourceCId: temp.sourceColId,
                              targetTId: evt.tableId,
                              targetCId: evt.colId,
                        });
                  }

                  this.isConnecting.set(false);
                  this.tempConnection.set(null);
                  this.reconnectingRelId.set(null);
            }
      }

      handleCompleteNewColConnection(evt: { event: PointerEvent; tableId: string }) {
            const temp = this.tempConnection();
            if (temp && this.isConnecting() && !this.reconnectingRelId()) {
                  this.createFkConnection.emit({
                        sourceTableId: temp.sourceTableId,
                        sourceColId: temp.sourceColId,
                        targetTableId: evt.tableId,
                  });
                  this.isConnecting.set(false);
                  this.tempConnection.set(null);
            }
      }

      setPan(p: { x: number; y: number }) {
            this.pan.set(p);
      }

      updateZoom(delta: number) {
            this.zoom.update((z) => Math.min(2, Math.max(0.1, z + delta)));
      }

      resetView() {
            this.zoom.set(1);
            this.pan.set({ x: 0, y: 0 });
      }
}
