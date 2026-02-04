import { generateId } from './geometry';
import type { Table, Column, Relationship } from '../ui/types';
import type { DbEngine } from './dbDataTypes';

// Helper to remove comments, BUT PRESERVE ERWEB_LAYOUT specific lines
const cleanSQL = (sql: string) => {
  return (
    sql
      // Remove multiline comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove single line comments EXCEPT those starting with ERWEB_LAYOUT, x:, or y:
      .replace(/--(?!.*(ERWEB_LAYOUT|x:|y:)).*$/gm, '')
      .trim()
  );
};

// Helper to remove brackets [ ] (MSSQL) or backticks ` ` (MySQL) or quotes " "
const cleanIdentifier = (str: string) => {
  return str.replace(/[\[\]`"]/g, '');
};

const splitColumns = (content: string) => {
  const lines = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      lines.push(content.substring(start, i).trim());
      start = i + 1;
    }
  }
  lines.push(content.substring(start).trim());
  return lines.filter((l) => l.length > 0);
};

export const parseSQL = (sqlInput: string): { tables: Table[]; relationships: Relationship[] } => {
  // 1. Clean SQL but keep our metadata comments
  let cleanSql = cleanSQL(sqlInput);

  // Normalize MSSQL 'GO' to semicolons
  cleanSql = cleanSql.replace(/\bGO\b/gi, ';');

  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const tables: Table[] = [];
  const relationships: Relationship[] = [];

  // Default Layout Logic
  let currentX = 100;
  let currentY = 100;
  const X_OFFSET = 350;
  const Y_OFFSET = 300;
  let colCount = 0;

  statements.forEach((stmt) => {
    // Check for Layout Metadata in this chunk (Multi-line friendly format)
    // Format looks like:
    // -- ERWEB_LAYOUT
    // -- x: 100
    // -- y: 200
    // CREATE TABLE ...

    let layoutX: number | null = null;
    let layoutY: number | null = null;

    // Check for "x:" pattern
    const xMatch = stmt.match(/--\s*x:\s*(-?\d+)/);
    if (xMatch) {
      layoutX = parseInt(xMatch[1], 10);
    }

    // Check for "y:" pattern
    const yMatch = stmt.match(/--\s*y:\s*(-?\d+)/);
    if (yMatch) {
      layoutY = parseInt(yMatch[1], 10);
    }

    // Also support old JSON format fallback for backward compatibility
    if (layoutX === null || layoutY === null) {
      const jsonMatch = stmt.match(/--\s*ERWEB_LAYOUT:\s*(\{.*\})/);
      if (jsonMatch) {
        try {
          const json = JSON.parse(jsonMatch[1]);
          if (typeof json.x === 'number') layoutX = json.x;
          if (typeof json.y === 'number') layoutY = json.y;
        } catch (e) {
          // ignore
        }
      }
    }

    // CREATE TABLE Parsing
    const createTableMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/i);

    if (createTableMatch) {
      let rawTableName = createTableMatch[1];
      if (rawTableName.includes('.')) {
        rawTableName = rawTableName.split('.').pop() || rawTableName;
      }
      const tableName = cleanIdentifier(rawTableName);
      const tableId = generateId();

      const firstParen = stmt.indexOf('(');
      const lastParen = stmt.lastIndexOf(')');

      if (firstParen > -1 && lastParen > -1) {
        const body = stmt.substring(firstParen + 1, lastParen);
        const lines = splitColumns(body);

        const columns: Column[] = [];
        const pkColumns: string[] = [];

        lines.forEach((line) => {
          // Check for Inline Primary Key Constraint
          const pkConstraintMatch = line.match(
            /CONSTRAINT\s+([^\s]+)\s+PRIMARY\s+KEY(?:\s+(?:CLUSTERED|NONCLUSTERED))?\s*\(([^)]+)\)/i,
          );
          if (pkConstraintMatch) {
            const cols = pkConstraintMatch[2]
              .split(',')
              .map((c) => cleanIdentifier(c.trim().split(/\s+/)[0]));
            pkColumns.push(...cols);
            return;
          }

          const simplePkMatch = line.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
          if (simplePkMatch) {
            const cols = simplePkMatch[1].split(',').map((c) => cleanIdentifier(c.trim()));
            pkColumns.push(...cols);
            return;
          }

          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const rawColName = parts[0];
            const rawType = parts[1];

            if (
              /^(INDEX|KEY|CONSTRAINT|UNIQUE|FOREIGN|FULLTEXT)$/i.test(cleanIdentifier(rawColName))
            ) {
              return;
            }

            const colName = cleanIdentifier(rawColName);
            let dataType = rawType;

            if (
              (dataType.includes('(') && !dataType.includes(')')) ||
              (parts[2] && parts[2].startsWith('('))
            ) {
              // heuristic for split types
            }

            dataType = cleanIdentifier(dataType).toUpperCase();
            let length = '';
            const lengthMatch = dataType.match(/\(([^)]+)\)/);
            if (lengthMatch) {
              length = lengthMatch[1];
              dataType = dataType.replace(/\(.*\)/, '');
            }

            const restOfLine = line.substring(line.indexOf(rawType) + rawType.length).toUpperCase();

            const isIdentity =
              restOfLine.includes('AUTO_INCREMENT') || restOfLine.includes('IDENTITY');
            const isNullable = !restOfLine.includes('NOT NULL');
            const isUnique = restOfLine.includes('UNIQUE');
            const inlinePk = restOfLine.includes('PRIMARY KEY');

            if (inlinePk) pkColumns.push(colName);

            columns.push({
              id: generateId(),
              name: colName,
              logicalName: colName,
              type: dataType,
              length: length,
              isPk: inlinePk,
              isFk: false,
              isNullable: isNullable && !inlinePk,
              isUnique: isUnique,
              isIdentity: isIdentity,
            });
          }
        });

        columns.forEach((c) => {
          if (pkColumns.includes(c.name)) {
            c.isPk = true;
            c.isNullable = false;
          }
        });

        // Determine Position
        let x = currentX;
        let y = currentY;

        if (layoutX !== null && layoutY !== null) {
          x = layoutX;
          y = layoutY;
        } else {
          // Only advance grid if we didn't use a custom layout
          currentX += X_OFFSET;
          colCount++;
          if (colCount > 2) {
            colCount = 0;
            currentX = 100;
            currentY += Y_OFFSET;
          }
        }

        tables.push({
          id: tableId,
          name: tableName,
          logicalName: tableName,
          x: x,
          y: y,
          isManuallyEditable: false, // Imported tables are locked by default
          columns: columns,
        });
      }
    }
  });

  // Foreign Key Parsing
  statements.forEach((stmt) => {
    const alterFkMatch = stmt.match(
      /ALTER\s+TABLE\s+([^\s]+)\s+.*FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+([^\s]+)\s*\(([^)]+)\)/i,
    );

    if (alterFkMatch) {
      let childTblName = cleanIdentifier(alterFkMatch[1]);
      if (childTblName.includes('.')) childTblName = childTblName.split('.').pop()!;
      const childColName = cleanIdentifier(alterFkMatch[2]);

      let parentTblName = cleanIdentifier(alterFkMatch[3]);
      if (parentTblName.includes('.')) parentTblName = parentTblName.split('.').pop()!;
      const parentColName = cleanIdentifier(alterFkMatch[4]);

      const childTable = tables.find((t) => t.name === childTblName);
      const parentTable = tables.find((t) => t.name === parentTblName);

      if (childTable && parentTable) {
        const childCol = childTable.columns.find((c) => c.name === childColName);
        const parentCol = parentTable.columns.find((c) => c.name === parentColName);

        if (childCol && parentCol) {
          childCol.isFk = true;
          relationships.push({
            id: generateId(),
            name: `FK_${childTable.name}_${parentTable.name}`,
            fromTable: parentTable.id,
            fromCol: parentCol.id,
            toTable: childTable.id,
            toCol: childCol.id,
            type: '1:N',
          });
        }
      }
    }
  });

  return { tables, relationships };
};
