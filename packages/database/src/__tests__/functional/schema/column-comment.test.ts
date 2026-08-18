import { describe, expect, it } from "vitest";

import { AbstractPlatform } from "../../../platforms/abstract-platform";
import { Column } from "../../../schema/column";
import type { ColumnEditor } from "../../../schema/column-editor";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/ColumnCommentTest", () => {
  const functional = useFunctionalTestCase();

  for (const [columnName, comment] of commentProvider()) {
    it(`column comment: ${columnName}`, async () => {
      const connection = functional.connection();
      if (!supportsColumnComments(connection.getDatabasePlatform())) {
        return;
      }

      const editor = Table.editor()
        .setUnquotedName("column_comments")
        .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create());

      for (const [name, value] of commentProvider()) {
        editor.addColumn(
          Column.editor()
            .setUnquotedName(name)
            .setTypeName(Types.INTEGER)
            .setComment(value)
            .create(),
        );
      }

      await functional.dropAndCreateTable(editor.create());
      await assertColumnComment(functional, columnName, comment);
    });
  }

  for (const [comment1, comment2] of alterColumnCommentProvider()) {
    it(`alter column comment (${comment1} -> ${comment2})`, async () => {
      const connection = functional.connection();
      if (!supportsColumnComments(connection.getDatabasePlatform())) {
        return;
      }

      const table1 = Table.editor()
        .setUnquotedName("column_comments")
        .setColumns(
          Column.editor()
            .setUnquotedName("id")
            .setTypeName(Types.INTEGER)
            .setComment(comment1)
            .create(),
        )
        .create();

      await functional.dropAndCreateTable(table1);

      const table2 = table1
        .edit()
        .modifyColumnByUnquotedName("id", (editor: ColumnEditor) => {
          editor.setComment(comment2);
        })
        .create();

      const schemaManager = await connection.createSchemaManager();
      const diff = schemaManager.createComparator().compareTables(table1, table2);
      expect(diff).not.toBeNull();
      if (diff === null) {
        return;
      }

      await schemaManager.alterTable(diff);
      await assertColumnComment(functional, "id", comment2);
    });
  }
});

function commentProvider(): Array<[string, string]> {
  return [
    ["empty_comment", ""],
    ["some_comment", ""],
    ["zero_comment", "0"],
    ["quoted_comment", "O'Reilly"],
  ];
}

function alterColumnCommentProvider(): Array<[string, string]> {
  return [
    ["", "foo"],
    ["foo", ""],
    ["", "0"],
    ["0", ""],
    ["foo", "bar"],
  ];
}

function supportsColumnComments(platform: AbstractPlatform): boolean {
  return platform.supportsInlineColumnComments() || platform.supportsCommentOnStatement();
}

async function assertColumnComment(
  functional: ReturnType<typeof useFunctionalTestCase>,
  columnName: string,
  expectedComment: string,
): Promise<void> {
  const schemaManager = await functional.connection().createSchemaManager();
  const table = await schemaManager.introspectTableByUnquotedName("column_comments");
  expect(table.getColumn(columnName).getComment()).toBe(expectedComment);
}
