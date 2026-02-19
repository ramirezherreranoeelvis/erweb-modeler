import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Relationship } from '../../types/relationship';

type LeftOption = '1' | '0..1' | 'N';
type RightOption = '1' | '0..1' | '1..N' | '0..N' | 'N';

@Component({
      selector: 'menu-relationship',
      imports: [CommonModule, FormsModule],
      templateUrl: './relationship.html',
})
export class MenuRelationship {
      x = input.required<number>();
      y = input.required<number>();
      currentName = input.required<string>();
      currentType = input.required<Relationship['type']>();
      targetColNullable = input.required<boolean>();

      updateName = output<string>();
      updateCardinality = output<{ type: Relationship['type']; isNullable: boolean }>();
      resetRouting = output<void>();
      setRouting = output<{
            source: 'left' | 'right' | 'top' | 'bottom';
            target: 'left' | 'right' | 'top' | 'bottom';
      }>();
      deleteRel = output<void>();

      leftSide = signal<LeftOption>('1');
      rightSide = signal<RightOption>('1..N');

      constructor() {
            effect(() => {
                  const type = this.currentType();
                  const nullable = this.targetColNullable();

                  if (type === 'N:M') {
                        this.leftSide.set('N');
                        this.rightSide.set('N');
                  } else {
                        this.leftSide.set(nullable ? '0..1' : '1');
                        switch (type) {
                              case '1:1':
                                    this.rightSide.set('1');
                                    break;
                              case '1:0..1':
                                    this.rightSide.set('0..1');
                                    break;
                              case '1:N':
                                    this.rightSide.set('1..N');
                                    break;
                              case '1:0..N':
                                    this.rightSide.set('0..N');
                                    break;
                        }
                  }
            });
      }

      handleUpdate(newLeft: LeftOption, newRight: RightOption) {
            this.leftSide.set(newLeft);
            this.rightSide.set(newRight);

            if (newLeft === 'N' || newRight === 'N') {
                  if (newLeft === 'N') {
                        this.rightSide.set('N');
                        this.updateCardinality.emit({ type: 'N:M', isNullable: false });
                        return;
                  }
                  if (newRight === 'N') {
                        this.leftSide.set('N');
                        this.updateCardinality.emit({ type: 'N:M', isNullable: false });
                        return;
                  }
            }

            const isNullable = newLeft === '0..1';
            let type: Relationship['type'] = '1:N';

            switch (newRight) {
                  case '1':
                        type = '1:1';
                        break;
                  case '0..1':
                        type = '1:0..1';
                        break;
                  case '1..N':
                        type = '1:N';
                        break;
                  case '0..N':
                        type = '1:0..N';
                        break;
            }

            this.updateCardinality.emit({ type, isNullable });
      }
}
