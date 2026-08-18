import { Configuration } from "./configuration";
import { Connection } from "./connection";
import {
  PrimaryReadReplicaConnection,
  type PrimaryReadReplicaConnectionParams,
} from "./connections/primary-read-replica-connection";
import type { Driver } from "./driver";
import { MSSQLDriver } from "./driver/mssql/driver";
import { MySQL2Driver } from "./driver/mysql2/driver";
import { PgDriver } from "./driver/pg/driver";
import { SQLite3Driver } from "./driver/sqlite3/driver";
import { DriverRequired } from "./exception/driver-required";
import { UnknownDriver } from "./exception/unknown-driver";

export type DriverName = "mysql2" | "mssql" | "pg" | "sqlite3";

export interface ConnectionParams extends Record<string, unknown> {
  driver?: DriverName;
  driverClass?: new () => Driver;
  driverInstance?: Driver;
  wrapperClass?: new (
    params: Record<string, unknown>,
    driver: Driver,
    configuration?: Configuration,
  ) => Connection;
}

export class DriverManager {
  private static readonly DRIVER_MAP: Record<DriverName, new () => Driver> = {
    mssql: MSSQLDriver,
    mysql2: MySQL2Driver,
    pg: PgDriver,
    sqlite3: SQLite3Driver,
  };

  public static getConnection(
    params: ConnectionParams,
    configuration: Configuration = new Configuration(),
  ): Connection {
    const driver = DriverManager.createDriver(params);

    const WrapperClass = params.wrapperClass ?? Connection;
    return new WrapperClass(params, driver, configuration);
  }

  public static getPrimaryReadReplicaConnection(
    params: PrimaryReadReplicaConnectionParams,
    configuration: Configuration = new Configuration(),
  ): PrimaryReadReplicaConnection {
    const driver = DriverManager.createDriver(params);

    return new PrimaryReadReplicaConnection(params, driver, configuration);
  }

  public static getAvailableDrivers(): DriverName[] {
    return Object.keys(DriverManager.DRIVER_MAP) as DriverName[];
  }

  private static createDriver(params: ConnectionParams): Driver {
    if (params.driverInstance !== undefined) {
      return params.driverInstance;
    }

    if (params.driverClass !== undefined) {
      return new params.driverClass();
    }

    if (params.driver === undefined) {
      throw DriverRequired.new();
    }

    const DriverClass = DriverManager.DRIVER_MAP[params.driver];
    if (DriverClass === undefined) {
      throw UnknownDriver.new(params.driver, Object.keys(DriverManager.DRIVER_MAP));
    }

    return new DriverClass();
  }
}
