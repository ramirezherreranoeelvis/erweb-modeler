import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Table } from '../../types/table';
import { ViewOptions } from '../../types/view-options';
import { TempConnection } from '../../types/temp-connection';
import { DbEngine } from '../../utils/dbDataTypes';
import { TABLE_WIDTH } from '../../utils/geometry';
import { TableHeader } from './table-header';
import { TableRow } from './table-row';

@Component({
      selector: 'table-node',
      imports: [CommonModule, TableHeader, TableRow],
      templateUrl: './table-node.html',
})
export class TableNode {
      table = input.required<Table>();
      tables = input.required<Table[]>();
      isSelected = input<boolean>(false);
      viewMode = input.required<string>();
      viewOptions = input.required<ViewOptions>();
      isConnecting = input<boolean>(false);
      tempConnection = input<TempConnection | null>(null);
      zoom = input.required<number>();
      dbEngine = input.required<DbEngine>();
      globalEditable = input<boolean>(false);

      onPointerDown = output<{ event: PointerEvent; id: string }>();
      startConnection = output<{
            event: PointerEvent;
            tableId: string;
            colId: string;
            side: 'left' | 'right' | 'top' | 'bottom';
      }>();
      completeConnection = output<{ event: PointerEvent; tableId: string; colId: string }>();
      completeNewColConnection = output<{ event: PointerEvent; tableId: string }>();
      addColumn = output<string>();
      updateTable = output<{ id: string; field: string; value: any }>();
      updateColumn = output<{ tableId: string; colId: string; field: string; value: any }>();
      moveColumn = output<{ tableId: string; fromIndex: number; toIndex: number }>();
      deleteColumn = output<{ tableId: string; colId: string }>();
      config = output<void>();
      tableDoubleClick = output<string>();

      TABLE_WIDTH = TABLE_WIDTH;
      isExpanded = signal(false);
      draggedIndex = signal<number | null>(null);

      isLocked = computed(
            () => this.globalEditable() || (this.table().isManuallyEditable ?? false),
      );
      width = computed(() => (this.isExpanded() ? 'auto' : TABLE_WIDTH));

      // Show table connectors if mode is 'table' (or undefined default) and not a virtual N:M table
      showTableConnectors = computed(() => {
            const mode = this.viewOptions().connectionMode;
            return (mode === 'table' || !mode) && !this.table().id.startsWith('virt_');
      });

      showNewColDropZone = computed(() => {
            const isColumnMode = this.viewOptions().connectionMode === 'column';
            const temp = this.tempConnection();
            return (
                  this.isConnecting() &&
                  temp &&
                  temp.sourceTableId !== this.table().id &&
                  isColumnMode
            );
      });

      handlePointerDown(event: PointerEvent) {
            event.stopPropagation();
            this.onPointerDown.emit({ event, id: this.table().id });
      }

      toggleExpand() {
            this.isExpanded.update((v) => !v);
      }

      handleContextMenu(e: MouseEvent) {
            if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
            }
      }

      handleUpdateTable(event: { field: string; value: any }) {
            this.updateTable.emit({ id: this.table().id, field: event.field, value: event.value });
      }

      handleUpdateColumn(colId: string, event: { field: string; value: any }) {
            this.updateColumn.emit({
                  tableId: this.table().id,
                  colId,
                  field: event.field,
                  value: event.value,
            });
      }

      handleDragStart(e: DragEvent, index: number) {
            e.stopPropagation();
            this.draggedIndex.set(index);
            if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move';
            }
      }

      handleDrop(e: DragEvent, index: number) {
            e.stopPropagation();
            const fromIndex = this.draggedIndex();
            if (this.isLocked() && fromIndex !== null && fromIndex !== index) {
                  this.moveColumn.emit({ tableId: this.table().id, fromIndex, toIndex: index });
            }
            this.draggedIndex.set(null);
      }

      handleRowConnectionStart(
            event: { side: 'left' | 'right'; event: PointerEvent },
            colId: string,
      ) {
            this.startConnection.emit({
                  event: event.event,
                  tableId: this.table().id,
                  colId,
                  side: event.side,
            });
      }

      handleRowConnectionComplete(event: PointerEvent, colId: string) {
            this.completeConnection.emit({ event, tableId: this.table().id, colId });
      }

      // Handle table-level connector click (Auto-pick PK as source)
      handleTableConnectionStart(event: PointerEvent, side: 'left' | 'right' | 'top' | 'bottom') {
            event.stopPropagation();
            const pkCol = this.table().columns.find((c) => c.isPk);
            if (pkCol) {
                  this.startConnection.emit({
                        event,
                        tableId: this.table().id,
                        colId: pkCol.id,
                        side,
                  });
            }
      }

      handleTableConnectionDrop(event: PointerEvent) {
            // If connecting in table mode, dragging onto a table body completes connection
            // We allow dragging onto the same table for self-reference
            if (this.isConnecting()) {
                  if (this.viewOptions().connectionMode === 'table') {
                        this.completeNewColConnection.emit({ event, tableId: this.table().id });
                  }
            }
      }
}
