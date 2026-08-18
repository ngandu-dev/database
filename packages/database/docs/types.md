Types
=====

DataZen includes a Doctrine-inspired type system for translating values between
Node.js runtime values and database representations.

In this port, conversion methods are named for Node:

- `convertToDatabaseValue(value, platform)`
- `convertToNodeValue(value, platform)`

Type instances are flyweights and are managed by a global registry.

Type Registry and Flyweights
----------------------------

Types are resolved through `Type` static APIs:

```ts
import { Type, Types } from "@devscast/datazen/types";

const integerType = Type.getType(Types.INTEGER);
```

Key APIs:

- `Type.getType(name)`
- `Type.hasType(name)`
- `Type.addType(name, typeOrCtor)`
- `Type.overrideType(name, typeOrCtor)`
- `Type.getTypeRegistry()`

The registry enforces invariants:

- Type names must be unique
- Type instances must not be registered under multiple names

Built-in Types
--------------

Built-ins are registered from the `@devscast/datazen/types` namespace and available via `Types` constants.

Numeric:

- `smallint`
- `integer`
- `bigint`
- `decimal`
- `number`
- `smallfloat`
- `float`

String / text / identifier:

- `string`
- `ascii_string`
- `text`
- `guid`
- `enum`

Binary:

- `binary`
- `blob`

Boolean:

- `boolean`

Date / time:

- `date`
- `date_immutable`
- `datetime`
- `datetime_immutable`
- `datetimetz`
- `datetimetz_immutable`
- `time`
- `time_immutable`
- `dateinterval`

Array / JSON:

- `simple_array`
- `json`
- `json_object`
- `jsonb`
- `jsonb_object`

Notes for this port:

- Immutable date/time variants currently reuse the same JS `Date` runtime type.
- `json_object` and `jsonb_object` currently map to the same conversion behavior as
  `json` and `jsonb`.
- `number` is string-based at runtime for precision-safe transport.

Additional non-registered type classes are also available for specific use
cases:

- `VarDateTimeType`
- `VarDateTimeImmutableType`

Using Types in Query Execution
------------------------------

You can pass type names, `Type` instances, or low-level `ParameterType` values.

```ts
import { DriverManager, ParameterType } from "@devscast/datazen";

const conn = DriverManager.getConnection({ driver: "mysql2", pool });

const row = await conn.fetchAssociative(
  "SELECT * FROM articles WHERE id = :id AND published = :published",
  { id: 1, published: true },
  { id: ParameterType.INTEGER, published: ParameterType.BOOLEAN },
);
```

Using Doctrine-style type names:

```ts
await conn.executeQuery(
  "SELECT * FROM logs WHERE created_at > :date",
  { date: new Date() },
  { date: "datetime" },
);
```

Platform Interaction
--------------------

Types delegate SQL declaration details to the active platform. For example,
`DateTimeType` asks the platform for its date-time format and declaration SQL.

Database-type mapping APIs on platforms:

- `registerDatazenTypeMapping(dbType, datazenType)`
- `hasDatazenTypeMappingFor(dbType)`
- `getDatazenTypeMapping(dbType)`

These are the Node/DataZen equivalent of Doctrine's DB type mapping hooks.

Custom Types
------------

Create a custom type by extending `Type` and registering it.

```ts
import { AbstractPlatform } from "@devscast/datazen/platforms";
import { Type } from "@devscast/datazen/types";

class MoneyType extends Type {
  public getSQLDeclaration(
    _column: Record<string, unknown>,
    _platform: AbstractPlatform,
  ): string {
    return "DECIMAL(18, 3)";
  }

  public convertToDatabaseValue(value: unknown): string | null {
    if (value === null) {
      return null;
    }

    return String(value);
  }

  public convertToNodeValue(value: unknown): string | null {
    if (value === null) {
      return null;
    }

    return String(value);
  }
}

Type.addType("money", MoneyType);
```

Then map database column types to your custom type on the platform:

```ts
const platform = conn.getDatabasePlatform();
platform.registerDatazenTypeMapping("mymoney", "money");
```

Error Model
-----------

Type and conversion failures throw typed exceptions from `@devscast/datazen/types`,
including:

- `UnknownColumnType`
- `InvalidType`
- `InvalidFormat`
- `SerializationFailed`
- `ValueNotConvertible`
- `TypeAlreadyRegistered`
- `TypeNotFound`
- `TypeNotRegistered`

Scope Note
----------

Schema support is available separately under `@devscast/datazen/schema`.
This page focuses on the runtime type system rather than schema
reverse-engineering workflows.
