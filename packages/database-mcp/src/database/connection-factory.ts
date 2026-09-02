import { DriverManager } from "@ngandu-dev/database";

import { createMySqlParameters } from "./connections/mysql-connector";
import type { OwnedDatabaseConnection } from "./connections/owned-database-connection";
import { createPostgresParameters } from "./connections/postgres-connector";
import { createSqliteParameters } from "./connections/sqlite-connector";
import { createSqlServerParameters } from "./connections/sqlserver-connector";
import { driverForDsn } from "./connections/supported-driver";

export { driverForDsn } from "./connections/supported-driver";

export async function createOwnedConnection(dsn: string): Promise<OwnedDatabaseConnection> {
  const driver = driverForDsn(dsn);
  const params =
    driver === "pg"
      ? await createPostgresParameters(dsn)
      : driver === "mysql2"
        ? await createMySqlParameters(dsn)
        : driver === "mssql"
          ? await createSqlServerParameters(dsn)
          : await createSqliteParameters(dsn);

  const connection = DriverManager.getConnection({ driver, ...params });
  try {
    await connection.connect();
    await connection.createSchemaManager();
    return { connection, driver };
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw error;
  }
}
