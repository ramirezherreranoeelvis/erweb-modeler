import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbEngine, DB_ENGINES } from '../canvas-diagram/utils/dbDataTypes';

@Component({
      selector: 'toolbar',
      imports: [CommonModule, FormsModule],
      templateUrl: './toolbar.html',
})
export class Toolbar {
      viewMode = input.required<string>();
      dbEngine = input.required<DbEngine>();

      viewModeChange = output<string>();
      dbEngineChange = output<DbEngine>();
      toggleSidebar = output<void>();
      onExport = output<boolean>();
      onImportClick = output<void>();
      onReset = output<void>();

      engines = DB_ENGINES;
      showExportMenu = signal(false);
      includeLayout = signal(true);

      setViewMode(mode: string) {
            this.viewModeChange.emit(mode);
      }

      toggleExportMenu() {
            this.showExportMenu.update((v) => !v);
      }

      handleExport() {
            this.onExport.emit(this.includeLayout());
            this.showExportMenu.set(false);
      }

      handleEngineChange(event: Event) {
            const select = event.target as HTMLSelectElement;
            const newValue = select.value as DbEngine;

            // Emit the change request
            this.dbEngineChange.emit(newValue);

            // Immediately revert the select to the current bound value.
            // If the change is accepted by the parent, the input signal `dbEngine` will update,
            // causing Angular to update [value] and the select to reflect the new value.
            // If rejected (or waiting for modal), it visually snaps back to the previous valid state.
            select.value = this.dbEngine();
      }
}
