# DataZen: TypeScript Database Abstraction Layer

![npm](https://img.shields.io/npm/v/@devscast/datazen?style=flat-square)
![npm](https://img.shields.io/npm/dt/@devscast/datazen?style=flat-square)
[![Lint](https://github.com/devscast/datazen-ts/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/devscast/datazen-ts/actions/workflows/lint.yml)
[![Tests](https://github.com/devscast/datazen-ts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/devscast/datazen-ts/actions/workflows/test.yml)
[![ci](https://github.com/devscast/datazen-ts/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/devscast/datazen-ts/actions/workflows/ci.yml)
![GitHub](https://img.shields.io/github/license/devscast/datazen-ts?style=flat-square)

DataZen is a TypeScript-first DBAL (Database Abstraction Layer) inspired by Doctrine DBAL.
It targets teams who want SQL-first development with a stable runtime abstraction,
without adopting a full ORM.

## Installation

Using Bun:

```bash
bun add @devscast/datazen mysql2
```

For SQL Server projects:

```bash
bun add @devscast/datazen mssql
```

Other supported runtime drivers include `pg` and `sqlite3`.

`mysql2`, `mssql`, `pg`, and `sqlite3` are optional peer dependencies so
applications control driver versions and only install the runtime adapters they
actually use.

## Documentation

- [Introduction](docs/introduction.md)
- [Doctrine/Datazen Parity Notes](docs/parity-matrix.md)
- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Data Retrieval and Manipulation](docs/data-retrieval-and-manipulation.md)
- [Query Builder](docs/query-builder.md)
- [Types](docs/types.md)
- [Portability](docs/portability.md)
- [Platforms](docs/platforms.md)
- [Transactions](docs/transactions.md)
- [Security](docs/security.md)
- [Known Vendor Issues](docs/known-vendor-issues.md)
- [Supporting Other Databases](docs/supporting-other-databases.md)

## Quick Start (MySQL)

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

const value = await conn.fetchOne("SELECT 1");
```

Doctrine examples are often synchronous (PHP request model). In DataZen/Node,
I/O methods are async (`await` connection/statement/query-builder execution),
while `Result` fetch/iterate methods are synchronous once a result is available.

## Quick Start (SQL Server)

```ts
import sql from "mssql";
import { DriverManager } from "@devscast/datazen";

const pool = await sql.connect({
  database: "mydb",
  options: { encrypt: true, trustServerCertificate: true },
  password: "secret",
  server: "localhost",
  user: "user",
});

const conn = DriverManager.getConnection({
  driver: "mssql",
  pool,
});

const value = await conn.fetchOne("SELECT 1");
```

## Query Builder Example

```ts
const qb = conn
  .createQueryBuilder()
  .select("u.id", "u.email")
  .from("users", "u")
  .where("u.email = :email")
  .setParameter("email", "john@example.com");

const user = await qb.fetchAssociative();
```

## Attribution

This project is fully inspired by the architecture and design of `doctrine/dbal`.
DataZen is an independent TypeScript/Node implementation and is not affiliated with Doctrine.

## Contributors

<a href="https://github.com/devscast/datazen-ts/graphs/contributors" title="show all contributors">
  <img src="https://contrib.rocks/image?repo=devscast/datazen-ts" alt="contributors"/>
</a>
