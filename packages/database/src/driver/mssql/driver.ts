import type { Connection as DriverConnection } from "../../driver/connection";
import { ParameterBindingStyle } from "../_internal";
import { AbstractSQLServerDriver } from "../abstract-sqlserver-driver";
import { MSSQLConnection } from "./connection";
import type { MSSQLConnectionParams } from "./types";

export class MSSQLDriver extends AbstractSQLServerDriver {
  public readonly name = "mssql";
  public readonly bindingStyle = ParameterBindingStyle.NAMED;

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as MSSQLConnectionParams;
    const client = connectionParams.pool ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new Error(
        "mssql connection requires one of `pool`, `connection`, or `client` in connection params.",
      );
    }

    const ownsClient = Boolean(connectionParams.ownsPool ?? connectionParams.ownsClient);
    return new MSSQLConnection(client, ownsClient);
  }
}
