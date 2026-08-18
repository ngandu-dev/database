Platforms
=========

Platforms abstract SQL dialect differences and database behavior differences
between vendors.

In most code, you use `Connection` and `QueryBuilder` directly. When you need
vendor-aware SQL generation, quoting, or type mapping logic, access the
platform from the connection.

Getting the Platform
--------------------

```ts
const platform = conn.getDatabasePlatform();
```

`Connection` resolves the platform in this order:

1. `params.platform` when it is an `AbstractPlatform` instance
2. `driver.getDatabasePlatform(versionProvider)` provided by the active driver

Available Platform Classes
--------------------------

Currently implemented in this port:

- `MySQLPlatform`
- `MySQL80Platform`
- `MySQL84Platform`
- `MariaDBPlatform`
- `MariaDB1052Platform`
- `MariaDB1060Platform`
- `MariaDB1010Platform`
- `MariaDB110700Platform`
- `SQLServerPlatform`
- `PostgreSQLPlatform`
- `PostgreSQL120Platform`
- `SQLitePlatform`
- `OraclePlatform`
- `DB2Platform`
- `AbstractMySQLPlatform` (base class)
- `AbstractPlatform` (base class)

Driver defaults:

- `mysql2` driver uses MySQL/MariaDB platform variants (best effort via configured `serverVersion`)
- `mssql` driver uses `SQLServerPlatform`
- `pg` driver uses PostgreSQL platform variants (best effort via configured `serverVersion`)
- `sqlite3` driver uses `SQLitePlatform`

Unlike Doctrine DBAL, full automatic platform detection from a live async server
connection is not implemented yet. Versioned platform selection in Datazen is
best effort and primarily driven by configured `serverVersion` /
`primary.serverVersion`.

What Platforms Are Responsible For
----------------------------------

Platforms encapsulate vendor behavior such as:

- SQL declaration strings for data types
- limit/offset SQL rewriting (`modifyLimitQuery()`)
- identifier and literal quoting helpers
- SQL expression helpers (string, date, math, trim, etc.)
- boolean conversion semantics (`convertBooleansToDatabaseValue()`, `convertFromBoolean()`)
- database type to Datazen type mapping

This keeps SQL generation and type translation portable across drivers.

Type Mapping Hooks
------------------

Platforms expose mapping hooks used by the types subsystem:

- `registerDatazenTypeMapping(dbType, datazenType)`
- `hasDatazenTypeMappingFor(dbType)`
- `getDatazenTypeMapping(dbType)`

These are the Datazen equivalent of Doctrine's DB-type mapping extension points.

Customizing the Platform
------------------------

Option 1: pass a custom platform directly in connection params.

```ts
import { DriverManager } from "@devscast/datazen";
import { MySQLPlatform } from "@devscast/datazen/platforms";

class CustomMySQLPlatform extends MySQLPlatform {
  // override methods as needed
}

const conn = DriverManager.getConnection({
  driver: "mysql2",
  pool,
  platform: new CustomMySQLPlatform(),
});
```

Option 2: override platform through driver middleware.

```ts
import {
  type Driver
  Configuration,
  DriverManager,
} from "@devscast/datazen";
import {
  type Connection as DriverConnection,
  type Middleware as DriverMiddleware,
} from "@devscast/datazen/driver";
import { SQLServerPlatform } from "@devscast/datazen/platforms";

class CustomSQLServerPlatform extends SQLServerPlatform {}

type DriverConnection = Awaited<ReturnType<Driver["connect"]>>;

class PlatformOverridingDriver implements Driver {
  constructor(private readonly inner: Driver) {}

  // Preserve optional binding-style convention for drivers like `mssql`.
  public readonly bindingStyle = (this.inner as { bindingStyle?: unknown }).bindingStyle;

  public async connect(params: Record<string, unknown>): Promise<DriverConnection> {
    return this.inner.connect(params);
  }

  public getExceptionConverter() {
    return this.inner.getExceptionConverter();
  }

  public getDatabasePlatform(_versionProvider: unknown): CustomSQLServerPlatform {
    return new CustomSQLServerPlatform();
  }
}

class PlatformMiddleware implements DriverMiddleware {
  public wrap(driver: Driver): Driver {
    return new PlatformOverridingDriver(driver);
  }
}

const configuration = new Configuration().addMiddleware(new PlatformMiddleware());
const conn = DriverManager.getConnection({ driver: "mssql", pool }, configuration);
```

In this port, `connect()` remains async in custom drivers/middleware wrappers.

Practical Note
--------------

A custom platform is useful when you need vendor-specific SQL optimizations,
custom function expressions, or adjusted type mapping behavior while keeping the
same public DBAL API.

Not Implemented
---------------

Schema-manager-driven platform features are available in this port, but full
Doctrine parity is still incomplete across vendors and version-specific
platform variants and runtime detection behavior.
