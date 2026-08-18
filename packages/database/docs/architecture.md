Architecture
============

DataZen keeps the same global architecture idea as Doctrine DBAL: a driver layer
at the bottom and a stable wrapper layer at the top.

This port is TypeScript/Node-first, async, and intentionally does not yet cover
the full Doctrine DBAL feature matrix. A partial Schema module is included and
continues to evolve toward parity.

Layers
------

The runtime is organized into two layers:

- Driver layer (vendor-specific adapters)
- Wrapper layer (portable API used by applications)

Wrapper layer
-------------

The main application-facing components are:

- `Connection`, `Statement`, `Result` (root import: `@devscast/datazen`)

`Connection` orchestrates parameter expansion/compilation, transaction control,
type conversion, exception conversion, and delegates execution to the active
driver connection.

Driver layer
------------

The driver abstraction is centered around:

- `Driver`, `DriverConnection` (`@devscast/datazen/driver`)

Concrete adapters:

- MySQL2, MSSQL, pg, and sqlite3 adapters are exposed through `@devscast/datazen/driver`

Like Datazen/Doctrine, this port keeps separate low-level driver contracts for
`Driver\Connection`, `Driver\Statement`, and `Driver\Result`. The Node port's
main difference is async I/O: driver connection methods such as `prepare()`,
`query()`, and `exec()` return promises to match Node client behavior.

Driver Manager
--------------

`DriverManager` (root import: `@devscast/datazen`) is responsible for:

1. Resolving a driver from params (`driver`, `driverClass`, `driverInstance`)
2. Applying configured middleware in order
3. Returning a wrapper `Connection`

Middlewares
-----------

Middleware decorates the driver stack through `DriverMiddleware`:

- Logging middleware: `@devscast/datazen/logging`
- Portability middleware: `@devscast/datazen/portability`

The middleware pipeline is configured via `Configuration` (root import: `@devscast/datazen`).

Parameter Expansion and SQL Parsing
-----------------------------------

Array/list parameter expansion follows Doctrine's model:

- `ExpandArrayParameters` (root import: `@devscast/datazen`)
- SQL parser + visitor (`@devscast/datazen/sql`)

`Connection` uses this flow to transform SQL and parameters before execution.
For named-binding drivers (MSSQL), positional placeholders are rewritten into
driver-appropriate named placeholders.

Platforms
---------

Platforms provide dialect capabilities and feature flags through
`AbstractPlatform` (from `@devscast/datazen/platforms`) and concrete
implementations (MySQL/MariaDB, PostgreSQL, SQLite, SQL Server, Oracle, Db2).

They are used for SQL dialect behaviors, quoting, date/time and expression
helpers, and type mapping metadata.

Types
-----

The types subsystem (`@devscast/datazen/types`) provides runtime conversion between Node
values and database representations, inspired by Doctrine DBAL Types.

`Connection` integrates this layer when binding and reading typed values.

Query Layer
-----------

The query API (`@devscast/datazen/query`) includes a Doctrine-inspired QueryBuilder and
related expression/query objects. Query generation and execution remain
separated: generated SQL is executed through async `Connection` methods.

Schema Layer (Partial)
----------------------

The schema API (`@devscast/datazen/schema`) is available as a separate module
and includes schema assets, comparators/diffs, editors, schema managers, and
metadata/introspection helpers. Doctrine-level schema parity remains partial.

Exceptions
----------

Exceptions are normalized in `@devscast/datazen/exception`. Driver-specific errors are
translated through per-driver exception converters:

- `MySQLExceptionConverter`, `SQLServerExceptionConverter`, `PostgreSQLExceptionConverter`, and `SQLiteExceptionConverter` from `@devscast/datazen/driver`

Tools
-----

Implemented tooling currently includes:

- `DsnParser` (`@devscast/datazen/tools`)

Not Implemented
---------------

Full Doctrine DBAL parity is not complete in this project yet.
Major gaps include wider driver coverage, cache/result-cache integration, and
some transaction/retryability APIs. Schema support exists, but parity is still
in progress across all Doctrine features and vendors.
