import { Client } from "pg";

export async function setupPostgresReader(adminUrl: string): Promise<void> {
  const databaseName = decodeURIComponent(new URL(adminUrl).pathname.replace(/^\//, ""));
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'datazen_reader') THEN
    CREATE ROLE datazen_reader LOGIN PASSWORD 'reader';
  ELSE
    ALTER ROLE datazen_reader WITH LOGIN PASSWORD 'reader';
  END IF;
END
$$;
CREATE SCHEMA IF NOT EXISTS mcp_context;
CREATE TABLE IF NOT EXISTS mcp_context.items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT INTO mcp_context.items (id, name) VALUES (1, 'one'), (2, 'two')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
CREATE OR REPLACE VIEW mcp_context.item_names AS SELECT id, name FROM mcp_context.items;
GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO datazen_reader;
GRANT USAGE ON SCHEMA mcp_context TO datazen_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA mcp_context TO datazen_reader;
`);
  } finally {
    await client.end();
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
