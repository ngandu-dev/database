import mssql from "mssql";

export async function setupSqlServerReader(adminUrl: string): Promise<void> {
  const url = new URL(adminUrl);
  const baseConfig: mssql.config = {
    server: url.hostname,
    port: url.port === "" ? 1433 : Number.parseInt(url.port, 10),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    options: { encrypt: false, trustServerCertificate: true },
  };

  const master = await new mssql.ConnectionPool({ ...baseConfig, database: "master" }).connect();
  try {
    await master.request().batch(`
IF DB_ID('datazen') IS NULL CREATE DATABASE datazen;
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'datazen_reader')
  CREATE LOGIN datazen_reader WITH PASSWORD = 'reader';
ELSE
  ALTER LOGIN datazen_reader WITH PASSWORD = 'reader';
`);
  } finally {
    await master.close();
  }

  const database = await new mssql.ConnectionPool({ ...baseConfig, database: "datazen" }).connect();
  try {
    await database.request().batch(`
IF SCHEMA_ID('mcp_context') IS NULL EXEC('CREATE SCHEMA mcp_context');
IF OBJECT_ID('mcp_context.items', 'U') IS NULL
  CREATE TABLE mcp_context.items (id INT PRIMARY KEY, name NVARCHAR(100) NOT NULL);
MERGE mcp_context.items AS target
USING (VALUES (1, N'one'), (2, N'two')) AS source(id, name)
ON target.id = source.id
WHEN MATCHED THEN UPDATE SET name = source.name
WHEN NOT MATCHED THEN INSERT (id, name) VALUES (source.id, source.name);
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'datazen_reader')
  CREATE USER datazen_reader FOR LOGIN datazen_reader;
ALTER ROLE db_datareader ADD MEMBER datazen_reader;
GRANT VIEW DEFINITION TO datazen_reader;
`);
    await database
      .request()
      .batch(
        "CREATE OR ALTER VIEW mcp_context.item_names AS SELECT id, name FROM mcp_context.items;",
      );
  } finally {
    await database.close();
  }
}
