import { Component, input, output, computed, signal, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Table } from '../../types/table';
import { Relationship } from '../../types/relationship';
import { ViewOptions } from '../../types/view-options';
import { calculatePath, TABLE_WIDTH, getTableHeight } from '../../utils/geometry';

const MINIMAP_WIDTH = 240;
const MINIMAP_HEIGHT = 160;
const PADDING = 50;

@Component({
      selector: 'minimap',
      imports: [CommonModule],
      templateUrl: './minimap.html',
})
export class Minimap {
      tables = input.required<Table[]>();
      relationships = input.required<Relationship[]>();
      viewOptions = input.required<ViewOptions>();
      zoom = input.required<number>();
      pan = input.required<{ x: number; y: number }>();
      containerWidth = input.required<number>();
      containerHeight = input.required<number>();
      theme = input.required<'light' | 'dark'>();

      panChange = output<{ x: number; y: number }>();

      width = MINIMAP_WIDTH;
      height = MINIMAP_HEIGHT;
      isDragging = false;

      readonly minimapContainer = viewChild<ElementRef<HTMLElement>>('minimapContainer');

      // 1. Calculate World Bounds
      bounds = computed(() => {
            const ts = this.tables();
            if (ts.length === 0) return { minX: 0, minY: 0, width: 1000, height: 1000 };

            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            ts.forEach((t) => {
                  if (t.x < minX) minX = t.x;
                  if (t.y < minY) minY = t.y;

                  const h = getTableHeight(t);
                  if (t.x + TABLE_WIDTH > maxX) maxX = t.x + TABLE_WIDTH;
                  if (t.y + h > maxY) maxY = t.y + h;
            });

            minX -= PADDING;
            minY -= PADDING;
            maxX += PADDING;
            maxY += PADDING;

            return { minX, minY, width: maxX - minX, height: maxY - minY };
      });

      // 2. Calculate Scale
      scale = computed(() => {
            const b = this.bounds();
            const scaleX = MINIMAP_WIDTH / b.width;
            const scaleY = MINIMAP_HEIGHT / b.height;
            return Math.min(scaleX, scaleY);
      });

      // 3. Transform String for SVG
      transformStr = computed(() => {
            const s = this.scale();
            const b = this.bounds();
            return `scale(${s}) translate(${-b.minX}, ${-b.minY})`;
      });

      // 4. Color Computed
      strokeColor = computed(() => (this.theme() === 'dark' ? '#94a3b8' : '#475569'));

      // 5. Table Rects mapped to minimap space
      tableRects = computed(() => {
            const s = this.scale();
            const b = this.bounds();

            return this.tables().map((t) => ({
                  id: t.id,
                  x: (t.x - b.minX) * s,
                  y: (t.y - b.minY) * s,
                  w: TABLE_WIDTH * s,
                  h: getTableHeight(t) * s,
            }));
      });

      // 6. Viewport Rect
      viewport = computed(() => {
            const s = this.scale();
            const b = this.bounds();
            const z = this.zoom();
            const p = this.pan();

            return {
                  x: (-p.x / z - b.minX) * s,
                  y: (-p.y / z - b.minY) * s,
                  w: (this.containerWidth() / z) * s,
                  h: (this.containerHeight() / z) * s,
            };
      });

      // 7. Relationship Paths
      relPaths = computed(() => {
            const ts = this.tables();
            const mode = this.viewOptions().connectionMode;
            const style = this.viewOptions().lineStyle;

            return this.relationships().map((rel) => ({
                  id: rel.id,
                  d: calculatePath(rel, ts, style, mode),
            }));
      });

      // --- Handlers ---

      handlePointerDown(e: PointerEvent) {
            e.stopPropagation();
            e.preventDefault();
            this.isDragging = true;
            (e.target as Element).setPointerCapture(e.pointerId);
            this.updatePosition(e.clientX, e.clientY);
      }

      handlePointerMove(e: PointerEvent) {
            if (this.isDragging) {
                  e.stopPropagation();
                  e.preventDefault();
                  this.updatePosition(e.clientX, e.clientY);
            }
      }

      handlePointerUp(e: PointerEvent) {
            this.isDragging = false;
            (e.target as Element).releasePointerCapture(e.pointerId);
      }

      updatePosition(clientX: number, clientY: number) {
            const container = this.minimapContainer();
            if (!container?.nativeElement) return;
            const rect = container.nativeElement.getBoundingClientRect();

            const mapX = clientX - rect.left;
            const mapY = clientY - rect.top;

            const s = this.scale();
            const b = this.bounds();

            const worldX = mapX / s + b.minX;
            const worldY = mapY / s + b.minY;

            const z = this.zoom();
            const viewWorldWidth = this.containerWidth() / z;
            const viewWorldHeight = this.containerHeight() / z;

            const targetViewX = worldX - viewWorldWidth / 2;
            const targetViewY = worldY - viewWorldHeight / 2;

            this.panChange.emit({
                  x: -targetViewX * z,
                  y: -targetViewY * z,
            });
      }
}
