import { DbEngine, DB_DATA_TYPES, isTypeValid, shouldShowLength } from './dbDataTypes';

export interface MappedTypeResult {
      type: string;
      length: string;
      options?: { type: string; length: string }[]; // For ambiguous conversions
}

export const convertDefaultValue = (
      val: string | undefined,
      targetEngine: DbEngine,
      targetType: string,
): string | undefined => {
      if (!val) return undefined;

      const v = val.trim().toUpperCase();
      const tType = targetType.toUpperCase();

      // --- 1. Boolean Conversion ---
      // Only convert 0/1 <-> true/false if the TARGET type is explicitly Boolean/Bit.
      // This prevents SMALLINT default '0' from becoming 'false'.
      const isTargetBoolean = ['BOOLEAN', 'BOOL', 'BIT'].some((b) => tType.startsWith(b));

      if (isTargetBoolean) {
            if (targetEngine === 'postgres') {
                  if (v === '1') return 'true';
                  if (v === '0') return 'false';
                  if (v === 'TRUE') return 'true';
                  if (v === 'FALSE') return 'false';
            } else if (
                  (targetEngine === 'mysql' || targetEngine === 'mariadb') &&
                  (tType === 'BOOLEAN' || tType === 'BOOL')
            ) {
                  // MySQL supports TRUE/FALSE literals for BOOLEAN types.
                  // We prefer TRUE/FALSE over 1/0 for readability when the type is explicitly BOOLEAN.
                  if (v === 'TRUE') return 'TRUE';
                  if (v === 'FALSE') return 'FALSE';
            } else {
                  // MSSQL (BIT) or MySQL (BIT/TINYINT) require 1/0
                  if (v === 'TRUE') return '1';
                  if (v === 'FALSE') return '0';
            }
      }

      // --- 2. Date/Time Current Timestamp ---
      // Variations: NOW(), CURRENT_TIMESTAMP, GETDATE(), SYSDATETIME(), SYSDATETIMEOFFSET()
      const isNow = [
            'NOW()',
            'CURRENT_TIMESTAMP',
            'GETDATE()',
            'SYSDATETIME()',
            'SYSDATETIMEOFFSET()',
      ].some((k) => v.includes(k));

      if (isNow) {
            if (targetEngine === 'mssql') {
                  // Specific fix: DATETIMEOFFSET requires SYSDATETIMEOFFSET() for semantic correctness, not GETDATE()
                  if (tType.includes('DATETIMEOFFSET')) {
                        return 'SYSDATETIMEOFFSET()';
                  }
                  return 'GETDATE()';
            }
            if (targetEngine === 'mysql') return 'CURRENT_TIMESTAMP';
            if (targetEngine === 'postgres') {
                  // Postgres supports case-insensitive now(), NOW(), current_timestamp.
                  // If the value is already valid for Postgres, return original to avoid flagging a change.
                  if (v === 'NOW()' || v === 'CURRENT_TIMESTAMP') return val;
                  return 'NOW()';
            }
      }

      return val; // Return original if no rule matches
};

export const getMappedType = (
      currentType: string,
      currentLength: string,
      targetEngine: DbEngine,
      originalType?: string,
): MappedTypeResult => {
      // --- 0. METADATA RESTORATION (Round-Trip) ---
      if (originalType) {
            const cleanOriginal = originalType.split('(')[0].trim();
            // If the original semantic type is valid in the new target engine, restore it!
            // Example: 'BOOLEAN' (Postgres) -> 'BIT' (MSSQL) -> 'BOOLEAN' (Postgres/MySQL)
            if (isTypeValid(cleanOriginal, targetEngine)) {
                  const showLen = shouldShowLength(cleanOriginal);
                  return {
                        type: cleanOriginal,
                        length: showLen ? currentLength : '',
                  };
            }
      }

      const type = currentType.toUpperCase().trim();
      const len = currentLength;

      // --- AMBIGUOUS CASES (Provide Options) ---

      // Case: SQL Server VARCHAR(MAX) -> Postgres
      if (
            targetEngine === 'postgres' &&
            (type === 'VARCHAR' || type === 'NVARCHAR') &&
            len === 'MAX'
      ) {
            return {
                  type: 'TEXT',
                  length: '',
                  options: [
                        { type: 'TEXT', length: '' },
                        { type: 'VARCHAR', length: '255' }, // Fallback option
                  ],
            };
      }

      // Case: SQL Server DATETIME2 -> MySQL (DATETIME vs TIMESTAMP)
      if (targetEngine === 'mysql' && type === 'DATETIME2') {
            // MySQL usually maps to DATETIME, but user might want TIMESTAMP
            // keeping simple for now, but structure allows expansion.
      }

      // --- STANDARD MAPPING LOGIC (Keep existing logic mostly) ---

      // --- REGLA 1: TIPOS DEPRECADOS (Solo SQL Server tiene marcados estrictos) ---
      if (targetEngine === 'mssql') {
            if (type === 'TEXT') return { type: 'VARCHAR', length: 'MAX' };
            if (type === 'NTEXT') return { type: 'NVARCHAR', length: 'MAX' };
            if (type === 'IMAGE') return { type: 'VARBINARY', length: 'MAX' };
      }

      // --- REGLA 2: VERIFICAR SI EL TIPO EXISTE EN EL MOTOR DESTINO ---
      const validTargetTypes = DB_DATA_TYPES[targetEngine].map((t) =>
            t.split('(')[0].trim().toUpperCase(),
      );

      // Excepción para Postgres SERIAL
      if (targetEngine === 'postgres') {
            if (['SERIAL', 'BIGSERIAL', 'SMALLSERIAL'].includes(type)) {
                  return { type: currentType, length: len };
            }
      }

      if (validTargetTypes.includes(type)) {
            return { type: currentType, length: len };
      }

      // --- REGLA 3: EL TIPO NO EXISTE -> BUSCAR EQUIVALENTE ---

      // 3.1 TARGET: SQL SERVER (MSSQL)
      if (targetEngine === 'mssql') {
            if (type === 'SERIAL') return { type: 'INT', length: '' };
            if (type === 'BIGSERIAL') return { type: 'BIGINT', length: '' };
            if (type === 'SMALLSERIAL') return { type: 'SMALLINT', length: '' };

            if (type === 'BOOL' || type === 'BOOLEAN') return { type: 'BIT', length: '' };
            if (type === 'UUID') return { type: 'UNIQUEIDENTIFIER', length: '' };
            if (type === 'JSON' || type === 'JSONB') return { type: 'NVARCHAR', length: 'MAX' };

            if (type === 'TIMESTAMPTZ') return { type: 'DATETIMEOFFSET', length: '7' };
            if (type === 'TIMESTAMP') return { type: 'DATETIME2', length: '7' };
            if (type === 'YEAR') return { type: 'SMALLINT', length: '' };

            if (['LONGBLOB', 'MEDIUMBLOB', 'TINYBLOB', 'BLOB', 'BYTEA'].includes(type)) {
                  return { type: 'VARBINARY', length: 'MAX' };
            }

            if (type === 'MEDIUMINT') return { type: 'INT', length: '' };
            if (type === 'INT2') return { type: 'SMALLINT', length: '' };
            if (type === 'INT4' || type === 'INTEGER') return { type: 'INT', length: '' };
            if (type === 'INT8') return { type: 'BIGINT', length: '' };

            if (type === 'ENUM' || type === 'SET') return { type: 'VARCHAR', length: '255' };
      }

      // 3.2 TARGET: MySQL / MariaDB
      if (targetEngine === 'mysql' || targetEngine === 'mariadb') {
            // Boolean mapping: Explicitly prefer BOOLEAN over BIT or TINYINT to preserve semantics
            if (type === 'BOOLEAN' || type === 'BOOL') return { type: 'BOOLEAN', length: '' };

            if (type === 'SERIAL') return { type: 'INT', length: '' };
            if (type === 'BIGSERIAL') return { type: 'BIGINT', length: '' };
            if (type === 'SMALLSERIAL') return { type: 'SMALLINT', length: '' };
            if (type === 'INTEGER') return { type: 'INT', length: '' };

            if (type === 'TIMESTAMPTZ' || type === 'TIMETZ' || type === 'DATETIMEOFFSET') {
                  return { type: 'DATETIME', length: '' };
            }
            if (type === 'DATETIME2' || type === 'SMALLDATETIME') {
                  return { type: 'DATETIME', length: '' };
            }

            if (type === 'UUID' || type === 'UNIQUEIDENTIFIER')
                  return { type: 'CHAR', length: '36' };

            if (type === 'XML') return { type: 'LONGTEXT', length: '' };
            if (type === 'JSONB') return { type: 'JSON', length: '' };
            if (['MONEY', 'SMALLMONEY'].includes(type)) return { type: 'DECIMAL', length: '19,4' };

            if (type === 'BYTEA') return { type: 'LONGBLOB', length: '' };
            if (type === 'IMAGE' || (type === 'VARBINARY' && len === 'MAX'))
                  return { type: 'LONGBLOB', length: '' };

            if ((type === 'VARCHAR' || type === 'NVARCHAR') && len === 'MAX')
                  return { type: 'LONGTEXT', length: '' };
            if (type === 'NTEXT') return { type: 'LONGTEXT', length: '' };
      }

      // 3.3 TARGET: PostgreSQL
      if (targetEngine === 'postgres') {
            // MySQL BOOLEAN/BOOL is explicitly mapped back to Postgres BOOLEAN
            if (type === 'BOOLEAN' || type === 'BOOL') return { type: 'BOOLEAN', length: '' };
            // MySQL TINYINT(1) logic: Often used as Boolean, but ambiguous.
            // We'll stick to SMALLINT default unless it's explicitly BOOLEAN type.
            if (type === 'TINYINT') return { type: 'SMALLINT', length: '' };
            if (type === 'MEDIUMINT') return { type: 'INTEGER', length: '' };

            if (type === 'DATETIME' || type === 'DATETIME2' || type === 'SMALLDATETIME')
                  return { type: 'TIMESTAMP', length: '' };
            if (type === 'DATETIMEOFFSET') return { type: 'TIMESTAMPTZ', length: '' };

            if (
                  [
                        'IMAGE',
                        'BLOB',
                        'LONGBLOB',
                        'MEDIUMBLOB',
                        'TINYBLOB',
                        'VARBINARY',
                        'BINARY',
                  ].includes(type)
            ) {
                  return { type: 'BYTEA', length: '' };
            }

            if (['LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 'NTEXT'].includes(type))
                  return { type: 'TEXT', length: '' };
            if (type === 'NVARCHAR' || type === 'NCHAR')
                  return { type: 'VARCHAR', length: len === 'MAX' ? '' : len };

            if (type === 'UNIQUEIDENTIFIER') return { type: 'UUID', length: '' };
            if (type === 'DOUBLE') return { type: 'DOUBLE PRECISION', length: '' };
            if (type === 'SET') return { type: 'TEXT', length: '' };
      }

      return { type: currentType, length: len };
};
