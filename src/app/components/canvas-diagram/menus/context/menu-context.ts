import { Component, input, output, computed, ElementRef, viewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewOptions } from '../../types/view-options';
import { DbEngine, DB_ENGINES } from '../../utils/dbDataTypes';

@Component({
      selector: 'menu-context',
      imports: [CommonModule],
      templateUrl: 'menu-context.html',
})
export class MenuContext {
      x = input.required<number>();
      y = input.required<number>();
      viewOptions = input.required<ViewOptions>();
      viewMode = input.required<string>();
      dbEngine = input.required<DbEngine>();

      updateViewOption = output<{ key: keyof ViewOptions; value: any }>();
      updateViewMode = output<string>();
      updateDbEngine = output<DbEngine>();
      close = output<void>();

      dbEngines = DB_ENGINES;
      menuRef = viewChild<ElementRef>('menuRef');

      // Computed position logic
      pos = computed(() => {
            const x = this.x();
            const y = this.y();
            const w = window.innerWidth;
            const h = window.innerHeight;
            const menuW = 224; // w-56
            const menuH = 380; // Adjusted for extra items

            const invertX = x + menuW > w;
            const invertY = y + menuH > h;

            return {
                  x: invertX ? undefined : x,
                  y: invertY ? undefined : y,
                  right: invertX ? w - x : undefined,
                  bottom: invertY ? h - y : undefined,
                  invertX,
                  invertY,
            };
      });

      invertX = computed(() => this.pos().invertX);
      transformOrigin = computed(() => {
            const p = this.pos();
            return `${p.invertY ? 'bottom' : 'top'} ${p.invertX ? 'right' : 'left'}`;
      });

      constructor() {
            effect(() => {
                  const handleClick = (e: MouseEvent) => {
                        if (this.menuRef() && !this.menuRef()?.nativeElement.contains(e.target)) {
                              this.close.emit();
                        }
                  };
                  document.addEventListener('pointerdown', handleClick);
                  return () => document.removeEventListener('pointerdown', handleClick);
            });
      }
}
