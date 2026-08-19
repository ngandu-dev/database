# @ngandu-dev/query-builder

## 3.0.2

### Changed

- Made the query builder the canonical owner of query models, binding enums, SQL-builder contracts, and query-specific dialect strategies used by `@ngandu-dev/database`.
- Replaced concrete platform dependencies in the default SELECT and UNION builders with narrow SQL dialect capability interfaces.
- Added version-aware MySQL 8 locking support and aligned DB2 and SQL Server locking SQL with the database package.
- Changed array parameter token values to distinct `ARRAY_*` values so adapters can reliably distinguish arrays from scalar bindings.
- Made `QueryBuilder` a synchronous construction-only API with platform injection; database execution now belongs exclusively to `@ngandu-dev/database`.

### Removed

- Removed `QueryBuilderConnection`, `DefaultQueryBuilderConnection`, `QueryResult`, and all execution and fetch methods from the standalone builder.

### Fixed

- Fixed SQL Server and DB2 `FOR UPDATE` generation in standalone usage.
- Fixed the collision between scalar and array parameter type values.

## 2.0.0

### Changed

- Renamed the package from `@devscast/queryzen` to `@ngandu-dev/query-builder`.
- Adopted the more complete query-builder behavior previously maintained in Datazen.
- Added a small connection contract so database execution remains optional and dependency direction stays one-way.
- Standardized the build, quality, test, documentation, and release configuration.

### Removed

- Removed support for the former package coordinate and legacy named-parameter argument order.

## 1.1.3

- fix audit issues
- bump deps
- fix: minify production dist

## 1.1.0

- Remove `QueryBuilder.upsert` method
- Add `QueryBuilder.insertWith`, `QueryBuilder.updateWith` method
- Add `DB2Platform`, `OraclePlatform`, `SQLServerPlatform` support
- Modify parameter `type` in QueryBuilder.createNamedParameter to be optional
- Refactor use of `UnknownAlias` and `NonUniqueAlias` exceptions instead of `QueryException`

## 1.0.5

- Add support for different placeholder types in `QueryBuilder.upsert` method
- Add `ParameterType`, `ArrayParameterType`, `UnionType`, `ConflictResolutionMode` to exports
- Add `QueryBuilder.upsert` method
- Fix automated release process
- Add project related documents
- a3ea96e: initial release doctrine dbal query builder port for typescript
