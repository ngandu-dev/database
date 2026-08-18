# @devscast/datazen

## Rules
- Keep one class/interface per file.
- Keep folder structure aligned with Doctrine namespaces whenever that namespace exists in this port.
- Use Node-specific names only where Doctrine has no equivalent (for example `driver/mysql2`, `driver/mssql`).
- Validate against Doctrine's test suite where possible, and add any missing tests to this project as needed.
- PHP should be refered as "Node" in code and documentation
- Doctrine should be refered as "Datazen" in code and documentation
- When in doubt, follow Doctrine's implementation and naming conventions as closely as possible, while still adhering to TypeScript best practices and Node idioms.
- When a task is a refactoring, breaking changes are allowed, even full rewrites, refactorings, and reorgs.
- Try to keep 1:1 parity with Doctrine's classes and interfaces as much as possible, but don't be afraid to deviate a bit when it makes sense for TypeScript or Node.
- OCI8,PDO, MySQLI are native to PHP and have no direct equivalent in Node so ignore any references to those in Doctrine.
- mysql2, mssql, pg, sqlite3 are node drivers that have some similarities to PDO drivers but are not direct ports, so treat them as their own unique implementations and only borrow concepts and patterns from Doctrine where it makes sense.
- What is async by nature should be async and awaited - PHP is fully synchronous but Node is not, so embrace async/await where it makes sense and don't try to force sync patterns on async code.

## Validation
- Run "bun run format", "bun run lint", "bun run typecheck" and "bun run test" before submitting any changes to ensure code quality and test coverage.
- Once validated add a summary of your changes in CHANGELOG.md
