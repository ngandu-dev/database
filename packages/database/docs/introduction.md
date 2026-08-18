Introduction
============

Datazen is a TypeScript database abstraction layer inspired by Doctrine DBAL.
It provides a portable, object-oriented API for query execution, parameter
binding, transactions, type conversion, and SQL dialect abstraction.

Like Doctrine DBAL, Datazen separates wrapper APIs from concrete drivers through
interfaces, so you can use built-in adapters or implement custom drivers.

Async API note
--------------

Doctrine examples are commonly synchronous. In this Node port, database I/O is
async: `Connection`, `Statement`, and `QueryBuilder` execution methods return
promises and should be awaited. `Result` fetch methods are synchronous after an
`await conn.executeQuery(...)` call returns a `Result`.

Supported Vendors
-----------------

Runtime drivers currently shipped:

- MySQL (via `mysql2`)
- Microsoft SQL Server (via `mssql`)
- PostgreSQL (via `pg`)
- SQLite (via `sqlite3`)

Platform abstractions currently shipped:

- MySQL / MariaDB (including versioned variants)
- SQL Server
- PostgreSQL
- SQLite
- Oracle (platform-only)
- Db2 (platform-only)

For runtime caveats and scope notes, see [Known Vendor Issues](./known-vendor-issues.md).

DBAL-first, ORM-independent
---------------------------

Datazen is a DBAL library and can be used independently from any ORM. It is
built for SQL-first usage and integrates with low-level Node drivers.

Current scope includes:

- `Connection`, `Statement`, `Result` abstractions
- QueryBuilder and SQL parser support
- Type conversion subsystem
- Schema module foundations (`@devscast/datazen/schema`) with ongoing parity work
- Driver middleware (logging, portability)
- DSN parsing

Current limitations:

- Full Doctrine DBAL Schema parity is not complete yet (especially broader reverse-engineering parity and migrations-adjacent workflows).

Getting Started
---------------

Install package and runtime driver dependency:

```bash
bun add @devscast/datazen mysql2
```

Example connection:

```ts
import mysql from "mysql2/promise";
import { DriverManager } from "@devscast/datazen";

const pool = mysql.createPool({
  database: "mydb",
  host: "localhost",
  password: "secret",
  user: "user",
});

const conn = DriverManager.getConnection({
  driver: "mysql2",
  pool,
});
```

From there, use `await executeQuery()`, `await executeStatement()`, and
`createQueryBuilder()`
to build and run SQL through a portable DBAL API.
