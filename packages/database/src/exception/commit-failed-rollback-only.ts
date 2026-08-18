import { ConnectionException } from "./connection-exception";
import type { DriverExceptionDetails } from "./driver-exception";

export class CommitFailedRollbackOnly extends ConnectionException {
  public static new(details?: Partial<DriverExceptionDetails>): CommitFailedRollbackOnly {
    return new CommitFailedRollbackOnly(
      "Transaction commit failed because the transaction has been marked for rollback only.",
      {
        driverName: "driver",
        operation: "commit",
        ...details,
      },
    );
  }
}
