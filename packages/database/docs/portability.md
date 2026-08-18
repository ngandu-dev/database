Portability
===========

If your code must run across multiple database vendors, behavior can differ in
subtle ways (result values, casing, SQL dialect support, parameter styles,
type semantics, etc.).

DataZen ports Doctrine-style portability handling through dedicated layers.

What Portability Covers
-----------------------

The portability middleware currently targets result normalization concerns:

- Empty string to `null` conversion
- Right-trim of string values
- Column name case normalization (lower/upper)

Exposed via the `@devscast/datazen/portability` namespace (`Middleware`, `Driver`, `Connection`, `Converter`).

Connection Wrapper
------------------

Configure portability via middleware in `Configuration`.

```ts
import {
  ColumnCase,
  Configuration,
  DriverManager,
} from "@devscast/datazen";
import * as Portability from "@devscast/datazen/portability";

const configuration = new Configuration().addMiddleware(
  new Portability.Middleware(
    Portability.Connection.PORTABILITY_ALL,
    ColumnCase.LOWER,
  ),
);

const conn = DriverManager.getConnection(
  { driver: "mssql", pool },
  configuration,
);
```

Flags exposed by `Portability.Connection`:

- `PORTABILITY_NONE`
- `PORTABILITY_RTRIM`
- `PORTABILITY_EMPTY_TO_NULL`
- `PORTABILITY_FIX_CASE`
- `PORTABILITY_ALL`

Performance Note
----------------

Portability conversions process rows/columns in userland, so they add overhead.
Enable only the flags you need.

Platform Layer
--------------

SQL portability is handled separately by platform classes (`@devscast/datazen/platforms`):

- SQL function and expression generation
- limit/offset adaptation
- quoting and vendor-specific SQL behavior
- type mapping metadata

Use platform helpers instead of hardcoding vendor-specific SQL when portability
matters.

Platform Optimizations
----------------------

`OptimizeFlags` from `@devscast/datazen/portability` applies vendor-specific optimization masks.
Example: Oracle already treats empty strings specially, so the
`EMPTY_TO_NULL` portability flag is masked out for Oracle.

Keyword Lists
-------------

Doctrine exposes vendor keyword lists through schema-related APIs.
In this port, keyword lists are available through platform APIs such as
`platform.getReservedKeywordsList()` and the `@devscast/datazen/platforms`
namespace keyword classes.

Related Modules
---------------

- Types portability/conversion: `@devscast/datazen/types`
- Parameter style and list expansion portability: `ExpandArrayParameters` from `@devscast/datazen`
- SQL parsing support: `@devscast/datazen/sql`
