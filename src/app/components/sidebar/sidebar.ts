import { Component, input, output, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewOptions } from '../canvas-diagram/types/view-options';
import { DbEngine } from '../canvas-diagram/utils/dbDataTypes';

@Component({
      selector: 'sidebar',
      imports: [CommonModule, FormsModule],
      templateUrl: './sidebar.html',
})
export class Sidebar implements OnDestroy {
      isOpen = input<boolean>(false);
      globalEditable = input<boolean>(false);
      selectedId = input<string | null>(null);
      viewOptions = input.required<ViewOptions>();
      dbEngine = input.required<DbEngine>();

      viewOptionsChange = output<ViewOptions>();
      globalEditableChange = output<boolean>();
      addTable = output<void>();
      deleteTable = output<void>();

      // Use signal for reactive resize handling
      isMobile = signal(window.innerWidth < 768);

      private resizeListener = () => {
            this.isMobile.set(window.innerWidth < 768);
      };

      constructor() {
            window.addEventListener('resize', this.resizeListener);
      }

      ngOnDestroy() {
            window.removeEventListener('resize', this.resizeListener);
      }

      // Filter keys for display
      viewOptionKeys = computed(() => {
            const opts = this.viewOptions();
            const engine = this.dbEngine();

            return Object.entries(opts)
                  .filter(
                        ([key]) =>
                              ![
                                    'lineStyle',
                                    'gridStyle',
                                    'connectionMode',
                                    'snapToGrid',
                                    'interactionMode',
                              ].includes(key),
                  )
                  .map(([key, value]) => {
                        let label = key
                              .replace(/^show/, '')
                              .replace(/([A-Z])/g, ' $1')
                              .trim();

                        // Rename 'Identity' to 'Auto Increment' for MySQL/MariaDB
                        if (
                              key === 'showIdentity' &&
                              (engine === 'mysql' || engine === 'mariadb')
                        ) {
                              label = 'Auto Increment';
                        }

                        return {
                              key: key as keyof ViewOptions,
                              value: value as boolean,
                              label: label,
                        };
                  });
      });

      toggleGlobalEditable() {
            this.globalEditableChange.emit(!this.globalEditable());
      }

      handleDelete() {
            if (this.selectedId()) {
                  this.deleteTable.emit();
            }
      }

      updateOption(key: keyof ViewOptions, value: boolean) {
            this.viewOptionsChange.emit({
                  ...this.viewOptions(),
                  [key]: value,
            });
      }
}
