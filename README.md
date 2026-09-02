# Ngandu Database

[![Quality](https://github.com/ngandu-dev/database/actions/workflows/quality.yml/badge.svg)](https://github.com/ngandu-dev/database/actions/workflows/quality.yml)
[![Tests](https://github.com/ngandu-dev/database/actions/workflows/test.yml/badge.svg)](https://github.com/ngandu-dev/database/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/ngandu-dev/database)](LICENSE)

A Bun workspace containing Ngandu's database abstraction, MCP server, SQL query builder, and SQL formatter.

## Packages

| Package | Purpose |
| --- | --- |
| [`@ngandu-dev/database`](packages/database) | Database connections, drivers, platforms, schema, types, and portability. |
| [`@ngandu-dev/database-mcp`](packages/database-mcp) | Local stdio MCP server for database metadata and SQL execution; access is limited by the configured database user. |
| [`@ngandu-dev/query-builder`](packages/query-builder) | Composable SQL query construction with optional database execution. |
| [`@ngandu-dev/query-formatter`](packages/query-formatter) | SQL formatting, compression, highlighting, and CLI support. |

The dependency direction is intentionally one-way: `database-mcp` depends on `database`, `database` depends on `query-builder`, and `query-formatter` remains independent.

## Requirements

- Node.js 20 or newer
- Bun 1.3 or newer

## Development

```sh
bun install --frozen-lockfile
bun run format
bun run quality
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution and release expectations.

## Security

Please report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).

## Contributors

<a href="https://github.com/ngandu-dev/database/graphs/contributors" title="Show all contributors">
  <img src="https://contrib.rocks/image?repo=ngandu-dev/database" alt="Contributors" />
</a>
