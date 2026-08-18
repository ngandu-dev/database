import type { Connection as DriverConnection } from "../../driver/connection";
import { ParameterBindingStyle } from "../_internal";
import { AbstractSQLiteDriver } from "../abstract-sqlite-driver";
import { SQLite3Connection } from "./connection";
import type { SQLite3ConnectionParams, SQLite3DatabaseLike } from "./types";

export class SQLite3Driver extends AbstractSQLiteDriver {
  public readonly name = "sqlite3";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as SQLite3ConnectionParams;
    const objectClient =
      this.asDatabaseLike(connectionParams.database) ??
      this.asDatabaseLike(connectionParams.connection) ??
      this.asDatabaseLike(connectionParams.client);

    let client = objectClient;
    let ownsClient = Boolean(connectionParams.ownsClient);

    if (client === undefined) {
      const databasePath =
        typeof connectionParams.path === "string"
          ? connectionParams.path
          : typeof connectionParams.database === "string"
            ? connectionParams.database
            : connectionParams.memory === true
              ? ":memory:"
              : undefined;

      if (databasePath !== undefined) {
        client = await this.openSqliteDatabase(databasePath);
        ownsClient = true;
      }
    }

    if (client === undefined) {
      throw new Error(
        "sqlite3 connection requires one of `database`, `path`, `connection`, or `client` in connection params.",
      );
    }

    const connection = new SQLite3Connection(client, ownsClient);
    await connection.query("PRAGMA foreign_keys=ON");
    return connection;
  }

  private asDatabaseLike(value: unknown): SQLite3DatabaseLike | undefined {
    if (value === null || typeof value !== "object") {
      return undefined;
    }

    return value as SQLite3DatabaseLike;
  }

  private async openSqliteDatabase(path: string): Promise<SQLite3DatabaseLike> {
    const sqliteModule = await import("sqlite3");
    const sqlite3 = (sqliteModule.default ?? sqliteModule) as {
      Database: new (
        filename: string,
        callback: (error: Error | null) => void,
      ) => SQLite3DatabaseLike;
    };

    return new Promise<SQLite3DatabaseLike>((resolve, reject) => {
      const db = new sqlite3.Database(path, (error) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(db);
      });
    });
  }
}
