# @ngandu-dev/query-formatter

[![npm](https://img.shields.io/npm/v/@ngandu-dev/query-formatter)](https://www.npmjs.com/package/@ngandu-dev/query-formatter)
[![downloads](https://img.shields.io/npm/dt/@ngandu-dev/query-formatter)](https://www.npmjs.com/package/@ngandu-dev/query-formatter)
[![Tests](https://github.com/ngandu-dev/database/actions/workflows/test.yml/badge.svg)](https://github.com/ngandu-dev/database/actions/workflows/test.yml)
[![License](https://img.shields.io/npm/l/@ngandu-dev/query-formatter)](LICENSE)

Format, compress, and highlight SQL in TypeScript, Node.js, or a terminal.

## Features

- Readable SQL formatting
- Compact SQL compression
- Terminal and HTML syntax highlighting
- `sql-forge` command-line interface
- No database or query-builder dependency

## Requirements

- Node.js 20 or newer

## Installation

```sh
bun add @ngandu-dev/query-formatter
```

## Quick start

```ts
import { compress, format, highlight } from "@ngandu-dev/query-formatter";

format("SELECT id,name FROM users WHERE active=1");
compress("SELECT id, name\nFROM users");
highlight("SELECT * FROM users");
```

## Usage

Use the lower-level `SqlFormatter`, `HtmlHighlighter`, `CliHighlighter`, or `NullHighlighter` classes when you need explicit output control.

```sh
bunx sql-forge ./query.sql
```

## Development

```sh
bun run --filter @ngandu-dev/query-formatter format
bun run --filter @ngandu-dev/query-formatter typecheck
```

## Testing

```sh
bun run --filter @ngandu-dev/query-formatter test
```

## Contributing

See the repository [contributing guide](../../CONTRIBUTING.md), [Code of Conduct](../../CODE_OF_CONDUCT.md), and pull request template.

## Security

Please report vulnerabilities privately according to the repository [security policy](../../SECURITY.md).

## License

Released under the [MIT License](LICENSE).

## Contributors

<a href="https://github.com/ngandu-dev/database/graphs/contributors" title="Show all contributors">
  <img src="https://contrib.rocks/image?repo=ngandu-dev/database" alt="Contributors" />
</a>
