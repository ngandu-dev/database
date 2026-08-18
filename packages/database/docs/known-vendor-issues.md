Known Vendor Issues
===================

This document tracks vendor-specific compatibility caveats for the current
Datazen port.

Scope
-----

Runtime drivers currently implemented:

- MySQL (`mysql2`)
- Microsoft SQL Server (`mssql`)
- PostgreSQL (`pg`)
- SQLite (`sqlite3`)

MariaDB runtime support uses the `mysql2` adapter and selects MariaDB platform
variants when `serverVersion` is configured.

Platform classes also exist for Oracle and Db2, but runtime drivers for those
vendors are not implemented yet in this port.

MySQL / MariaDB (mysql2)
------------------------

DateTimeTz behavior
-------------------

`DateTimeTzType` can carry timezone offsets at conversion level, but platform
SQL declaration for `datetimetz` currently falls back to `datetime` style
(`AbstractPlatform#getDateTimeTzTypeDeclarationSQL()` delegates to
`getDateTimeTypeDeclarationSQL()`).

Practical impact:

- timezone persistence depends on the actual server column type and server version;
- on engines/versions without offset-aware storage semantics, `datetimetz`
  behaves like `datetime`.

Transaction pinning with pools
------------------------------

When a transaction starts, the mysql2 adapter pins a physical connection
(`MySQL2Connection#transactionConnection`) until commit/rollback.

Practical impact:

- long-running transactions can hold pool slots;
- with auto-commit disabled, a transaction is opened immediately on connect and
  outer commit/rollback starts a new one, so the connection remains pinned.

Microsoft SQL Server (mssql)
----------------------------

Single-flight execution per connection
--------------------------------------

SQL Server connections are effectively single-flight for requests. Datazen
serializes request execution in the adapter (`MSSQLConnection#runSerial`).

Practical impact:

- parallel query execution on one physical connection/transaction is not
  available;
- throughput scaling should happen via pool size, not per-connection parallelism.

Savepoint release
-----------------

SQL Server has no explicit savepoint release operation. Datazen's
`releaseSavepoint()` on MSSQL is a no-op.

Practical impact:

- nested transaction commit uses logical nesting in Datazen, but no vendor-side
  savepoint release statement is emitted.

Unique + NULL semantics
-----------------------

SQL Server unique constraints/indexes can behave differently from vendors that
allow multiple `NULL` values in unique columns. Validate this behavior in your
schema design and migration tests.

Date/time precision and parsing
-------------------------------

`SQLServerPlatform` uses microsecond-aware date-time formats for conversion, but
vendor output precision/format can vary by SQL type and configuration.

Practical impact:

- strict parser mismatches can occur for some fractional-second/timezone output
  variants;
- `VarDateTimeType` / `VarDateTimeImmutableType` provide more tolerant parsing
  for datetime-like values and can be registered via `Type.overrideType(...)`.

Oracle (platform-only in current port)
--------------------------------------

Timezone name persistence
-------------------------

As in Doctrine guidance, Oracle timezone-aware values may preserve offset
rather than original timezone name. Treat `DateTimeTz` as offset-based in
round-trips.

Runtime support note
--------------------

No Oracle runtime driver adapter is currently shipped in this port, so behavior
here applies to platform SQL/type logic only.

Db2 (platform-only in current port)
-----------------------------------

DateTimeTz behavior
-------------------

`DateTimeTz` declaration currently follows generic fallback behavior unless
customized at platform/type level.

Runtime support note
--------------------

No Db2 runtime driver adapter is currently shipped in this port, so behavior
here applies to platform SQL/type logic only.

MariaDB variant selection
-------------------------

When `serverVersion` (or `primary.serverVersion`) is provided and identifies a
MariaDB server, the `mysql2` driver selects a MariaDB platform variant class.

Practical impact:

- SQL/type behavior can differ from MySQL-specific defaults when version info is configured;
- without configured version info, Datazen may fall back to a base MySQL platform class.

PostgreSQL (pg)
---------------

Runtime support note
--------------------

The `pg` adapter and PostgreSQL platform classes are shipped in this port,
including best-effort PostgreSQL major-version platform selection when
`serverVersion` is configured.

Coverage note
-------------

This page does not yet catalog PostgreSQL-specific runtime caveats as
comprehensively as MySQL/MSSQL. Validate vendor-specific behavior in integration
tests against your target PostgreSQL version.

SQLite (sqlite3)
----------------

Runtime support note
--------------------

The `sqlite3` adapter and `SQLitePlatform` are shipped in this port.

Coverage note
-------------

This page does not yet catalog SQLite-specific runtime caveats comprehensively.
Validate schema/DDL and type behavior in integration tests against your target
SQLite build/version.

Workarounds and Recommendations
-------------------------------

- Prefer explicit vendor-native column types for timezone-aware data when needed.
- Keep date/time precision consistent across schema and application expectations.
- For tolerant datetime parsing, override types using `Type.overrideType()` and
  `VarDateTimeType` / `VarDateTimeImmutableType` where appropriate.
- Test unique/NULL behavior, timezone round-trips, and transaction concurrency
  constraints in integration tests against your target DB version.
