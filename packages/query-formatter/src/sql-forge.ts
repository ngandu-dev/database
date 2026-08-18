#!/usr/bin/env node

import { CliHighlighter } from "./CliHighlighter";
import { HtmlHighlighter } from "./HtmlHighlighter";
import { NullHighlighter } from "./NullHighlighter";
import { SqlFormatter } from "./SqlFormatter";

type CliOptions = {
  indentString: string;
  mode: "format" | "highlight" | "compress";
  output: "auto" | "plain" | "cli" | "html";
  sqlParts: string[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    indentString: "  ",
    mode: "format",
    output: "auto",
    sqlParts: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--compress") {
      options.mode = "compress";
      continue;
    }

    if (arg === "--highlight") {
      options.mode = "highlight";
      continue;
    }

    if (arg === "--format") {
      options.mode = "format";
      continue;
    }

    if (arg === "--plain") {
      options.output = "plain";
      continue;
    }

    if (arg === "--cli") {
      options.output = "cli";
      continue;
    }

    if (arg === "--html") {
      options.output = "html";
      continue;
    }

    if (arg.startsWith("--indent=")) {
      options.indentString = arg.slice("--indent=".length);
      continue;
    }

    if (arg === "--indent") {
      const next = argv[i + 1];
      if (next !== undefined) {
        options.indentString = next;
        i += 1;
      }
      continue;
    }

    options.sqlParts.push(arg);
  }

  return options;
}

async function readStdin(): Promise<string> {
  if (typeof process === "undefined" || process.stdin.isTTY) {
    return "";
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function resolveFormatter(options: CliOptions): SqlFormatter {
  if (options.output === "plain" || options.mode === "compress") {
    return new SqlFormatter(new NullHighlighter());
  }

  if (options.output === "html") {
    return new SqlFormatter(new HtmlHighlighter());
  }

  if (options.output === "cli") {
    return new SqlFormatter(new CliHighlighter());
  }

  return new SqlFormatter();
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const options = parseArgs(argv);
  const stdin = await readStdin();
  const sql = options.sqlParts.length > 0 ? options.sqlParts.join(" ") : stdin.trimEnd();

  if (sql.length === 0) {
    process.stderr.write(
      'Usage: bun run sql-forge "SELECT * FROM users" [--format|--highlight|--compress] [--plain|--cli|--html]\n',
    );
    return 1;
  }

  const formatter = resolveFormatter(options);
  let output = "";

  if (options.mode === "compress") {
    output = formatter.compress(sql);
  } else if (options.mode === "highlight") {
    output = formatter.highlight(sql);
  } else {
    output = formatter.format(sql, options.indentString);
  }

  process.stdout.write(output);
  if (!output.endsWith("\n")) {
    process.stdout.write("\n");
  }

  return 0;
}

function isDirectCliExecution(): boolean {
  if (typeof process === "undefined") {
    return false;
  }

  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  const normalized = entry.replaceAll("\\", "/").toLowerCase();
  return /(?:^|\/)sql-forge(?:\.(?:cjs|js|ts))?$/u.test(normalized);
}

if (isDirectCliExecution()) {
  void main().then((code) => {
    process.exitCode = code;
  });
}
