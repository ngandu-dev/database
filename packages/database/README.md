# @ngandu-dev/database

[![npm](https://img.shields.io/npm/v/@ngandu-dev/database)](https://www.npmjs.com/package/@ngandu-dev/database)
[![downloads](https://img.shields.io/npm/dt/@ngandu-dev/database)](https://www.npmjs.com/package/@ngandu-dev/database)
[![Tests](https://github.com/ngandu-dev/database/actions/workflows/test.yml/badge.svg)](https://github.com/ngandu-dev/database/actions/workflows/test.yml)
[![License](https://img.shields.io/npm/l/@ngandu-dev/database)](LICENSE)

A TypeScript database abstraction layer with connections, drivers, platforms, schema tools, portable types, and transactions.

## Features

- MySQL, MariaDB, PostgreSQL, SQLite, and SQL Server drivers
- Query execution, prepared statements, transactions, and read replicas
- Schema inspection and manipulation
- Portable database types, logging middleware, and result conversion
- Query construction through `@ngandu-dev/query-builder`

## Requirements

- Node.js 20 or newer
- One supported database driver for the database you use

## Installation

```sh
bun add @ngandu-dev/database mysql2
```

Use `pg`, `sqlite3`, or `mssql` instead of `mysql2` for another platform.

## Quick start

```ts
import { DriverManager } from "@ngandu-dev/database";

const connection = DriverManager.getConnection({
  driver: "mysql2",
  host: "127.0.0.1",
  database: "app",
  user: "app",
  password: "secret",
});

const users = await connection
  .createQueryBuilder()
  .select("id", "email")
  .from("users")
  .where("active = :active")
  .setParameter("active", true)
  .fetchAllAssociative();
```

## Usage

Detailed guides are available in [`docs/`](docs), including configuration, transactions, platforms, portability, types, and schema support.

## Development

From the monorepo root:

```sh
bun install --frozen-lockfile
bun run --filter @ngandu-dev/database format
bun run --filter @ngandu-dev/database typecheck
```

## Testing

```sh
bun run --filter @ngandu-dev/database test
bun run --filter @ngandu-dev/database test:functional:local
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the repository pull request template.

## Security

Please report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).

## Contributors

<a href="https://github.com/ngandu-dev/database/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ngandu-dev/database" alt="Contributors" />
</a>
