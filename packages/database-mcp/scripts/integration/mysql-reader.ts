import { createConnection } from "mysql2/promise";

export async function setupMySqlReader(adminUrl: string): Promise<void> {
  const databaseName = decodeURIComponent(new URL(adminUrl).pathname.replace(/^\//, ""));
  const connection = await createConnection(adminUrl);
  try {
    await connection.query(`
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL
)`);
    await connection.query(
      "INSERT INTO items (id, name) VALUES (1, 'one'), (2, 'two') ON DUPLICATE KEY UPDATE name = VALUES(name)",
    );
    await connection.query("CREATE OR REPLACE VIEW item_names AS SELECT id, name FROM items");
    await connection.query("CREATE USER IF NOT EXISTS 'datazen_reader'@'%' IDENTIFIED BY 'reader'");
    await connection.query("ALTER USER 'datazen_reader'@'%' IDENTIFIED BY 'reader'");
    await connection.query(
      `GRANT SELECT, SHOW VIEW ON ${quoteIdentifier(databaseName)}.* TO 'datazen_reader'@'%'`,
    );
  } finally {
    await connection.end();
  }
}

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replaceAll("`", "``")}\``;
}
