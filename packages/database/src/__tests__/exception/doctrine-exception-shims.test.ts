import { describe, expect, it } from "vitest";

import { CommitFailedRollbackOnly } from "../../exception/commit-failed-rollback-only";
import { ConnectionException } from "../../exception/connection-exception";
import { ConnectionLost } from "../../exception/connection-lost";
import { DatabaseRequired } from "../../exception/database-required";
import { DriverException } from "../../exception/driver-exception";
import { LockWaitTimeoutException } from "../../exception/lock-wait-timeout-exception";
import { NoActiveTransaction } from "../../exception/no-active-transaction";
import { SavepointsNotSupported } from "../../exception/savepoints-not-supported";
import { ServerException } from "../../exception/server-exception";
import { SyntaxErrorException } from "../../exception/syntax-error-exception";
import { TransactionRolledBack } from "../../exception/transaction-rolled-back";

describe("Doctrine exception shims", () => {
  it("provides doctrine-style connection exception factories", () => {
    expect(NoActiveTransaction.new()).toBeInstanceOf(ConnectionException);
    expect(NoActiveTransaction.new().message).toBe("There is no active transaction.");

    expect(CommitFailedRollbackOnly.new()).toBeInstanceOf(ConnectionException);
    expect(CommitFailedRollbackOnly.new().message).toBe(
      "Transaction commit failed because the transaction has been marked for rollback only.",
    );

    expect(SavepointsNotSupported.new()).toBeInstanceOf(ConnectionException);
    expect(SavepointsNotSupported.new().message).toBe(
      "Savepoints are not supported by this driver.",
    );
  });

  it("provides doctrine-style server exception aliases", () => {
    const details = { driverName: "spy", operation: "executeStatement" } as const;

    expect(new ServerException("server", details)).toBeInstanceOf(DriverException);
    expect(new SyntaxErrorException("syntax", details)).toBeInstanceOf(ServerException);
    expect(new LockWaitTimeoutException("timeout", details)).toBeInstanceOf(ServerException);
    expect(new TransactionRolledBack("rolled back", details)).toBeInstanceOf(DriverException);
    expect(new ConnectionLost("lost", details)).toBeInstanceOf(ConnectionException);
  });

  it("provides DatabaseRequired factory", () => {
    expect(DatabaseRequired.new("connect").message).toBe(
      "A database is required for the method: connect.",
    );
  });
});
