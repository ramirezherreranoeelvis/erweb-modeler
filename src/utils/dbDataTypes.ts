
export type DbEngine = 'mysql' | 'mariadb' | 'postgres' | 'mssql';

export const DB_ENGINES: { value: DbEngine; label: string }[] = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mssql', label: 'SQL Server' },
];

// Map of Aliases to Canonical types for comparison logic
const POSTGRES_ALIASES: Record<string, string> = {
  // Integers
  'int': 'integer',
  'int4': 'integer',
  'integer': 'integer',
  'serial': 'integer', // SERIAL is effectively an INTEGER with a sequence
  
  // Big Integers
  'int8': 'bigint',
  'bigint': 'bigint',
  'bigserial': 'bigint', // BIGSERIAL is effectively a BIGINT with a sequence
  
  // Small Integers
  'int2': 'smallint',
  'smallint': 'smallint',
  'smallserial': 'smallint', // SMALLSERIAL is effectively a SMALLINT with a sequence

  // Booleans
  'bool': 'boolean',
  'boolean': 'boolean',
  
  // Characters
  'varchar': 'character varying',
  'character varying': 'character varying',
  'char': 'character',
  'character': 'character',
  'bpchar': 'character',
  
  // Numbers
  'decimal': 'numeric',
  'numeric': 'numeric',
  'float4': 'real',
  'real': 'real',
  'float8': 'double precision',
  'double precision': 'double precision',
  
  // Time
  'timestamptz': 'timestamp with time zone',
  'timestamp with time zone': 'timestamp with time zone',
  'timestamp': 'timestamp without time zone',
  'timestamp without time zone': 'timestamp without time zone',
  'timetz': 'time with time zone',
  'time with time zone': 'time with time zone',
  'time': 'time without time zone',
  'time without time zone': 'time without time zone',
  
  // Bits
  'varbit': 'bit varying',
  'bit varying': 'bit varying'
};

export const DB_DATA_TYPES: Record<DbEngine, string[]> = {
  mysql: [
    'int', 'varchar()', 'decimal()', 'datetime', 'blob', 'binary()', 'blob()', 'longblob', 'mediumblob', 'tinyblob', 'varbinary()',
    'date', 'datetime()', 'time()', 'timestamp()', 'year()', 'geometry', 'geometrycollection', 'linestring', 'multilinestring',
    'multipoint', 'multipolygon', 'point', 'polygon', 'bigint()', 'decimal', 'double', 'float', 'int()', 'mediumint()', 'real',
    'smallint()', 'tinyint()', 'char()', 'json', 'nchar()', 'nvarchar()', 'varchar()', 'longtext', 'mediumtext', 'text()',
    'tinytext', 'bit()', 'boolean', 'enum()', 'set()'
  ],
  mariadb: [
    'tinyint()', 'smallint()', 'mediumint()', 'int()', 'bigint()', 'decimal()', 'float', 'double', 'bit()',
    'char()', 'varchar()', 'binary()', 'varbinary()', 'tinyblob', 'blob', 'mediumblob', 'longblob',
    'tinytext', 'text', 'mediumtext', 'longtext', 'enum()', 'set()', 'date', 'datetime', 'timestamp', 'time', 'year',
    'json', 'uuid', 'inet6', 'geometry'
  ],
  postgres: [
    // --- Common / High Usage ---
    'integer', 'int', 'int4',
    'bigint', 'int8',
    'smallint', 'int2',
    'serial', 'bigserial', 'smallserial',
    'numeric()', 'decimal()', 
    'real', 'float4', 
    'double precision', 'float8',
    'money',
    
    // --- Characters ---
    'character varying()', 'varchar()', 'text',
    'character()', 'char()', 'bpchar',
    '"char"', // Single byte internal type
    'enum', // Added support for custom enums
    
    // --- Date/Time ---
    'timestamp', 'timestamp without time zone',
    'timestamptz', 'timestamp with time zone',
    'date',
    'time', 'time without time zone',
    'timetz', 'time with time zone',
    'interval',
    
    // --- Boolean/Bit ---
    'boolean', 'bool',
    'bit()', 'bit varying()', 'varbit',
    
    // --- Network / Geo ---
    'uuid', 'json', 'jsonb', 'xml',
    'inet', 'cidr', 'macaddr', 'macaddr8',
    'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
    
    // --- Arrays (Representative) ---
    'text[]', 'integer[]', 'varchar[]', 'jsonb[]',
    
    // --- Ranges / Other ---
    'tsvector', 'tsquery',
    'int4range', 'int8range', 'numrange', 'tsrange', 'tstzrange', 'daterange',
    'bytea'
  ],
  mssql: [
    'bigint', 'binary(50)', 'bit', 'char(10)', 'date', 'datetime', 'datetime2(7)', 'datetimeoffset(7)', 'decimal(18, 0)', 'float',
    'geography', 'geometry', 'hierarchyid', 'image', 'int', 'money', 'nchar(10)', 'ntext', 'numeric(18, 0)', 'nvarchar(50)',
    'nvarchar(MAX)', 'real', 'smalldatetime', 'smallint', 'smallmoney', 'sql_variant', 'text', 'time(7)', 'timestamp', 'tinyint',
    'uniqueidentifier', 'varbinary(50)', 'varbinary(MAX)', 'varchar(50)', 'varchar(MAX)', 'xml',
    'enum' // Added simulated enum via CHECK constraint
  ]
};

// Helper to determine if the "Length" input should be shown for a given type
export const shouldShowLength = (type: string): boolean => {
  const upperType = type.toUpperCase();
  
  // 1. Types that definitely DO NOT need length
  const noLengthPatterns = [
    'DATE', 'YEAR', 'TEXT', 'JSON', 'JSONB', 'UUID', 'XML', 'BOOLEAN', 'BOOL', 
    'SERIAL', 'SMALLSERIAL', 'BIGSERIAL', 'INT', 'INTEGER', 'INT4', 'BIGINT', 'INT8', 'SMALLINT', 'INT2',
    'REAL', 'FLOAT4', 'DOUBLE PRECISION', 'FLOAT8', 'MONEY',
    'TIMESTAMP', 'TIMESTAMPTZ', 'TIMETZ', 'INET', 'CIDR', 'MACADDR', 'BYTEA', 'TSVECTOR', 'TSQUERY'
  ];

  if (noLengthPatterns.some(p => upperType === p || upperType.startsWith(p + ' '))) return false;
  
  // 2. If it ends with empty parens "()", it needs a length/argument.
  if (type.endsWith('()')) return true;

  // 3. If it has parentheses with content inside (e.g. "varchar(50)"), assume complete
  if (/\(.+\)/.test(type)) return false;

  // 4. Default: Show length input for generic char/varchar/numeric/decimal/bit AND ENUM
  if (['VARCHAR', 'CHAR', 'CHARACTER', 'CHARACTER VARYING', 'BIT', 'BIT VARYING', 'VARBIT', 'DECIMAL', 'NUMERIC', 'ENUM'].some(t => upperType.includes(t))) {
      return true;
  }

  return true;
};

// Helper to check if a type REQUIRES a length (visual validation)
export const isLengthRequired = (type: string): boolean => {
  const t = type.toUpperCase().replace(/\(.*\)/, '').trim();
  // Postgres VARCHAR/TEXT can be length-less, but usually modeled with length in ER
  return ['VARBINARY', 'BINARY'].includes(t);
};

// Helper to check if a type is valid for the current engine
export const isTypeValid = (type: string, engine: DbEngine): boolean => {
  const types = DB_DATA_TYPES[engine];
  if (!types) return true; // Fallback

  const normalize = (t: string) => t.split('(')[0].trim().toLowerCase();
  const normalizedType = normalize(type);

  return types.some(t => normalize(t) === normalizedType);
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
        return POSTGRES_ALIASES[lower] || type; // e.g. serial -> integer, bigserial -> bigint
    }
    return type;
}
