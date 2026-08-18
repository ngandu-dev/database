import { ConnectionException } from "./connection-exception";
import type { DriverExceptionDetails } from "./driver-exception";

export class SavepointsNotSupported extends ConnectionException {
  public static new(details?: Partial<DriverExceptionDetails>): SavepointsNotSupported {
    return new SavepointsNotSupported("Savepoints are not supported by this driver.", {
      driverName: "driver",
      operation: "savepoint",
      ...details,
    });
  }
}
