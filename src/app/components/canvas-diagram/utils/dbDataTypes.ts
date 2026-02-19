export type DbEngine = 'mysql' | 'mariadb' | 'postgres' | 'mssql';

export const DB_ENGINES: { value: DbEngine; label: string }[] = [
      { value: 'mysql', label: 'MySQL' },
      { value: 'postgres', label: 'PostgreSQL' },
      { value: 'mssql', label: 'SQL Server' },
];

// Map of Aliases to Canonical types for comparison logic
const POSTGRES_ALIASES: Record<string, string> = {
      // Integers
      int: 'integer',
      int4: 'integer',
      integer: 'integer',
      serial: 'integer',

      // Big Integers
      int8: 'bigint',
      bigint: 'bigint',
      bigserial: 'bigint',

      // Small Integers
      int2: 'smallint',
      smallint: 'smallint',
      smallserial: 'smallint',

      // Booleans
      bool: 'boolean',
      boolean: 'boolean',

      // Characters
      varchar: 'character varying',
      'character varying': 'character varying',
      char: 'character',
      character: 'character',
      bpchar: 'character',

      // Numbers
      decimal: 'numeric',
      numeric: 'numeric',
      float4: 'real',
      real: 'real',
      float8: 'double precision',
      'double precision': 'double precision',

      // Time
      timestamptz: 'timestamp with time zone',
      'timestamp with time zone': 'timestamp with time zone',
      timestamp: 'timestamp without time zone',
      'timestamp without time zone': 'timestamp without time zone',
      timetz: 'time with time zone',
      'time with time zone': 'time with time zone',
      time: 'time without time zone',
      'time without time zone': 'time without time zone',

      // Bits
      varbit: 'bit varying',
      'bit varying': 'bit varying',
};

// Helper to remove duplicates from array
const unique = (arr: string[]) => Array.from(new Set(arr));

export const DB_DATA_TYPES: Record<DbEngine, string[]> = {
      mysql: unique([
            'int',
            'tinyint',
            'smallint',
            'mediumint',
            'bigint',
            'varchar',
            'varchar(255)',
            'varchar(100)',
            'char',
            'char(1)',
            'text',
            'tinytext',
            'mediumtext',
            'longtext',
            'decimal',
            'decimal(10,2)',
            'numeric',
            'float',
            'double',
            'real',
            'datetime',
            'date',
            'timestamp',
            'time',
            'year',
            'blob',
            'tinyblob',
            'mediumblob',
            'longblob',
            'binary',
            'varbinary',
            'json',
            'enum',
            'set',
            'bit',
            'boolean',
            'bool', // Added boolean/bool explicitly
            'geometry',
            'point',
            'linestring',
            'polygon',
      ]),
      mariadb: unique([
            'int',
            'tinyint',
            'smallint',
            'mediumint',
            'bigint',
            'varchar',
            'varchar(255)',
            'char',
            'text',
            'tinytext',
            'mediumtext',
            'longtext',
            'decimal',
            'decimal(10,2)',
            'numeric',
            'float',
            'double',
            'datetime',
            'date',
            'timestamp',
            'time',
            'year',
            'blob',
            'tinyblob',
            'mediumblob',
            'longblob',
            'binary',
            'varbinary',
            'json',
            'enum',
            'set',
            'bit',
            'boolean',
            'bool',
            'uuid',
            'inet6',
            'geometry', // Added boolean/bool
      ]),
      postgres: unique([
            // Integers
            'integer',
            'int',
            'int4',
            'bigint',
            'int8',
            'smallint',
            'int2',
            'serial',
            'bigserial',
            'smallserial',

            // Exact Numbers
            'numeric',
            'numeric(10,2)',
            'decimal',
            'money',

            // Approximate
            'real',
            'float4',
            'double precision',
            'float8',

            // Characters
            'character varying',
            'varchar',
            'varchar(255)',
            'text',
            'character',
            'char',
            'char(1)',
            'bpchar',

            // Time
            'timestamp',
            'timestamp without time zone',
            'timestamptz',
            'timestamp with time zone',
            'date',
            'time',
            'time without time zone',
            'timetz',
            'time with time zone',
            'interval',

            // Boolean/Bit
            'boolean',
            'bool',
            'bit',
            'bit varying',
            'varbit',

            // Other
            'uuid',
            'json',
            'jsonb',
            'xml',
            'inet',
            'cidr',
            'macaddr',
            'bytea',
            'tsvector',
            'enum',
      ]),
      mssql: unique([
            // Exact Numerics
            'int',
            'bigint',
            'smallint',
            'tinyint',
            'bit',
            'decimal',
            'decimal(18,0)',
            'decimal(18,2)',
            'numeric',
            'money',
            'smallmoney',

            // Approximate
            'float',
            'real',

            // Date & Time
            'date',
            'datetime',
            'datetime2',
            'datetime2(7)',
            'smalldatetime',
            'time',
            'time(7)',
            'datetimeoffset',

            // Characters
            'varchar',
            'varchar(50)',
            'varchar(MAX)',
            'nvarchar',
            'nvarchar(50)',
            'nvarchar(MAX)',
            'char',
            'char(10)',
            'nchar',
            'ntext',
            'text',

            // Binary
            'binary',
            'varbinary',
            'varbinary(MAX)',
            'image',

            // Other
            'uniqueidentifier',
            'xml',
            'json',
            'sql_variant',
            'geometry',
            'geography',
            'hierarchyid',
            'enum',
      ]),
};

// Helper to determine if the "Length" input should be shown for a given type
export const shouldShowLength = (type: string): boolean => {
      const t = type
            .toUpperCase()
            .replace(/\(.*\)/, '')
            .trim(); // Clean input just in case

      // 1. Types that definitely DO NOT need length
      const noLengthPatterns = [
            'DATE',
            'YEAR',
            'TEXT',
            'JSON',
            'JSONB',
            'UUID',
            'XML',
            'BOOLEAN',
            'BOOL',
            'SERIAL',
            'SMALLSERIAL',
            'BIGSERIAL',
            'INT',
            'INTEGER',
            'INT4',
            'BIGINT',
            'INT8',
            'SMALLINT',
            'INT2',
            'REAL',
            'FLOAT4',
            'DOUBLE PRECISION',
            'FLOAT8',
            'MONEY',
            'SMALLMONEY',
            'TIMESTAMP',
            'TIMESTAMPTZ',
            'TIMETZ',
            'INET',
            'CIDR',
            'MACADDR',
            'BYTEA',
            'TSVECTOR',
            'TSQUERY',
            'TINYTEXT',
            'MEDIUMTEXT',
            'LONGTEXT',
            'TINYBLOB',
            'MEDIUMBLOB',
            'LONGBLOB',
            'BLOB',
            'IMAGE',
            'NTEXT', // Added IMAGE and NTEXT here
      ];

      if (noLengthPatterns.some((p) => t === p || t.startsWith(p + ' '))) return false;

      // 2. Types that explicitly ALLOW/REQUIRE length or arguments
      const lengthPatterns = [
            'VARCHAR',
            'CHAR',
            'CHARACTER',
            'CHARACTER VARYING',
            'NVARCHAR',
            'NCHAR',
            'BPCHAR',
            'BIT',
            'BIT VARYING',
            'VARBIT',
            'DECIMAL',
            'NUMERIC',
            'FLOAT',
            'DOUBLE',
            'BINARY',
            'VARBINARY',
            'ENUM',
            'SET',
            'DATETIME',
            'DATETIME2',
            'TIME', // MySQL/MSSQL allow fractional seconds precision
      ];

      return lengthPatterns.some((p) => t === p || t.startsWith(p));
};

// Helper to check if a type REQUIRES a length (visual validation warning)
export const isLengthRequired = (type: string): boolean => {
      const t = type
            .toUpperCase()
            .replace(/\(.*\)/, '')
            .trim();
      // Binary types usually require length in some DBs, or it defaults to 1 which might be wrong.
      // ENUM/SET requires values.
      return ['VARBINARY', 'BINARY', 'ENUM', 'SET'].includes(t);
};

// Helper to check if a type is valid for the current engine
export const isTypeValid = (type: string, engine: DbEngine): boolean => {
      const types = DB_DATA_TYPES[engine];
      if (!types) return true; // Fallback

      const normalize = (t: string) => t.split('(')[0].trim().toLowerCase();
      const normalizedType = normalize(type);

      return types.some((t) => normalize(t) === normalizedType);
};

// --- COMPATIBILITY CHECKER ---
export const areTypesCompatible = (type1: string, type2: string, engine: DbEngine): boolean => {
      // 1. Normalize
      let t1 = type1.toLowerCase().split('(')[0].trim();
      let t2 = type2.toLowerCase().split('(')[0].trim();

      if (t1 === t2) return true;

      // 2. Engine Specific Logic
      if (engine === 'postgres') {
            const c1 = POSTGRES_ALIASES[t1] || t1;
            const c2 = POSTGRES_ALIASES[t2] || t2;
            return c1 === c2;
      }

      // MySQL simple compatibility (int vs int())
      if (engine === 'mysql') {
            const base1 = t1.replace(')', '').replace('(', '');
            const base2 = t2.replace(')', '').replace('(', '');
            return base1 === base2;
      }

      return false;
};

// Helper to get the canonical type for a new FK based on a Source PK type
export const getCanonicalType = (type: string, engine: DbEngine): string => {
      if (engine === 'postgres') {
            const lower = type.toLowerCase().split('(')[0].trim();
            return POSTGRES_ALIASES[lower] || type;
      }
      return type;
};
