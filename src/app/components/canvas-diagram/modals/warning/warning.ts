import { Component, input, output, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarningData } from '../../types/warning-data';

@Component({
      selector: 'modal-warning',
      imports: [CommonModule, FormsModule],
      templateUrl: './warning.html',
})
export class WarningModalComponent {
      data = input.required<WarningData>();
      cancel = output<void>();
      confirmIntegrity = output<void>();
      resolveCollision = output<{ action: 'create_new' | 'use_existing'; targetCId?: string }>();

      isCollision = computed(() => this.data().type === 'collision');
      candidates = computed(() => this.data().data.candidateColumns || []);

      selectedTargetColId = signal('');

      constructor() {
            effect(() => {
                  // Initialize selection
                  const candidates = this.candidates();
                  let initial = this.data().data.targetCId;

                  // If initial collision column is not in candidates (due to type filtering), try first candidate
                  if (initial && !candidates.some((c) => c.id === initial)) {
                        initial = candidates.length > 0 ? candidates[0].id : '';
                  }

                  // If still no initial but we have candidates, pick first
                  if (!initial && candidates.length > 0) {
                        initial = candidates[0].id;
                  }

                  this.selectedTargetColId.set(initial || '');
            });
      }

      emitResolve(action: 'create_new' | 'use_existing') {
            this.resolveCollision.emit({
                  action,
                  targetCId: action === 'use_existing' ? this.selectedTargetColId() : undefined,
            });
      }
}
