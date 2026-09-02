import { parseDatabaseUrl, readDsnScheme } from "./url";

export async function createSqliteParameters(dsn: string): Promise<Record<string, unknown>> {
  const path = sqlitePathFromDsn(dsn);
  if (path === ":memory:") {
    throw new Error("In-memory SQLite databases cannot be opened in read-only mode.");
  }

  const sqliteModule = await import("sqlite3");
  const sqlite3 = sqliteModule.default ?? sqliteModule;
  const client = await new Promise<InstanceType<typeof sqlite3.Database>>((resolve, reject) => {
    const database = new sqlite3.Database(path, sqlite3.OPEN_READONLY, (error) => {
      if (error !== null) {
        reject(error);
        return;
      }
      resolve(database);
    });
  });
  return { client, dbname: path, ownsClient: true, path };
}

function sqlitePathFromDsn(dsn: string): string {
  const scheme = readDsnScheme(dsn);
  const remainder = dsn.slice(dsn.indexOf(":") + 1);

  if (scheme === "file") {
    return decodeURIComponent(parseDatabaseUrl(dsn).pathname);
  }
  if (remainder.startsWith("///")) {
    return decodeURIComponent(remainder.slice(2));
  }
  if (remainder.startsWith("//")) {
    const url = parseDatabaseUrl(dsn);
    const host = url.hostname === "localhost" ? "" : url.hostname;
    return decodeURIComponent(`${host}${url.pathname}`);
  }
  return decodeURIComponent(remainder);
}
