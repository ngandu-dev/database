import packageJson from "../package.json" with { type: "json" };

export const PACKAGE_NAME = "@ngandu-dev/database-mcp";
export const VERSION = packageJson.version;
export const DEFAULT_DATABASE_URL_ENV = "DATABASE_URL";
export const DEFAULT_MAX_ROWS = 200;
export const MAX_ROWS_LIMIT = 1000;
