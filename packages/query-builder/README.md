# @ngandu-dev/query-builder

[![npm](https://img.shields.io/npm/v/@ngandu-dev/query-builder)](https://www.npmjs.com/package/@ngandu-dev/query-builder)
[![downloads](https://img.shields.io/npm/dt/@ngandu-dev/query-builder)](https://www.npmjs.com/package/@ngandu-dev/query-builder)
[![Tests](https://github.com/ngandu-dev/database/actions/workflows/test.yml/badge.svg)](https://github.com/ngandu-dev/database/actions/workflows/test.yml)
[![License](https://img.shields.io/npm/l/@ngandu-dev/query-builder)](LICENSE)

A composable, database-agnostic SQL query builder for TypeScript and Node.js.

## Features

- SELECT, INSERT, UPDATE, DELETE, UNION, joins, CTEs, grouping, and ordering
- Named and positional parameters
- Vendor-aware limit, locking, and SQL generation
- Synchronous, side-effect-free SQL construction and compilation
- No dependency on `@ngandu-dev/database`

## Requirements

- Node.js 20 or newer

## Installation

```sh
bun add @ngandu-dev/query-builder
```

## Quick start

```ts
import { QueryBuilder } from "@ngandu-dev/query-builder";

const query = new QueryBuilder()
  .select("u.id", "u.email")
  .from("users", "u")
  .where("u.active = :active")
  .setParameter("active", true);

console.log(query.getSQL());
```

## Usage

`QueryBuilder` only constructs SQL and stores parameters. It never opens a connection or executes a query. The default platform emits MySQL-compatible SQL; inject another platform when you need vendor-specific compilation.

```ts
import {
  ConflictResolutionMode,
  MySQL80Platform,
  QueryBuilder,
} from "@ngandu-dev/query-builder";

const query = new QueryBuilder(new MySQL80Platform())
  .select("id")
  .from("jobs")
  .forUpdate(ConflictResolutionMode.SKIP_LOCKED);

console.log(query.getSQL());
// SELECT id FROM jobs FOR UPDATE SKIP LOCKED
```

Use `@ngandu-dev/database` when the builder should be attached to a live connection. Its connected builder extends this class and adds execution and fetch helpers that delegate to `Connection`.

```ts
import { DriverManager } from "@ngandu-dev/database";

const connection = DriverManager.getConnection({ driver: "sqlite3", path: ":memory:" });
const rows = await connection
  .createQueryBuilder()
  .select("id", "name")
  .from("projects")
  .fetchAllAssociative();
```

## Development

```sh
bun run --filter @ngandu-dev/query-builder format
bun run --filter @ngandu-dev/query-builder typecheck
```

## Testing

```sh
bun run --filter @ngandu-dev/query-builder test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the repository pull request template.

## Security

Please report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).

## Contributors

<a href="https://github.com/ngandu-dev/database/graphs/contributors" title="Show all contributors">
  <img src="https://contrib.rocks/image?repo=ngandu-dev/database" alt="Contributors" />
</a>
