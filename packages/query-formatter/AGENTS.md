# QueryForge TypeScript

## Rules

- Keep one class/interface per file.
- Validate against Doctrine's test suite where possible, and add any missing tests to this project as needed.
- What is async by nature should be async and awaited - PHP is fully synchronous but Node is not, so embrace async/await where it makes sense and don't try to force sync patterns on async code.
- Run "bun run format", "bun run lint", "bun run typecheck" and "bun run test" before submitting any changes to ensure code quality and test coverage.
- Once validated add a summary of your changes in CHANGELOG.md
