# QueryForge: TypeScript SQL Formatter and Highlighter

![npm](https://img.shields.io/npm/v/@devscast/queryforge?style=flat-square)
![npm](https://img.shields.io/npm/dt/@devscast/queryforge?style=flat-square)
[![CI](https://github.com/devscast/queryforge-ts/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/devscast/queryforge-ts/actions/workflows/ci.yml)
[![Lint](https://github.com/devscast/queryforge-ts/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/devscast/queryforge-ts/actions/workflows/lint.yml)
[![Tests](https://github.com/devscast/queryforge-ts/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/devscast/queryforge-ts/actions/workflows/test.yml)
![GitHub](https://img.shields.io/github/license/devscast/queryforge-ts?style=flat-square)

QueryForge is a TypeScript library for formatting and syntax highlighting SQL queries, It provides a simple API to format, highlight, and compress SQL strings for better readability in both HTML and CLI environments.

## Installation

Using Bun:

```bash
bun add @devscast/queryforge
```

## Usage

### Programmatic API

#### Format (plain text)

Use `NullHighlighter` when you want formatted SQL without ANSI or HTML markup.

```ts
import { NullHighlighter, SqlFormatter } from "@devscast/queryforge";

const query = `
SELECT count(*), \`Column1\`, \`Testing\`, \`Testing Three\`
FROM \`Table1\`
WHERE Column1 = 'testing' AND ((\`Column2\` = \`Column3\` OR Column4 >= NOW()))
GROUP BY Column1 ORDER BY Column3 DESC LIMIT 5,10
`;

const formatter = new SqlFormatter(new NullHighlighter());

console.log(formatter.format(query));
```

#### Highlight only (HTML)

`highlight()` preserves original whitespace and only adds syntax highlighting.

```ts
import { HtmlHighlighter, SqlFormatter } from "@devscast/queryforge";

const formatter = new SqlFormatter(new HtmlHighlighter());

console.log(formatter.highlight("SELECT * FROM users WHERE id = 1"));
```

#### Compress query

`compress()` removes comments and collapses whitespace.

```ts
import { NullHighlighter, SqlFormatter } from "@devscast/queryforge";

const formatter = new SqlFormatter(new NullHighlighter());

const sql = `
-- comment
SELECT /* block comment */ id, name
FROM users
WHERE active = 1
`;

console.log(formatter.compress(sql));
// SELECT id, name FROM users WHERE active = 1
```

#### Convenience functions

```ts
import { compress, format, highlight } from "@devscast/queryforge";

format("select * from users");
highlight("select * from users", "html");
highlight("select * from users", "cli");
compress("select /*x*/ 1");
```

### CLI Usage

The package provides a compiled binary named `sql-forge`.

#### Run in this repo

This script builds first, then runs the compiled CLI:

```bash
bun run sql-forge "select id,name from users where active = 1"
```

#### Run installed binary

```bash
sql-forge "select * from users"
```

#### Read SQL from stdin

```bash
echo "select * from users where id = 1" | sql-forge
```

#### Modes

```bash
sql-forge "select * from users" --format
sql-forge "select * from users" --highlight
sql-forge "select * from users" --compress
```

#### Output styles

```bash
sql-forge "select * from users" --plain
sql-forge "select * from users" --cli
sql-forge "select * from users" --html
```

#### Custom indentation

```bash
sql-forge "select a,b from t" --indent "    "
sql-forge "select a,b from t" --indent "\\t"
```

### Notes

- `SqlFormatter` defaults to a CLI highlighter in Node/CLI environments and HTML highlighting otherwise.
- Use `NullHighlighter` for logs, snapshots, and plain text output.


## Attribution

This project is fully inspired by the architecture and design of `doctrine/sql-formatter`.
QueryForge is an independent TypeScript/Node implementation and is not affiliated with Doctrine.

## Contributors

<a href="https://github.com/devscast/queryforge-ts/graphs/contributors" title="show all contributors">
  <img src="https://contrib.rocks/image?repo=devscast/queryforge-ts" alt="contributors"/>
</a>
