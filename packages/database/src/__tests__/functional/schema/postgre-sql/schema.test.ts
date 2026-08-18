import { describe, expect, it } from "vitest";

import { PostgreSQLPlatform } from "../../../../platforms/postgresql-platform";
import { Column } from "../../../../schema/column";
import type { DefaultExpression } from "../../../../schema/default-expression";
import { Schema } from "../../../../schema/schema";
import { Sequence } from "../../../../schema/sequence";
import { Table } from "../../../../schema/table";
import { Types } from "../../../../types/types";
import { useFunctionalTestCase } from "../../_helpers/functional-test-case";

describe("Functional/Schema/PostgreSQL/SchemaTest", () => {
  const functional = useFunctionalTestCase();

  it("create table with sequence in column definition", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof PostgreSQLPlatform)) {
      skip();
    }

    await functional.dropTableIfExists("my_table");
    await connection.executeStatement("DROP SEQUENCE IF EXISTS my_table_id_seq");

    const table = Table.editor()
      .setUnquotedName("my_table")
      .setColumns(
        Column.editor()
          .setUnquotedName("id")
          .setTypeName(Types.INTEGER)
          .setDefaultValue(nextvalDefaultExpression("my_table_id_seq"))
          .create(),
      )
      .create();

    const sequence = Sequence.editor().setUnquotedName("my_table_id_seq").create();
    const schema = new Schema([table], [sequence]);

    for (const sql of schema.toSql(connection.getDatabasePlatform())) {
      await connection.executeStatement(sql);
    }

    const row = await connection.fetchAssociative<{ column_default: string | null }>(
      "SELECT column_default FROM information_schema.columns WHERE table_name = ?",
      ["my_table"],
    );

    expect(row).toBeDefined();
    if (row === undefined) {
      return;
    }

    expect(row.column_default).toBe("nextval('my_table_id_seq'::regclass)");
  });
});

function nextvalDefaultExpression(sequenceName: string): DefaultExpression {
  return {
    toSQL(): string {
      return `nextval('${sequenceName}'::regclass)`;
    },
  };
}
