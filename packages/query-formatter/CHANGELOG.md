# @ngandu-dev/query-formatter

## 2.0.2

### Patch Changes

- Update the locked dependency graph to patched development tools and require quality checks, tests, and a security audit to pass before publishing stable tags. Raise MCP SDK dependency minimums to 2.3.1, update the SQL Server driver dependency to remove sprintf-js, and update the native build dependency on Undici within its supported major version.

## 2.0.1

### Patch Changes

- Run release automation on stable tag pushes, publish npm packages through trusted publishing, and create GitHub releases with generated notes. Leave prereleases to manual publishing.

## 2.0.0

### Changed

- Renamed the package from `@devscast/queryforge` to `@ngandu-dev/query-formatter`.
- Moved development into the `ngandu-dev/database` monorepo.
- Standardized the build, quality, test, documentation, and release configuration.

### Removed

- Removed support for the former package coordinate. Consumers must update their imports.

## 1.0.0 - Initial release

- Initial TypeScript port of SQL Formatter, based on the latest version of the original PHP project.
- Added support for both HTML and CLI syntax highlighting.
- Updated documentation and examples to reflect TypeScript usage.
