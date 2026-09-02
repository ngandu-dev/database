# @ngandu-dev/database-mcp

[![npm](https://img.shields.io/npm/v/@ngandu-dev/database-mcp)](https://www.npmjs.com/package/@ngandu-dev/database-mcp)
[![downloads](https://img.shields.io/npm/dt/@ngandu-dev/database-mcp)](https://www.npmjs.com/package/@ngandu-dev/database-mcp)
[![Tests](https://github.com/ngandu-dev/database/actions/workflows/test.yml/badge.svg)](https://github.com/ngandu-dev/database/actions/workflows/test.yml)
[![License](https://img.shields.io/npm/l/@ngandu-dev/database-mcp)](LICENSE)

A local stdio [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes database metadata and SQL execution to coding agents through `@ngandu-dev/database`.

> [!WARNING]
> This MCP server is not inherently read-only. It gives an agent the full database access granted to the configured account. For safer use, configure a dedicated database user with only metadata visibility and `SELECT` privileges.

Each process connects to one PostgreSQL, MySQL/MariaDB, SQL Server, or SQLite database. Configure a separate MCP server entry for each additional database.

## Features

- Database, schema, table, and view discovery
- Detailed column, index, primary key, and foreign key metadata
- Parameterized SQL execution with structured MCP results
- PostgreSQL, MySQL/MariaDB, SQL Server, and SQLite support
- Local stdio transport for Codex and other MCP clients
- Node.js npm command and standalone Bun executables

## Requirements

- Node.js 20.17 or newer for the npm command
- A supported database and connection URL
- A dedicated read-only database user for safer network database access

## Installation

```sh
npm install --global @ngandu-dev/database-mcp
```

The package installs one command:

```sh
ngandu-database-mcp --help
```

## Quick start

Set `DATABASE_URL`, then validate the connection without starting the MCP transport:

```sh
export DATABASE_URL='file:///absolute/path/to/database.sqlite'
ngandu-database-mcp --check
```

The server starts over stdio when no informational or validation flag is supplied:

```sh
ngandu-database-mcp
```

Keep stdout reserved for MCP protocol messages. Server diagnostics are written to stderr.

## Usage

### Connection URLs

Connection URLs are accepted only through an environment variable. The default variable is `DATABASE_URL`; select another name with `--database-url-env`.

Supported URL schemes are:

- PostgreSQL: `postgres`, `postgresql`, `pg`
- MySQL/MariaDB: `mysql`, `mysql2`, `mariadb`
- SQL Server: `mssql`, `sqlserver`
- SQLite: `sqlite`, `sqlite3`, `file`

Do not put a connection URL in command arguments, source control, or a committed Codex configuration.

### Codex integration

Use a project-scoped `.codex/config.toml` and forward the credential from the launching environment:

```toml
[mcp_servers.database]
command = "/absolute/path/to/ngandu-database-mcp"
args = ["--database-url-env", "DATABASE_URL"]
env_vars = ["DATABASE_URL"]
startup_timeout_sec = 15
tool_timeout_sec = 60
default_tools_approval_mode = "writes"
```

The metadata tools advertise `readOnlyHint`. `execute_query` deliberately does not, so the `writes` approval mode prompts before arbitrary SQL is sent. This prompt is not a substitute for a read-only database user.

Verify registration with `codex mcp list` or `/mcp` in an interactive Codex session.

For multiple databases, add entries with distinct names and environment variables:

```toml
[mcp_servers.reporting_database]
command = "/absolute/path/to/ngandu-database-mcp"
args = ["--database-url-env", "REPORTING_DATABASE_URL"]
env_vars = ["REPORTING_DATABASE_URL"]

[mcp_servers.audit_database]
command = "/absolute/path/to/ngandu-database-mcp"
args = ["--database-url-env", "AUDIT_DATABASE_URL"]
env_vars = ["AUDIT_DATABASE_URL"]
```

### Tools

- `get_database_info` returns the driver, database, server version, capabilities, and result limits.
- `list_databases` and `list_schemas` return visible names or `{ "supported": false }`.
- `list_tables` and `list_views` return qualified names with an optional schema filter.
- `describe_table` returns columns, Datazen types, comments, keys, indexes, foreign keys, and platform options.
- `execute_query` sends unchanged SQL with positional or named parameters and an optional output row limit.

All tools return JSON text and structured content. Big integers become decimal strings, dates become ISO strings, and binary values use `{ "$binary": "...", "encoding": "base64" }`. Query rows are numeric arrays accompanied by a separate column list, preserving duplicate column names.

## Native executables

Releases include unsigned executables for macOS arm64/x64, Linux arm64/x64, and Windows x64. Verify an archive against the release `SHA256SUMS` file before extracting it:

```sh
shasum -a 256 -c SHA256SUMS
```

On macOS, unsigned downloads may be quarantined by Gatekeeper. Inspect the checksum and release provenance before deciding whether to remove the quarantine attribute. Initial releases are not signed or notarized.

## Development

From the monorepo root:

```sh
bun install --frozen-lockfile
bun run --filter @ngandu-dev/database-mcp format
bun run --filter @ngandu-dev/database-mcp typecheck
bun run --filter @ngandu-dev/database-mcp build
bun run --filter @ngandu-dev/database-mcp compile
```

The npm command is an ESM Node.js CLI built with tsup. The standalone executable is built with Bun and embeds the installed platform-specific `sqlite3` Node-API addon, preserving the same `sqlite3` interface used by `@ngandu-dev/database`. Dotenv and bunfig autoloading are disabled in compiled executables so secrets come only from the explicit process environment.

## Testing

```sh
bun run --filter @ngandu-dev/database-mcp test
bun run --filter @ngandu-dev/database-mcp test:coverage
```

Vendor protocol tests use the dedicated connection URLs documented in the test suite and remain skipped when those variables are not configured.

## Contributing

See the repository [contributing guide](../../CONTRIBUTING.md), [Code of Conduct](../../CODE_OF_CONDUCT.md), and pull request template.

## Security

Database permissions are the authoritative safety boundary. `execute_query` sends SQL to the database unchanged: the server does not parse, classify, rewrite, or reject statements. It can insert, update, delete, alter, or drop data and schema objects when the configured account has permission.

Create a dedicated database user with only the minimum metadata visibility and `SELECT` privileges required for the target database. Use that account exclusively for this MCP server. Never configure an application owner, migration user, administrator, root account, or any other write-capable credential.

SQLite files are opened through `sqlite3` with `OPEN_READONLY`. For network databases, the server cannot prove that an account is read-only. MCP approval prompts provide an additional confirmation step, but they do not restrict database permissions.

The default 200-row response limit and immutable 1000-row ceiling limit MCP output only; they do not reduce database work. Configure statement timeouts and cancellation with the database vendor or client when required.

Please report vulnerabilities privately according to the repository [security policy](../../SECURITY.md).

## License

Released under the [MIT License](LICENSE).

## Contributors

<a href="https://github.com/ngandu-dev/database/graphs/contributors" title="Show all contributors">
  <img src="https://contrib.rocks/image?repo=ngandu-dev/database" alt="Contributors" />
</a>
