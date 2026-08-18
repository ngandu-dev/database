import type { Driver } from "../../../driver";
import type { Connection as DriverConnection } from "../../../driver/connection";
import type { Middleware } from "../../../driver/middleware";
import { AbstractDriverMiddleware } from "../../../driver/middleware/abstract-driver-middleware";

const ENABLE_FOREIGN_KEYS_PRAGMA = "PRAGMA foreign_keys=ON";

class ForeignKeysEnabledDriver extends AbstractDriverMiddleware {
  public override async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    const connection = await super.connect(params);
    await connection.exec(ENABLE_FOREIGN_KEYS_PRAGMA);
    return connection;
  }
}

export class EnableForeignKeys implements Middleware {
  public wrap(driver: Driver): Driver {
    return new ForeignKeysEnabledDriver(driver);
  }
}
