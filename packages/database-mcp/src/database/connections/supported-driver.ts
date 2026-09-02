import { type DriverName } from "@ngandu-dev/database";

import { readDsnScheme } from "./url";

const DRIVER_BY_SCHEME: Record<string, DriverName> = {
  file: "sqlite3",
  mariadb: "mysql2",
  mssql: "mssql",
  mysql: "mysql2",
  mysql2: "mysql2",
  pg: "pg",
  postgres: "pg",
  postgresql: "pg",
  sqlite: "sqlite3",
  sqlite3: "sqlite3",
  sqlserver: "mssql",
};

export function driverForDsn(dsn: string): DriverName {
  const scheme = readDsnScheme(dsn);
  const driver = DRIVER_BY_SCHEME[scheme];
  if (driver === undefined) {
    throw new Error(
      `Unsupported database URL scheme "${scheme}". Supported schemes: ${Object.keys(DRIVER_BY_SCHEME).join(", ")}.`,
    );
  }
  return driver;
}
