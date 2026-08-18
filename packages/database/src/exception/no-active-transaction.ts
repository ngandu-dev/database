import { ConnectionException } from "./connection-exception";
import type { DriverExceptionDetails } from "./driver-exception";

export class NoActiveTransaction extends ConnectionException {
  public static new(details?: Partial<DriverExceptionDetails>): NoActiveTransaction {
    return new NoActiveTransaction("There is no active transaction.", {
      driverName: "driver",
      operation: "transaction",
      ...details,
    });
  }
}
