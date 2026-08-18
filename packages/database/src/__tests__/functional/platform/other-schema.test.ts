import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DriverManager } from "../../../driver-manager";
import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { DsnParser } from "../../../tools/dsn-parser";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Platform/OtherSchemaTest", () => {
  const functional = useFunctionalTestCase();

  it("a table can be created in another schema", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLitePlatform)) {
      skip();
    }

    const attachedDbPath = path.join(tmpdir(), `datazen-other-schema-${randomUUID()}.sqlite`);
    const escapedPath = attachedDbPath.replace(/'/g, "''");

    try {
      await connection.executeStatement(`ATTACH DATABASE '${escapedPath}' AS other`);

      const table = Table.editor()
        .setUnquotedName("test_other_schema", "other")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
        .create();
      table.addIndex(["id"]);

      await functional.dropAndCreateTable(table);
      await connection.insert("other.test_other_schema", { id: 1 });

      expect(await connection.fetchOne("SELECT COUNT(*) FROM other.test_other_schema")).toBe(1);

      const parser = new DsnParser();
      const dsnPath = attachedDbPath.replaceAll("\\", "/");
      const onlineConnection = DriverManager.getConnection(parser.parse(`sqlite3:///${dsnPath}`));
      try {
        await onlineConnection.resolveDatabasePlatform();
        const onlineTable = await (
          await onlineConnection.createSchemaManager()
        ).introspectTableByUnquotedName("test_other_schema");
        expect(onlineTable.getIndexes()).toHaveLength(1);
      } finally {
        await onlineConnection.close();
      }
    } finally {
      try {
        await connection.executeStatement("DETACH DATABASE other");
      } catch {
        // Best-effort cleanup when attach/create failed.
      }

      await rm(attachedDbPath, { force: true });
    }
  });
});
