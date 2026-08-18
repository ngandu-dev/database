Transactions
============

Datazen `Connection` provides transaction management with:

- `beginTransaction()`
- `commit()`
- `rollBack()`
- `transactional(fn)`

Doctrine/Datazen async note: transaction methods are async in this Node port,
and `transactional(fn)` expects an async callback.

Manual transaction demarcation looks like this:

```ts
await conn.beginTransaction();

try {
  // do work
  await conn.commit();
} catch (error) {
  await conn.rollBack();
  throw error;
}
```

Using transactional()
----------------------

`transactional()` wraps this pattern and guarantees rollback on failure.

```ts
await conn.transactional(async (tx) => {
  // do work with tx
});
```

The callback return value is propagated:

```ts
const one = await conn.transactional(async (tx) => {
  return await tx.fetchOne("SELECT 1");
});
```

Rollback-only State
-------------------

Datazen supports explicit rollback-only markers:

- `setRollbackOnly()`
- `isRollbackOnly()`

If a transaction is marked rollback-only, `commit()` throws
`RollbackOnlyException`.

```ts
await conn.beginTransaction();
conn.setRollbackOnly();
await conn.rollBack();
```

Transaction Nesting
-------------------

Calling `beginTransaction()` inside an active transaction does not start a new
physical transaction. Datazen emulates nesting with savepoints.

- Outer `beginTransaction()` starts the real transaction.
- Nested `beginTransaction()` creates savepoint `DATAZEN_<level>`.
- Nested `commit()` releases the savepoint when supported.
- Nested `rollBack()` rolls back to the savepoint.

Example flow:

```ts
await conn.beginTransaction();      // level 0 -> 1 (real transaction)
await conn.beginTransaction();      // level 1 -> 2 (SAVEPOINT DATAZEN_2)
await conn.rollBack();              // level 2 -> 1 (ROLLBACK TO SAVEPOINT)
await conn.commit();                // level 1 -> 0 (real commit)
```

If the driver does not implement savepoint operations, nested behavior throws
`NestedTransactionsNotSupportedException`.

Driver-level Calls Warning
--------------------------

Avoid bypassing `Connection` transaction APIs by calling transaction methods
directly on native driver clients. Doing so can desynchronize Datazen's
nesting state and break transaction boundaries.

If you need native access, use `getNativeConnection()` carefully and keep
transaction control in `Connection`.

Isolation Levels
----------------

`TransactionIsolationLevel` constants are available:

- `READ_UNCOMMITTED`
- `READ_COMMITTED`
- `REPEATABLE_READ`
- `SERIALIZABLE`

Datazen exposes transaction isolation APIs on `Connection`:

- `await conn.setTransactionIsolation(level)`
- `conn.getTransactionIsolation()`

Platform classes do provide isolation SQL generation:

```ts
import { TransactionIsolationLevel } from "@devscast/datazen";

const platform = conn.getDatabasePlatform();
await conn.executeStatement(
  platform.getSetTransactionIsolationSQL(TransactionIsolationLevel.SERIALIZABLE),
);
```

Default isolation level is available at platform level via
`platform.getDefaultTransactionIsolationLevel()`.

Auto-commit Mode
----------------

Datazen supports Doctrine-style auto-commit mode controls:

- `isAutoCommit()`
- `setAutoCommit(boolean)`

Default mode is enabled. You can disable it globally through `Configuration`
or per connection at runtime.

```ts
const configuration = new Configuration({ autoCommit: false });
const conn = DriverManager.getConnection({ driver: "mysql2", pool }, configuration);

await conn.connect(); // starts a transaction immediately when auto-commit is disabled
```

When auto-commit is disabled:

- connecting opens a transaction automatically;
- committing/rolling back the outermost transaction immediately starts a new one;
- nested savepoint commits/rollbacks do not start a new transaction.

Changing auto-commit mode during an active transaction commits active nesting
transactions to realign state with the new mode.

Error Handling
--------------

Useful transaction-related exceptions include:

- `NoActiveTransactionException`
- `NestedTransactionsNotSupportedException`
- `RollbackOnlyException`
- `DeadlockException`

For retry logic, catch `DeadlockException` (or broader driver exceptions) and
apply your own retry policy at the application level.

Not Implemented
---------------

Remaining parity gaps include:

- `RetryableException` marker interface and lock-wait-timeout-specific exception
