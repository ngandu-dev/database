import {
  DEFAULT_DATABASE_URL_ENV,
  DEFAULT_MAX_ROWS,
  MAX_ROWS_LIMIT,
  PACKAGE_NAME,
  VERSION,
} from "../constants";

export type CliMode = "check" | "help" | "server" | "version";

export interface CliOptions {
  databaseUrlEnv: string;
  defaultMaxRows: number;
  mode: CliMode;
}

export const HELP_TEXT = `${PACKAGE_NAME} ${VERSION}

Run a local stdio MCP server for one database connection.

Usage:
  ngandu-database-mcp [options]

Options:
  --database-url-env <name>  Environment variable containing the database URL
                             (default: ${DEFAULT_DATABASE_URL_ENV})
  --default-max-rows <count> Default execute_query output limit, 1-${MAX_ROWS_LIMIT}
                             (default: ${DEFAULT_MAX_ROWS})
  --check                    Validate the connection and print database info
  --help, -h                 Show this help
  --version, -v              Show the package version

The database URL is deliberately accepted only through an environment variable.
`;

export function parseCliOptions(argv: string[]): CliOptions {
  let databaseUrlEnv = DEFAULT_DATABASE_URL_ENV;
  let defaultMaxRows = DEFAULT_MAX_ROWS;
  let mode: CliMode = "server";

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      mode = "help";
      continue;
    }
    if (argument === "--version" || argument === "-v") {
      mode = "version";
      continue;
    }
    if (argument === "--check") {
      mode = "check";
      continue;
    }

    if (argument === "--database-url-env" || argument.startsWith("--database-url-env=")) {
      const [value, consumed] = readOptionValue(argument, argv[index + 1]);
      databaseUrlEnv = validateEnvironmentVariableName(value);
      index += consumed;
      continue;
    }

    if (argument === "--default-max-rows" || argument.startsWith("--default-max-rows=")) {
      const [value, consumed] = readOptionValue(argument, argv[index + 1]);
      defaultMaxRows = parseRowLimit(value);
      index += consumed;
      continue;
    }

    if (argument === "--database-url" || argument.startsWith("--database-url=")) {
      throw new Error(
        "Database URLs cannot be passed as command arguments. Use --database-url-env instead.",
      );
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return { databaseUrlEnv, defaultMaxRows, mode };
}

function readOptionValue(argument: string, next: string | undefined): [string, number] {
  const equalsIndex = argument.indexOf("=");
  if (equalsIndex !== -1) {
    const value = argument.slice(equalsIndex + 1);
    if (value.length === 0) {
      throw new Error(`Missing value for ${argument.slice(0, equalsIndex)}.`);
    }
    return [value, 0];
  }

  if (next === undefined || next.startsWith("-")) {
    throw new Error(`Missing value for ${argument}.`);
  }
  return [next, 1];
}

function validateEnvironmentVariableName(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid environment variable name: ${value}`);
  }
  return value;
}

function parseRowLimit(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error("--default-max-rows must be an integer.");
  }
  const parsed = Number.parseInt(value, 10);
  if (parsed < 1 || parsed > MAX_ROWS_LIMIT) {
    throw new Error(`--default-max-rows must be between 1 and ${MAX_ROWS_LIMIT}.`);
  }
  return parsed;
}
