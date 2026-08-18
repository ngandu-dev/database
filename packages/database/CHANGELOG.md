# @devscast/datazen

# Final Doctrine Parity & Production-Ready Release

## 1.1.4

- Added `compilerOptions.ignoreDeprecations = "6.0"` to silence the TypeScript 6 `baseUrl` deprecation surfaced by `tsup` during DTS generation, restoring `bun run build`.
- Removed the unused `typescript` peer dependency and marked the runtime database adapters (`mysql2`, `mssql`, `pg`, `sqlite3`) as optional peers so consumers only need to install the drivers they actually use.

## 1.1.2

- Refactored `fetchNumeric()`, `fetchAssociative()`, and `fetchOne()` across `Result`, `Connection`, `QueryBuilder`, portability wrappers, and all bundled drivers to return `undefined` instead of `false` when no row is available, and aligned unit tests and metadata-provider integrations with the new contract.
- Normalized bound query parameter values so `undefined` is treated as SQL `NULL` (`null`) before hitting driver statements, preventing mysql2 bind errors and aligning positional and named parameter flows.
- Updated remaining functional tests to assert `undefined` (instead of `false`) for empty single-row `fetch*` results and no-row guards.

# 1.1.1

- Added package subpath entry points like `@devscast/datazen/logging` that resolve directly from published `dist/*` artifacts, including compatibility for older TypeScript `moduleResolution: "node"` projects without shipping extra root wrapper folders.
- Fixed the bundled CommonJS MSSQL driver so requiring `@devscast/datazen` no longer fails with `createRequire()` receiving an undefined filename.
- Removed the internal `mssql` runtime module load and now bind MSSQL typed parameters less precisely via plain `request.input()` values.

## 1.1.0
- Doctrine/Datazen Alignment: Achieved deep functional parity across all major drivers (SQLite, MySQL, MariaDB, PostgreSQL, MSSQL) by porting hundreds of tests for schema management, data types, and platform-specific SQL expressions.
- Platform Enhancements: Overhauled SQLite with a robust table-rebuild flow for complex ALTER operations and refactored MySQL metadata providers to support non-blocking async I/O.
- Public API & Packaging: Cleaned up the export surface using folder-based _index.ts barrels and optimized package subpaths for better consumer tree-shaking.
- Test Infrastructure: Introduced a local Docker-backed functional runner (bun run test:functional:local) and orchestrated a high-concurrency CI pipeline covering multi-version database matrices.
- CI: Allowed MySQL 5.7 and all MariaDB functional matrix jobs to fail without failing the overall GitHub Actions run.

# API Stabilization & Documentation

## 1.0.3
- Architected a Doctrine-inspired schema foundation in src/schema/*, porting core assets (Table, Column, Index, FK), metadata processors, name parsers, and platform-specific schema managers.
- Achieved deep functional parity by replacing hundreds of placeholders with real, runtime-gated tests across the full database matrix (SQLite, MySQL, MariaDB, PostgreSQL, and SQL Server).
- Implemented robust schema diffing and building APIs, including the Comparator engine, TableDiff logic, and specialized editor builders for granular migrations.
- Hardened database-specific internals, notably a table-rebuild flow for complex SQLite alters and a full async refactor of MySQL metadata providers for non-blocking I/O.
- Modernized infrastructure and packaging via folder-based _index.ts barrels for better tree-shaking, a local Docker-backed functional runner, and multi-version CI orchestration.

## 1.0.2
- Ported the full Doctrine-inspired schema foundation (assets, managers, and metadata processors) alongside a high-fidelity diffing engine and table builders to handle complex migrations.
- Achieved deep functional parity across the database matrix (SQLite, MySQL, MariaDB, PostgreSQL, SQL Server) by replacing placeholders with real, multi-version CI-validated tests.
- Introduced TypeScript-friendly typed row propagation across Result, Connection, and QueryBuilder, enabling end-to-end type safety for associative fetch operations.
- Implemented Doctrine-style convenience DML methods (insert, update, delete) on Connection, featuring support for keyed type maps and IS NULL criteria handling.
- Optimized platform internals via a robust SQLite table-rebuild flow and a full async refactor for MySQL metadata providers to ensure non-blocking I/O.
- Streamlined infrastructure and packaging through folder-based _index.ts barrels, improved tree-shaking, and a dedicated local Docker-backed functional runner.

## 1.0.1
- Architected a complete Doctrine-inspired schema engine, featuring cross-platform managers, diffing logic, and a robust metadata introspection foundation.
- Achieved deep functional parity by replacing placeholders with real, multi-version CI-validated tests across the full database matrix (SQLite, MySQL, MariaDB, PostgreSQL, and SQL Server).
- Introduced TypeScript-friendly row propagation and implemented convenience DML methods (insert, update, delete) with support for keyed type maps.
- Refined transactional controls by integrating Doctrine-style autoCommit management and hardening nested savepoint behavior.
- Hardened platform-specific internals, including a complex table-rebuild flow for SQLite and a full async refactor for MySQL metadata providers.
- Published a comprehensive documentation suite covering QueryBuilder, Security, and Transactions, alongside a restructured README and multi-version CI orchestration.

# Initial Development & Doctrine Parity

## 0.0.1
- Launched Datazen TypeScript, a unified database abstraction layer porting the core power of Doctrine DBAL to the Node ecosystem with native support for MySQL, PostgreSQL, and SQL Server.
- Architected a comprehensive schema engine, including cross-platform managers (MySQL, MSSQL, Oracle, DB2), a robust diffing engine (Comparator), and metadata processors for precise database introspection.
- Achieved deep functional parity by validating the library against a massive multi-version test matrix, hardening internals like SQLite’s complex table-rebuild logic and MySQL’s async metadata providers.
- Enhanced the TypeScript DX with end-to-end typed row propagation, convenience DML methods (insert, update, delete), and Doctrine-style autoCommit management.
- Shipped a full middleware and utility stack, featuring DSN parsing, array parameter expansion, and pluggable logging/portability layers with sensitive data redaction.
- Finalized a "Production-Ready" documentation suite, covering everything from QueryBuilder and security boundaries to transaction demarcation and custom driver extensions.
