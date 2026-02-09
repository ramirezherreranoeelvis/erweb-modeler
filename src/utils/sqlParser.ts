
import { generateId } from './geometry';
import type { Table, Column, Relationship } from '../ui/types';

// Helper to remove comments, BUT PRESERVE ERWEB_LAYOUT specific lines
const cleanSQL = (sql: string) => {
  let cleaned = sql
    // Remove multiline comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove single line comments EXCEPT those starting with ERWEB_LAYOUT, x:, or y:
    .replace(/--(?!.*(ERWEB_LAYOUT|x:|y:)).*$/gm, '');

  // --- POSTGRES SPECIFIC CLEANING ---
  
  // 1. Remove DO $$ ... $$ blocks (PL/PGSQL) - handled carefully in main parse now
  // We remove the wrapper but we might have extracted types before this in parseSQL
  cleaned = cleaned.replace(/DO\s*\$\$[\s\S]*?\$\$\s*;/gi, '');

  // 2. Remove CREATE FUNCTION ... $$ ... $$ LANGUAGE ...;
  cleaned = cleaned.replace(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[\s\S]*?\$\$[\s\S]*?\$\$\s*LANGUAGE\s+\w+\s*;/gi, '');

  // 3. Remove CREATE TRIGGER
  cleaned = cleaned.replace(/CREATE\s+TRIGGER[\s\S]*?;/gi, '');

  // 4. Remove CREATE VIEW
  cleaned = cleaned.replace(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW[\s\S]*?;/gi, '');
  
  // 5. Remove CREATE EXTENSION / SCHEMA / TYPE / INDEX
  // Note: We scan for types manually before cleaning
  cleaned = cleaned.replace(/CREATE\s+EXTENSION[\s\S]*?;/gi, '');
  cleaned = cleaned.replace(/CREATE\s+SCHEMA[\s\S]*?;/gi, '');
  // cleaned = cleaned.replace(/CREATE\s+TYPE[\s\S]*?;/gi, ''); // Don't strip types yet, handled in main logic or extracted
  cleaned = cleaned.replace(/CREATE\s+INDEX[\s\S]*?;/gi, '');
  cleaned = cleaned.replace(/SET\s+search_path[\s\S]*?;/gi, '');

  return cleaned.trim();
};

// Helper to remove brackets [ ] (MSSQL) or backticks ` ` (MySQL) or quotes " "
const cleanIdentifier = (str: string) => {
  return str.replace(/[\[\]`"]/g, '');
};

const splitColumns = (content: string) => {
  const lines = [];
  let depth = 0;
  let start = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (inQuote) {
      if (char === quoteChar) {
        // Handle escaped quotes '' inside SQL
        if (content[i+1] === quoteChar) {
          i++;
        } else {
          inQuote = false;
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      inQuote = true;
      quoteChar = char;
      continue;
    }

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
  // 0. PRE-PASS: Extract Postgres Custom ENUM Types
  // We do this on the raw input before 'cleanSQL' might strip DO blocks or CREATE TYPE
  const customTypes: Record<string, string> = {};
  
  // Regex to find: CREATE TYPE name AS ENUM ('val1', 'val2');
  const typeRegex = /CREATE\s+TYPE\s+([^\s]+)\s+AS\s+ENUM\s*\(([^)]+)\)/gi;
  let match;
  while ((match = typeRegex.exec(sqlInput)) !== null) {
    let typeName = cleanIdentifier(match[1]);
    if (typeName.includes('.')) typeName = typeName.split('.').pop()!; // Remove schema
    const enumValues = match[2].trim(); // "'VAL1', 'VAL2'"
    customTypes[typeName.toUpperCase()] = enumValues;
  }

  // 1. Clean SQL
  let cleanSql = cleanSQL(sqlInput);
  
  // After extracting types, we can remove any remaining standalone CREATE TYPE statements to avoid parser confusion
  cleanSql = cleanSql.replace(/CREATE\s+TYPE[\s\S]*?;/gi, '');

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
    // Check for Layout Metadata
    let layoutX: number | null = null;
    let layoutY: number | null = null;

    const xMatch = stmt.match(/--\s*x:\s*(-?\d+)/);
    if (xMatch) layoutX = parseInt(xMatch[1], 10);

    const yMatch = stmt.match(/--\s*y:\s*(-?\d+)/);
    if (yMatch) layoutY = parseInt(yMatch[1], 10);

    if (layoutX === null || layoutY === null) {
      const jsonMatch = stmt.match(/--\s*ERWEB_LAYOUT:\s*(\{.*\})/);
      if (jsonMatch) {
        try {
          const json = JSON.parse(jsonMatch[1]);
          if (typeof json.x === 'number') layoutX = json.x;
          if (typeof json.y === 'number') layoutY = json.y;
        } catch (e) {}
      }
    }

    // CREATE TABLE Parsing
    const createTableMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/i);

    if (createTableMatch) {
      let rawTableName = createTableMatch[1];
      // Handle schema prefixes like "hotel.guests" -> "guests"
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
            
            // Skip Constraints / Indexes defined as "columns"
            if (
              /^(INDEX|KEY|CONSTRAINT|UNIQUE|FOREIGN|FULLTEXT|CHECK|EXCLUDE)$/i.test(cleanIdentifier(rawColName))
            ) {
              return;
            }

            const colName = cleanIdentifier(rawColName);
            let rawType = parts[1];
            
            // Handle types that might be keywords or look different
            if (rawType.toUpperCase() === 'DOUBLE' && parts[2] && parts[2].toUpperCase() === 'PRECISION') {
                rawType = 'DOUBLE PRECISION';
            }

            let dataType = cleanIdentifier(rawType);
            
            // Parsing Length/Arguments
            let length = '';
            const lengthMatch = dataType.match(/\(([^)]+)\)/);
            if (lengthMatch) {
              length = lengthMatch[1];
              dataType = dataType.replace(/\(.*\)/, '');
            } else if (parts[2] && parts[2].startsWith('(')) {
               const parenContent = parts[2].match(/\(([^)]+)\)/);
               if (parenContent) {
                   length = parenContent[1];
               }
            }

            // --- CUSTOM ENUM REPLACEMENT ---
            // If the type matches one of our found custom types, replace it with ENUM
            if (customTypes[dataType.toUpperCase()]) {
                length = customTypes[dataType.toUpperCase()];
                dataType = 'ENUM';
            }

            // Clean up type name
            dataType = dataType.toUpperCase();

            // --- MSSQL ENUM (CHECK CONSTRAINT) REPLACEMENT ---
            // Look for pattern: CHECK (colName IN ('val1', 'val2'))
            // We use the original line content to find this constraint
            const mssqlEnumMatch = line.match(/CHECK\s*\(\s*(?:\[?[^\]]+\]?)\s+IN\s*\(([^)]+)\)\s*\)/i);
            if (mssqlEnumMatch) {
                dataType = 'ENUM';
                length = mssqlEnumMatch[1].trim(); // 'A', 'B'
            }

            // Reconstruct rest of line
            const typeIndex = line.toUpperCase().indexOf(dataType);
            // We search after the type (and length if processed separately, but regex above handles mostly)
            let restOfLine = line.substring(line.toUpperCase().indexOf(parts[1].toUpperCase()) + parts[1].length);
            // If we grabbed length separately (e.g. "DECIMAL (10,2)"), advance past it
            if (restOfLine.trim().startsWith('(')) {
                restOfLine = restOfLine.substring(restOfLine.indexOf(')') + 1);
            }
            restOfLine = restOfLine.toUpperCase();

            const isIdentity =
              restOfLine.includes('AUTO_INCREMENT') || 
              restOfLine.includes('IDENTITY') || 
              ['SERIAL', 'BIGSERIAL', 'SMALLSERIAL'].includes(dataType);
              
            const isNullable = !restOfLine.includes('NOT NULL');
            const isUnique = restOfLine.includes('UNIQUE');
            const inlinePk = restOfLine.includes('PRIMARY KEY');

            // --- DEFAULT VALUE PARSING ---
            let defaultValue = undefined;
            // Regex to find DEFAULT 'value' or DEFAULT 123
            // Captures: 1=Value with quotes, or Number/Keyword
            const defaultMatch = line.match(/DEFAULT\s+('?[^'\s,]+'?|[\w\d.-]+)/i);
            if (defaultMatch) {
                defaultValue = defaultMatch[1];
            }

            if (inlinePk) pkColumns.push(colName);

            columns.push({
              id: generateId(),
              name: colName,
              logicalName: colName,
              type: dataType,
              length: length,
              defaultValue: defaultValue, // Set parsed default
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
          isManuallyEditable: false,
          columns: columns,
        });
      }
    }
  });

  // Foreign Key Parsing (inline and ALTER TABLE)
  // ... (Identical to existing logic, kept for brevity) ...
  // 1. Inline REFERENCES
  statements.forEach((stmt) => {
      const createTableMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/i);
      if (createTableMatch) {
          let rawTableName = createTableMatch[1];
          if (rawTableName.includes('.')) rawTableName = rawTableName.split('.').pop()!;
          const tableName = cleanIdentifier(rawTableName);
          const childTable = tables.find(t => t.name === tableName);
          
          if (childTable) {
              const body = stmt.substring(stmt.indexOf('(') + 1, stmt.lastIndexOf(')'));
              const lines = splitColumns(body);
              
              lines.forEach(line => {
                  const refMatch = line.match(/(\w+).*REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i);
                  if (refMatch) {
                      const colName = cleanIdentifier(refMatch[1]);
                      let parentTblRaw = refMatch[2];
                      if (parentTblRaw.includes('.')) parentTblRaw = parentTblRaw.split('.').pop()!;
                      const parentTblName = cleanIdentifier(parentTblRaw);
                      const parentColName = cleanIdentifier(refMatch[3]);
                      
                      const parentTable = tables.find(t => t.name === parentTblName);
                      const childCol = childTable.columns.find(c => c.name === colName);
                      
                      if (parentTable && childCol) {
                          const parentCol = parentTable.columns.find(c => c.name === parentColName);
                          if (parentCol) {
                              childCol.isFk = true;
                              relationships.push({
                                  id: generateId(),
                                  name: `FK_${childTable.name}_${parentTable.name}`,
                                  fromTable: parentTable.id,
                                  fromCol: parentCol.id,
                                  toTable: childTable.id,
                                  toCol: childCol.id,
                                  type: '1:N'
                              });
                          }
                      }
                  }
              });
          }
      }
  });

  // 2. ALTER TABLE ... ADD FOREIGN KEY
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
