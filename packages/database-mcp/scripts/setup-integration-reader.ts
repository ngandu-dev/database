import { setupMySqlReader } from "./integration/mysql-reader";
import { setupPostgresReader } from "./integration/postgres-reader";
import { setupSqlServerReader } from "./integration/sqlserver-reader";

const driver = process.env.MCP_TEST_DRIVER;
const adminUrl = process.env.MCP_ADMIN_DATABASE_URL;

if (adminUrl === undefined) {
  throw new Error("MCP_ADMIN_DATABASE_URL is required.");
}

if (driver === "postgresql") {
  await setupPostgresReader(adminUrl);
} else if (driver === "mysql" || driver === "mariadb") {
  await setupMySqlReader(adminUrl);
} else if (driver === "sqlserver") {
  await setupSqlServerReader(adminUrl);
} else {
  throw new Error(`Unsupported MCP_TEST_DRIVER: ${driver ?? "undefined"}`);
}
