import { type Client as PgClient } from "pg";

import { decodeDatabasePath, normalizeNetworkScheme, parseDatabaseUrl } from "./url";

export async function createPostgresParameters(dsn: string): Promise<Record<string, unknown>> {
  const normalized = normalizeNetworkScheme(dsn, "postgres");
  const url = parseDatabaseUrl(normalized);
  const { Client } = await import("pg");
  const client: PgClient = new Client({ connectionString: normalized });
  await client.connect();
  return {
    client,
    dbname: decodeDatabasePath(url.pathname),
    ownsClient: true,
  };
}
