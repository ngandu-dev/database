SQL Query Builder
=================

DataZen provides a Doctrine-inspired SQL Query Builder in `@devscast/datazen/query`.
It builds SQL incrementally and executes through the `Connection` it belongs to.

Doctrine/Datazen async note: builder mutation methods are synchronous, but
execution/fetch helpers perform I/O and therefore return promises in this port.

```ts
import { DriverManager } from "@devscast/datazen";

const conn = DriverManager.getConnection({ driver: "mysql2", pool });
const qb = conn.createQueryBuilder();
```

Security: Preventing SQL Injection
----------------------------------

QueryBuilder is a string builder. Most methods accept raw SQL fragments and
cannot distinguish trusted from untrusted input.

Use placeholders and bind values:

```ts
qb
  .select("id", "name")
  .from("users")
  .where("email = ?")
  .setParameter(0, userInputEmail);
```

For positional parameters in QueryBuilder, numeric indexes start at `0`.

Building Queries
----------------

Supported query shapes:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `UNION`

Examples:

```ts
qb.select("u.id", "u.name").from("users", "u");

qb.insert("users");
qb.update("users");
qb.delete("users");
```

Use `qb.getSQL()` (or `qb.toString()`) to inspect generated SQL.

DISTINCT
--------

```ts
qb.select("name").distinct().from("users");
```

WHERE
-----

```ts
qb
  .select("id", "name")
  .from("users")
  .where("email = ?");
```

- `where()` replaces previous predicate
- `andWhere()` / `orWhere()` append predicates

Table Alias
-----------

```ts
qb
  .select("u.id", "u.name")
  .from("users", "u")
  .where("u.email = ?");
```

GROUP BY / HAVING
-----------------

```ts
qb
  .select("DATE(last_login) as date", "COUNT(id) AS users")
  .from("users")
  .groupBy("DATE(last_login)")
  .having("users > 10");
```

- `groupBy()` replaces
- `addGroupBy()` appends
- `having()`, `andHaving()`, `orHaving()` mirror WHERE behavior

JOIN
----

```ts
qb
  .select("u.id", "u.name", "p.number")
  .from("users", "u")
  .innerJoin("u", "phonenumbers", "p", "u.id = p.user_id");
```

Supported join methods:

- `join()` (alias of `innerJoin()`)
- `innerJoin()`
- `leftJoin()`
- `rightJoin()` (not portable to all databases)

ORDER BY
--------

```ts
qb
  .select("id", "name")
  .from("users")
  .orderBy("username", "ASC")
  .addOrderBy("last_login", "DESC");
```

`order` is raw SQL and must not include untrusted input.

LIMIT / OFFSET
--------------

```ts
qb
  .select("id", "name")
  .from("users")
  .setFirstResult(10)
  .setMaxResults(20);
```

INSERT Values
-------------

```ts
qb
  .insert("users")
  .values({ name: "?", password: "?" })
  .setParameter(0, username)
  .setParameter(1, password);
```

Or per-column:

```ts
qb
  .insert("users")
  .setValue("name", "?")
  .setValue("password", "?");
```

Convenience methods:

- `insertWith(table, data, placeholderMode?)`
- `updateWith(table, data, placeholderMode?)`

UPDATE Set Clause
-----------------

```ts
qb
  .update("users u")
  .set("u.logins", "u.logins + 1")
  .set("u.last_login", "?")
  .setParameter(0, userInputLastLogin);
```

Second argument of `set()` is raw SQL.

UNION
-----

```ts
import { UnionType } from "@devscast/datazen/query";

qb
  .union("SELECT 1 AS field")
  .addUnion("SELECT 2 AS field", UnionType.ALL);
```

CTE (WITH)
----------

```ts
const cte = conn.createQueryBuilder()
  .select("id")
  .from("table_a")
  .where("id = :id");

qb
  .with("cte_a", cte)
  .select("id")
  .from("cte_a")
  .setParameter("id", 1);
```

Expression Builder
------------------

Use `qb.expr()` for composable predicates:

```ts
qb
  .select("id", "name")
  .from("users")
  .where(
    qb.expr().and(
      qb.expr().eq("username", "?"),
      qb.expr().eq("email", "?"),
    ),
  );
```

Binding Helpers
---------------

Create placeholders while binding values:

```ts
qb
  .select("id", "name")
  .from("users")
  .where("email = " + qb.createNamedParameter(userInputEmail));
// :dcValue1, :dcValue2, ...
```

```ts
qb
  .select("id", "name")
  .from("users")
  .where("email = " + qb.createPositionalParameter(userInputEmail));
// ?
```

Execution API
-------------

`QueryBuilder` execution methods:

- `executeQuery()` (async)
- `executeStatement()` (async)
- `fetchAssociative()` (async)
- `fetchNumeric()` (async)
- `fetchOne()` (async)
- `fetchAllNumeric()` (async)
- `fetchAllAssociative()` (async)
- `fetchAllKeyValue()` (async)
- `fetchAllAssociativeIndexed()` (async)
- `fetchFirstColumn()` (async)

Not Implemented
---------------

- Doctrine-style QueryBuilder result cache integration (`enableResultCache()`)
