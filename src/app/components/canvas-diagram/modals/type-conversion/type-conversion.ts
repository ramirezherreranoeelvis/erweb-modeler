import { Component, input, output, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConversionChange } from '../../types/conversion-change';

@Component({
      selector: 'modal-type-conversion',
      imports: [CommonModule, FormsModule],
      templateUrl: './type-conversion.html',
      styles: [
            `
                  .custom-scrollbar::-webkit-scrollbar {
                        width: 4px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #334155;
                        border-radius: 4px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #475569;
                  }
            `,
      ],
})
export class TypeConversionModalComponent {
      targetEngine = input.required<string>();
      changes = input.required<ConversionChange[]>();

      autoConvert = output<ConversionChange[]>();
      keepAsIs = output<void>(); // Continues with engine switch but NO type changes
      cancel = output<void>(); // Aborts engine switch completely

      selectedIndices = signal<Set<number>>(new Set());

      constructor() {
            effect(() => {
                  const len = this.changes().length;
                  if (len > 0) {
                        // By default, select all
                        this.selectedIndices.set(new Set(Array.from({ length: len }, (_, i) => i)));
                  }
            });
      }

      showCheckboxes = computed(() => this.changes().length > 1);

      targetEngineName = computed(() => {
            const e = this.targetEngine();
            if (e === 'postgres') return 'PostgreSQL';
            if (e === 'mssql') return 'SQL Server';
            if (e === 'mysql') return 'MySQL';
            return e;
      });

      areAllSelected = computed(() => this.selectedIndices().size === this.changes().length);
      isIndeterminate = computed(() => {
            const size = this.selectedIndices().size;
            return size > 0 && size < this.changes().length;
      });

      isSelected(index: number) {
            return this.selectedIndices().has(index);
      }

      toggleOne(index: number) {
            this.selectedIndices.update((set) => {
                  const newSet = new Set(set);
                  if (newSet.has(index)) {
                        newSet.delete(index);
                  } else {
                        newSet.add(index);
                  }
                  return newSet;
            });
      }

      toggleAll() {
            if (this.areAllSelected()) {
                  this.selectedIndices.set(new Set());
            } else {
                  this.selectedIndices.set(
                        new Set(Array.from({ length: this.changes().length }, (_, i) => i)),
                  );
            }
      }

      // Handle dropdown changes
      updateSelection(index: number, newType: string) {
            const currentChanges = this.changes();
            const item = currentChanges[index];

            // Find the option to get the correct length if associated
            const option = item.typeOptions?.find((o) => o.type === newType);

            // Update the item in the array (Angular signals need immutable update pattern usually,
            // but since 'changes' is input, we are mutating local reference to emit back.
            // Ideally we should clone, but for this modal flow it works to prep the emit object).
            item.newType = newType;
            if (option) {
                  item.newLength = option.length;
            }
      }

      handleAutoConvert() {
            const selectedChanges = this.changes().filter((_, i) => this.selectedIndices().has(i));
            this.autoConvert.emit(selectedChanges);
      }
}
