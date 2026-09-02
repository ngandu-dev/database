import { type ConnectionPool as MSSQLConnectionPool } from "mssql";

import { decodeDatabasePath, normalizeNetworkScheme, parseDatabaseUrl } from "./url";

export async function createSqlServerParameters(dsn: string): Promise<Record<string, unknown>> {
  const url = parseDatabaseUrl(normalizeNetworkScheme(dsn, "mssql"));
  const mssql = await import("mssql");
  const database = decodeDatabasePath(url.pathname);
  const pool: MSSQLConnectionPool = new mssql.ConnectionPool({
    server: url.hostname,
    port: url.port === "" ? 1433 : parsePort(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: database === "" ? undefined : database,
    options: {
      encrypt: readBoolean(url.searchParams.get("encrypt"), true),
      trustServerCertificate: readBoolean(url.searchParams.get("trustServerCertificate"), false),
    },
    connectionTimeout: readPositiveInteger(url.searchParams.get("connectionTimeout")),
    requestTimeout: readPositiveInteger(url.searchParams.get("requestTimeout")),
    pool: { max: 1, min: 0 },
  });
  await pool.connect();
  return { pool, dbname: database, ownsPool: true };
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("The database URL contains an invalid port.");
  }
  return port;
}

function readBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }
  return value === "1" || value.toLowerCase() === "true";
}

function readPositiveInteger(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
