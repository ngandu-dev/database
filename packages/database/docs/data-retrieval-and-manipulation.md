Data Retrieval And Manipulation
===============================

Data Retrieval
--------------

DataZen provides a DBAL-style data access API around Node low-level drivers.
Once you have a `Connection` from `DriverManager`, you can execute SQL directly.

Doctrine/Datazen async note: query execution is async in this Node port, but
`Result` fetch and iterator methods are synchronous once a `Result` has been
created.

```ts
import { DriverManager } from "@devscast/datazen";

const conn = DriverManager.getConnection({
  driver: "mysql2",
  pool, // mysql2/promise pool or compatible client
});

const result = await conn.executeQuery("SELECT * FROM articles");
```

`executeQuery()` returns a `Result` object that you can consume with fetch methods:

```ts
let row = result.fetchAssociative();
while (row !== false) {
  console.log(row.headline);
  row = result.fetchAssociative();
}
```

Dynamic Parameters and Prepared Statements
------------------------------------------

Never interpolate user data directly into SQL strings. Use placeholders and bound values.

DataZen supports both positional (`?`) and named (`:name`) placeholders.
Do not mix both styles in one SQL statement.

```ts
const stmt = await conn.prepare(
  "SELECT * FROM articles WHERE id = ? AND status = ?",
);

stmt.bindValue(1, articleId);
stmt.bindValue(2, status);

const result = await stmt.executeQuery();
```

Named parameters:

```ts
const stmt = await conn.prepare(
  "SELECT * FROM users WHERE name = :name OR username = :name",
);

stmt.bindValue("name", value);
const result = await stmt.executeQuery();
```

Statement API
-------------

`Statement` supports:

- `bindValue(param, value, type?)`
- `setParameters(params, types?)`
- `executeQuery()` (async)
- `executeStatement()` (async)

Unlike Doctrine/PHP, there is no by-reference `bindParam()` equivalent in this port.

Connection Execution API
------------------------

Main low-level methods:

- `prepare(sql)` (async)
- `executeQuery(sql, params?, types?)` (async) for result-set queries
- `executeStatement(sql, params?, types?)` (async) for write/DDL statements (returns affected rows)

Convenience fetch methods on `Connection`:

- `fetchNumeric()` (async)
- `fetchAssociative()` (async)
- `fetchOne()` (async)
- `fetchAllNumeric()` (async)
- `fetchAllAssociative()` (async)
- `fetchAllKeyValue()` (async)
- `fetchAllAssociativeIndexed()` (async)
- `fetchFirstColumn()` (async)
- `iterateNumeric()` (async iterator)
- `iterateAssociative()` (async iterator)
- `iterateKeyValue()` (async iterator)
- `iterateAssociativeIndexed()` (async iterator)
- `iterateColumn()` (async iterator)

Result API
----------

`Result` methods:

- `fetchNumeric()`
- `fetchAssociative()`
- `fetchOne()`
- `fetchAllNumeric()`
- `fetchAllAssociative()`
- `fetchAllKeyValue()`
- `fetchAllAssociativeIndexed()`
- `fetchFirstColumn()`
- `iterateNumeric()`
- `iterateAssociative()`
- `iterateKeyValue()`
- `iterateAssociativeIndexed()`
- `iterateColumn()`
- `rowCount()`
- `columnCount()`
- `getColumnName(index)`
- `free()`

Binding Types
-------------

You can bind:

- `ParameterType` values (scalar DB binding types)
- DataZen type names / type instances (`@devscast/datazen/types`) for value conversion
- `ArrayParameterType` values for list expansion

Type conversion for scalar values is applied by `Connection` before execution.

```ts
import { ParameterType } from "@devscast/datazen";

await conn.executeQuery(
  "SELECT * FROM articles WHERE id = :id",
  { id: 1 },
  { id: ParameterType.INTEGER },
);
```

List of Parameters Conversion
-----------------------------

SQL cannot bind arrays into a single placeholder directly (`IN (?)`).
DataZen ports Doctrine’s list expansion behavior via `ExpandArrayParameters`.

Supported list binding types:

- `ArrayParameterType.INTEGER`
- `ArrayParameterType.STRING`
- `ArrayParameterType.ASCII`
- `ArrayParameterType.BINARY`

```ts
import { ArrayParameterType } from "@devscast/datazen";

const result = await conn.executeQuery(
  "SELECT * FROM articles WHERE id IN (:ids)",
  { ids: [1, 2, 3] },
  { ids: ArrayParameterType.INTEGER },
);
```

Internally this is rewritten to equivalent expanded SQL with flattened parameters.

Driver Binding Style Notes
--------------------------

- MySQL2 driver executes positional bindings.
- PostgreSQL (`pg`) driver executes positional bindings.
- SQLite (`sqlite3`) driver executes positional bindings.
- MSSQL driver executes named bindings.

DataZen normalizes this at `Connection` level so application code can still use
portable placeholder input (named or positional, but not mixed).

Data Manipulation Scope
-----------------------

Currently implemented data manipulation primitives are:

- `executeStatement()`
- prepared statement `executeStatement()`
- `insert(table, data, types?)`
- `update(table, data, criteria, types?)`
- `delete(table, criteria, types?)`

Result iterators are available via `Result#iterate*()`, and `Connection` also
exposes async iterator convenience methods (`for await ... of`) that execute a
query and stream rows from the returned `Result`.
