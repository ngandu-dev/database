# @ngandu-dev/query-builder

## 2.0.0 - Unreleased

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
