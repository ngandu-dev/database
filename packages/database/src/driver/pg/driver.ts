import type { Connection as DriverConnection } from "../../driver/connection";
import { ParameterBindingStyle } from "../_internal";
import { AbstractPostgreSQLDriver } from "../abstract-postgresql-driver";
import { PgConnection } from "./connection";
import type { PgConnectionParams } from "./types";

export class PgDriver extends AbstractPostgreSQLDriver {
  public readonly name = "pg";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connectionParams = params as PgConnectionParams;
    const usesPool = connectionParams.pool !== undefined;
    const client = connectionParams.pool ?? connectionParams.connection ?? connectionParams.client;

    if (client === undefined) {
      throw new Error(
        "pg connection requires one of `pool`, `connection`, or `client` in connection params.",
      );
    }

    const ownsClient = Boolean(connectionParams.ownsPool ?? connectionParams.ownsClient);
    return new PgConnection(client, ownsClient, usesPool);
  }
}
