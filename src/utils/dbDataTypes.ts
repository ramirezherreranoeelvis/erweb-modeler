
export type DbEngine = 'mysql' | 'mariadb' | 'postgres' | 'mssql';

export const DB_ENGINES: { value: DbEngine; label: string }[] = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'SQL Server' },
];

export const DB_DATA_TYPES: Record<DbEngine, string[]> = {
  mysql: [
    // Standard / Common (Top section of screenshot)
    'INT',
    'VARCHAR()',
    'DECIMAL()',
    'DATETIME',
    'BLOB',
    
    // Binary
    'BINARY()',
    'BLOB()',
    'LONGBLOB',
    'MEDIUMBLOB',
    'TINYBLOB',
    'VARBINARY()',
    
    // Date/Time
    'DATE',
    'DATETIME()',
    'TIME()',
    'TIMESTAMP()',
    'YEAR()',
    
    // Spatial
    'GEOMETRY',
    'GEOMETRYCOLLECTION',
    'LINESTRING',
    'MULTILINESTRING',
    'MULTIPOINT',
    'MULTIPOLYGON',
    'POINT',
    'POLYGON',
    
    // Numeric
    'BIGINT()',
    'DECIMAL',
    'DOUBLE',
    'FLOAT',
    'INT()',
    'MEDIUMINT()',
    'REAL',
    'SMALLINT()',
    'TINYINT()',
    
    // String
    'CHAR()',
    'JSON',
    'NCHAR()',
    'NVARCHAR()',
    'VARCHAR()', // Duplicate as per screenshot
    
    // Text
    'LONGTEXT',
    'MEDIUMTEXT',
    'TEXT()',
    'TINYTEXT',
    
    // Logic / Other
    'BIT()',
    'BOOLEAN',
    'ENUM()',
    'SET()'
  ],
  mariadb: [
    'TINYINT()', 'SMALLINT()', 'MEDIUMINT()', 'INT()', 'BIGINT()', 'DECIMAL()', 'FLOAT', 'DOUBLE', 'BIT()',
    'CHAR()', 'VARCHAR()', 'BINARY()', 'VARBINARY()', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB',
    'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'ENUM()', 'SET()',
    'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
    'JSON', 'UUID', 'INET6', 'GEOMETRY'
  ],
  postgres: [
    'SMALLINT', 'INTEGER', 'BIGINT', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION', 
    'SMALLSERIAL', 'SERIAL', 'BIGSERIAL', 'MONEY',
    'CHARACTER', 'CHAR', 'CHARACTER VARYING', 'VARCHAR', 'TEXT',
    'BYTEA',
    'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'DATE', 'TIME', 'TIME WITH TIME ZONE', 'INTERVAL',
    'BOOLEAN',
    'ENUM', 'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE',
    'CIDR', 'INET', 'MACADDR', 'BIT', 'BIT VARYING', 'UUID', 'XML', 'JSON', 'JSONB'
  ],
  mssql: [
    'bigint',
    'binary(50)',
    'bit',
    'char(10)',
    'date',
    'datetime',
    'datetime2(7)',
    'datetimeoffset(7)',
    'decimal(18, 0)',
    'float',
    'geography',
    'geometry',
    'hierarchyid',
    'image',
    'int',
    'money',
    'nchar(10)',
    'ntext',
    'numeric(18, 0)',
    'nvarchar(50)',
    'nvarchar(MAX)',
    'real',
    'smalldatetime',
    'smallint',
    'smallmoney',
    'sql_variant',
    'text',
    'time(7)',
    'timestamp',
    'tinyint',
    'uniqueidentifier',
    'varbinary(50)',
    'varbinary(MAX)',
    'varchar(50)',
    'varchar(MAX)',
    'xml'
  ]
};

// Helper to determine if the "Length" input should be shown for a given type
export const shouldShowLength = (type: string): boolean => {
  const upperType = type.toUpperCase();
  
  // 1. Types that definitely DO NOT need length
  // REMOVED: 'TIME', 'DATETIME', 'TIMESTAMP' from this list to allow precision editing
  const noLengthPatterns = [
    'DATE', 'YEAR', 
    'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB',
    'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
    'JSON', 'UUID', 'XML', 'BOOLEAN', 'SERIAL', 'SMALLSERIAL', 'BIGSERIAL',
    'GEOMETRY', 'POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION',
    'HIERARCHYID', 'UNIQUEIDENTIFIER', 'ROWVERSION', 'IMAGE', 'SQL_VARIANT', 'NTEXT', 'TEXT', 'BIT', 'MONEY', 'SMALLMONEY', 'REAL', 'FLOAT', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT'
  ];

  if (noLengthPatterns.includes(upperType)) return false;
  
  // 2. If it ends with empty parens "()", it needs a length/argument.
  if (upperType.endsWith('()')) return true;

  // 3. If it has parentheses with content inside (e.g. "varchar(50)", "decimal(18, 0)"), 
  // we assume the type definition is complete and hide the separate length input.
  if (/\(.+\)/.test(type)) return false;

  // 4. Default: Show length input for unlisted types just in case (e.g. generic VARCHAR without parens)
  return true;
};

// Helper to check if a type is valid for the current engine
export const isTypeValid = (type: string, engine: DbEngine): boolean => {
  const types = DB_DATA_TYPES[engine];
  if (!types) return true; // Fallback

  const normalize = (t: string) => t.split('(')[0].trim().toUpperCase();
  const normalizedType = normalize(type);

  return types.some(t => normalize(t) === normalizedType);
};
