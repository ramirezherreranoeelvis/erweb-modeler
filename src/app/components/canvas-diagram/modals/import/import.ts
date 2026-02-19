import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { parseSQL } from '../../utils/sqlParser';
import { Table } from '../../types/table';
import { Relationship } from '../../types/relationship';
import { DbEngine } from '../../utils/dbDataTypes';

@Component({
      selector: 'modal-import',
      imports: [CommonModule, FormsModule],
      templateUrl: './import.html',
})
export class ImportModalComponent {
      dbEngine = input.required<DbEngine>();
      close = output<void>();
      importData = output<{ tables: Table[]; relationships: Relationship[] }>();

      activeTab = signal<'paste' | 'file'>('paste');
      sqlContent = signal('');
      error = signal<string | null>(null);
      fileName = signal<string | null>(null);

      engineName = computed(() => {
            const e = this.dbEngine();
            if (e === 'postgres') return 'PostgreSQL';
            if (e === 'mssql') return 'SQL Server';
            return 'MySQL';
      });

      handleProcess() {
            try {
                  if (!this.sqlContent().trim()) {
                        this.error.set('No SQL content to process.');
                        return;
                  }

                  const { tables, relationships } = parseSQL(this.sqlContent());

                  if (tables.length === 0) {
                        this.error.set(
                              "No tables found. Ensure your SQL contains standard 'CREATE TABLE' statements.",
                        );
                        return;
                  }

                  this.importData.emit({ tables, relationships });
            } catch (e) {
                  console.error(e);
                  this.error.set('Failed to parse SQL. Please ensure it is valid syntax.');
            }
      }

      handleFileUpload(e: Event) {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            if (file) {
                  this.fileName.set(file.name);
                  const reader = new FileReader();
                  reader.onload = (event) => {
                        if (event.target?.result) {
                              this.sqlContent.set(event.target.result as string);
                              this.error.set(null);
                        }
                  };
                  reader.readAsText(file);
            }
      }
}
