Configuration
=============

Getting a Connection
--------------------

Use `DriverManager` to create a `Connection`.

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

`DriverManager.getConnection()` returns a wrapper `Connection` instance.
Creating the wrapper is synchronous; actual database I/O begins when you call an
async connection method (for example `await conn.connect()` or `await conn.executeQuery(...)`).

Using a DSN
-----------------

You can parse a DSN first, then pass the result to `DriverManager`.

```ts
import mysql from "mysql2/promise";
import { DriverManager } from "@devscast/datazen";
import { DsnParser } from "@devscast/datazen/tools";

const parser = new DsnParser();
const params = parser.parse("mysql2://user:secret@localhost/mydb?charset=utf8mb4");

const pool = mysql.createPool({
  database: String(params.dbname),
  host: String(params.host),
  password: String(params.password),
  port: Number(params.port ?? 3306),
  user: String(params.user),
});

const conn = DriverManager.getConnection({
  ...params,
  driver: "mysql2",
  pool,
});
```

Important: built-in drivers need an already-created low-level client (`pool`,
`connection`, or `client`; `sqlite3` may also use `database`). DSN parsing does
not create a driver client.

Driver
------

You can configure the driver in one of three ways:

- `driver`: Built-in driver name.
- `driverClass`: Custom driver class constructor.
- `driverInstance`: Pre-instantiated custom driver object.

Built-in drivers currently available:

- `mysql2`
- `mssql`
- `pg`
- `sqlite3`

There is no `wrapperClass` option in this port.

Connection Parameters
---------------------

Core manager-level params:

- `driver?: "mysql2" | "mssql" | "pg" | "sqlite3"`
- `driverClass?: new () => Driver`
- `driverInstance?: Driver`
- `platform?: AbstractPlatform` (optional platform override)

MySQL2 Driver Params
--------------------

At least one is required:

- `pool`
- `connection`
- `client`

Optional ownership flags:

- `ownsPool?: boolean`
- `ownsClient?: boolean`

MSSQL Driver Params
-------------------

At least one is required:

- `pool`
- `connection`
- `client`

Optional ownership flags:

- `ownsPool?: boolean`
- `ownsClient?: boolean`

PostgreSQL (pg) Driver Params
-----------------------------

At least one is required:

- `pool`
- `connection`
- `client`

Optional ownership flags:

- `ownsPool?: boolean`
- `ownsClient?: boolean`

SQLite3 Driver Params
---------------------

At least one is required:

- `database`
- `connection`
- `client`

Optional ownership flags:

- `ownsClient?: boolean`

Notes:

- Keys like `host`, `port`, `user`, `password`, `dbname` can be present (for
  example from DSN parsing), but built-in drivers execute through the provided
  pool/client object.
- Query parameters parsed from DSN are merged into params as strings.

Connecting using a URL (DSN)
----------------------------

`DsnParser` supports:

- Standard URL decomposition into `driver`, `host`, `port`, `user`, `password`, `dbname`
- URL decoding of credentials/path/query
- Scheme normalization (`pdo-mysql` -> `pdo_mysql`)
- Scheme mapping to built-in driver names or custom `driverClass`
- SQLite path/memory parsing (`path` / `memory`)

Examples:

```ts
import { DsnParser } from "@devscast/datazen/tools";

const parser = new DsnParser({
  custom: CustomDriver, // driverClass mapping
  pdo_mysql: "mysql2",  // alias mapping
});

parser.parse("pdo-mysql://user:secret@localhost/mydb");
parser.parse("custom://user:secret@localhost/mydb");
```

Malformed DSNs throw `MalformedDsnException`.

Middlewares
-----------

Use `Configuration` to attach middlewares before connection creation.

```ts
import {
  ColumnCase,
  Configuration,
  DriverManager,
} from "@devscast/datazen";
import { Middleware as LoggingMiddleware } from "@devscast/datazen/logging";
import {
  Connection as PortabilityConnection,
  Middleware as PortabilityMiddleware,
} from "@devscast/datazen/portability";

const configuration = new Configuration()
  .addMiddleware(new LoggingMiddleware())
  .addMiddleware(
    new PortabilityMiddleware(
      PortabilityConnection.PORTABILITY_RTRIM | PortabilityConnection.PORTABILITY_FIX_CASE,
      ColumnCase.LOWER,
    ),
  );

const conn = DriverManager.getConnection({ driver: "mssql", pool }, configuration);
```

Supported built-in middlewares:

- Logging (`@devscast/datazen/logging`)
- Portability (`@devscast/datazen/portability`)

Auto-commit Default
-------------------

`Configuration` can set the default connection auto-commit mode:

```ts
import { Configuration, DriverManager } from "@devscast/datazen";

const configuration = new Configuration({ autoCommit: false });
const conn = DriverManager.getConnection({ driver: "mysql2", pool }, configuration);
```

When `autoCommit` is `false`, connecting opens a transaction immediately, and
committing/rolling back the outermost transaction starts a new one.

Platform Selection
------------------

Platform resolution order:

1. `params.platform` when provided
2. Driver-provided platform (`mysql2` -> MySQL/MariaDB family, `mssql` -> `SQLServerPlatform`, `pg` -> PostgreSQL family, `sqlite3` -> `SQLitePlatform`)

Version-based platform selection is partially implemented:

- `mysql2` resolves MySQL/MariaDB platform variants from configured `serverVersion` / `primary.serverVersion`
- `pg` resolves PostgreSQL major-version variants from configured `serverVersion` / `primary.serverVersion`
- `mssql` and `sqlite3` currently return fixed platform classes

Unlike Doctrine, full automatic version detection from a live async connection is
not available through the current synchronous `Driver#getDatabasePlatform()`
contract, so unconfigured connections fall back to base platform classes.

Primary / Read-Replica Connection
---------------------------------

Datazen now provides a Doctrine-inspired `PrimaryReadReplicaConnection` wrapper
for routing reads to replicas and writes/transactions to the primary.

Create it through `DriverManager`:

```ts
import { DriverManager } from "@devscast/datazen";

const conn = DriverManager.getPrimaryReadReplicaConnection({
  driver: "mysql2",
  primary: { pool: primaryPool },
  replica: { pool: replicaPool },
});
```

Supported params:

- `primary` (required): connection params object for the primary node
- `replica` (optional): one replica params object
- `replicas` (optional): array of replica params objects

Behavior notes:

- `executeQuery()` reads use a replica by default
- writes (`executeStatement()`) and transactions are routed to primary
- after writing or starting a transaction, reads stick to primary until you
  explicitly call `ensureConnectedToReplica()`
- helper methods: `ensureConnectedToPrimary()`, `ensureConnectedToReplica()`,
  `isConnectedToPrimary()`, `isConnectedToReplica()`

Not Implemented
---------------

- Some Doctrine schema-manager options and wrapper customization patterns outside this port's API shape
- Doctrine-style wrapper class replacement (`wrapperClass`)
