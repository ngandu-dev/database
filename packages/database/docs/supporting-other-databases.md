Supporting Other Databases
==========================

To support a database not currently shipped with Datazen, implement the same
core abstractions used by existing adapters.

Current port scope note
-----------------------

Datazen currently focuses on runtime DBAL concerns (driver, connection,
platform, query execution, type conversion), and now includes a partial Schema
module. If you are adding runtime support only, you can ship a driver/platform
without schema-manager parity first.

What to implement
-----------------

For a new driver on an already supported platform, implement:

- `DriverConnection` (`src/driver.ts`)
- `Driver` (`src/driver.ts`)
- driver-specific exception converter (`src/driver/api/*/exception-converter.ts`)

For a new database platform (new vendor/dialect), also implement:

- `AbstractPlatform` subclass (`src/platforms/*`)
- vendor type mappings and SQL generation overrides
- optionally, a vendor `AbstractSchemaManager` subclass (`src/schema/*`) if you
  want schema-introspection parity

Driver/Connection contracts
---------------------------

`DriverConnection` must provide:

- `prepare(sql)` -> `Promise<DriverStatement>`
- `query(sql)` -> `Promise<DriverResult>`
- `exec(sql)` -> `Promise<number | string>`
- `quote(value)` -> `string`
- `lastInsertId()` -> `Promise<number | string>`
- transaction APIs (`beginTransaction`, `commit`, `rollBack`)
- optional savepoint APIs (`createSavepoint`, `releaseSavepoint`, `rollbackSavepoint`)
- `getServerVersion()` (`string | Promise<string>`)
- `close()`
- `getNativeConnection()`

`Driver` must provide:

- `connect(params)` (async)
- `getExceptionConverter()`
- `getDatabasePlatform(versionProvider)`

Note: built-in drivers also expose a `bindingStyle` property used by `Connection`
for placeholder compilation, but this is currently a convention (duck-typed) and
not part of the exported `Driver` interface.

If your driver is named-binding, `Connection` will compile positional SQL
placeholders into named placeholders automatically.

Implementation paths
--------------------

Path A: New driver, existing platform
-------------------------------------

1. Add a new folder under `src/driver/<your-driver>/`.
2. Implement:
   - `connection.ts` (implements `DriverConnection`)
   - `driver.ts` (implements `Driver`)
   - `types.ts` (driver client/pool type contracts)
3. Add exception converter under `src/driver/api/<vendor>/exception-converter.ts`.
4. Register exports in `src/index.ts`.
5. If using a built-in shortcut name, add it to `DriverManager`:
   - `DriverName` union in `src/driver-manager.ts`
   - `DRIVER_MAP` entry in `src/driver-manager.ts`

Path B: New vendor/platform
---------------------------

1. Create `src/platforms/<vendor>-platform.ts` extending `AbstractPlatform`.
2. Implement vendor SQL behavior:
   - limit/offset SQL
   - quoting rules
   - date/time functions and format strings
   - transaction isolation SQL
   - lock hints (if supported)
3. Implement `initializeDatazenTypeMappings()` for DB type -> Datazen type names.
4. Add driver adapter as in Path A and return your platform from
   `Driver#getDatabasePlatform()`.
5. (Optional, schema parity) add a vendor schema manager and return it from the
   platform's `createSchemaManager(connection)` implementation.
6. Export the platform from `src/platforms/index.ts` and `src/index.ts`.

Connection parameters
---------------------

Built-in adapters are pool/client-first. Define clear params shape in your
`src/driver/<vendor>/types.ts`, then validate in `driver.ts` similarly to
existing drivers.

Recommended pattern:

- Accept `pool`, `connection`, or `client` aliases when practical.
- Support ownership flags (`ownsPool` / `ownsClient`) for lifecycle control.

Testing requirements
--------------------

Follow existing parity pattern and add tests at minimum for:

- Driver contract behavior (`src/__tests__/driver/*`)
- Connection adapter execution and transactions (`src/__tests__/driver/*-connection.test.ts`)
- Exception conversion mapping (`src/__tests__/driver/driver-exception-converter.test.ts` style)
- Platform SQL behavior (`src/__tests__/platforms/*`) if adding a platform

If you add parser- or parameter-related behavior, also add tests under:

- `src/__tests__/parameter/*`
- `src/__tests__/sql/*`

Using your custom driver without DriverManager changes
------------------------------------------------------

You can avoid touching `DriverManager` map and pass your driver directly:

```ts
import { DriverManager } from "@devscast/datazen";

const conn = DriverManager.getConnection({
  driverInstance: new CustomDriver(),
  client,
});
```

Or via class:

```ts
const conn = DriverManager.getConnection({
  driverClass: CustomDriver,
  client,
});
```

Dependency guidance
-------------------

For Node adapters, prefer:

- package as peer dependency for runtime driver library
- package installed as dev dependency for local tests/examples

This mirrors current `mysql2` / `mssql` integration strategy.

Contribution checklist
----------------------

- Keep one class/interface per file.
- Keep namespace/folder parity best effort with Doctrine naming.
- Add or update tests for every new behavior.
- Run:
  - `bun run format`
  - `bun run test`
- Add a `CHANGELOG.md` summary entry.
