# Contributing

Thank you for contributing to Ngandu projects.

## Before starting

1. Search existing issues and pull requests.
2. Open an issue before beginning a large or breaking change.
3. Keep each pull request focused on one concern.

## Development

Use the runtime and package-manager versions declared by the repository. Install dependencies from the lockfile and do not commit generated build artifacts unless the repository explicitly tracks them.

TypeScript projects use the same commands:

```shell
bun install --frozen-lockfile
bun run format
bun run quality
```

PHP projects use the same commands:

```shell
composer install
composer format
composer quality
```

`format` changes files. Run it before `quality`, which performs the non-modifying checks used by continuous integration.

## Changes and tests

- Add or update tests for observable behavior changes.
- Update documentation and examples when the public API changes.
- TypeScript package changes require a Changeset.
- PHP package changes require an entry under `Unreleased` in `CHANGELOG.md`.
- Breaking changes must include migration instructions.

## Releases

Run `bun run version` to apply pending Changesets, then commit the version and changelog updates.
Push a repository version tag such as `v3.0.3` to publish all unpublished workspace versions, or a
package tag such as `@ngandu-dev/database@3.0.3` to publish only that package. Package tags must match
its committed version; publish changed dependencies first when using package tags.

The `release.yml` workflow validates the workspace, publishes to npm using the configured trusted
publisher, and creates a GitHub release with generated notes. Existing npm versions are skipped on
retries. Releases containing `database-mcp` also receive native executables and checksums.
Prerelease tags and workspace versions are excluded from automatic releases; handle prereleases manually.
Manual retries must select the release tag.

## Commits

Use Conventional Commits, such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `build:`, and `chore:`. Add `!` or a `BREAKING CHANGE:` footer when appropriate.

## Pull requests

Complete the pull request template, ensure every required check passes, and respond to review feedback with focused commits.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

