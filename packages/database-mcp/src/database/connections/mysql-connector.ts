import { type Connection as MySQLConnection } from "mysql2/promise";

import { decodeDatabasePath, normalizeNetworkScheme, parseDatabaseUrl } from "./url";

export async function createMySqlParameters(dsn: string): Promise<Record<string, unknown>> {
  const normalized = normalizeNetworkScheme(dsn, "mysql");
  const url = parseDatabaseUrl(normalized);
  const { createConnection } = await import("mysql2/promise");
  const connection: MySQLConnection = await createConnection(normalized);
  return {
    connection,
    dbname: decodeDatabasePath(url.pathname),
    ownsClient: true,
  };
}
