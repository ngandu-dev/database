# @ngandu-dev/database-mcp

## 1.0.2

### Patch Changes

- Update the locked dependency graph to patched development tools and require quality checks, tests, and a security audit to pass before publishing stable tags. Raise MCP SDK dependency minimums to 2.3.1, update the SQL Server driver dependency to remove sprintf-js, and update the native build dependency on Undici within its supported major version.
- Updated dependencies
  - @ngandu-dev/database@3.0.5

## 1.0.1

### Patch Changes

- Run release automation on stable tag pushes, publish npm packages through trusted publishing, and create GitHub releases with generated notes. Leave prereleases to manual publishing.
- Updated dependencies
  - @ngandu-dev/database@3.0.4

## 1.0.0

### Added

- Added a local stdio MCP server for PostgreSQL, MySQL/MariaDB, SQL Server, and SQLite.
- Added schema discovery, table descriptions, and arbitrary parameterized query execution.
- Added Node.js npm CLI distribution and Bun standalone executable builds.
