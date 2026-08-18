import { describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

const cases = [
  { label: "precision (decimal)", precision: 12, scale: 6, typeName: Types.DECIMAL },
  { label: "scale (decimal)", precision: 16, scale: 8, typeName: Types.DECIMAL },
  { label: "precision and scale (decimal)", precision: 10, scale: 4, typeName: Types.DECIMAL },
  { label: "precision (number)", precision: 12, scale: 6, typeName: Types.NUMBER },
  { label: "scale (number)", precision: 16, scale: 8, typeName: Types.NUMBER },
  { label: "precision and scale (number)", precision: 10, scale: 4, typeName: Types.NUMBER },
] as const;

describe("Functional/Platform/AlterDecimalColumnTest", () => {
  const functional = useFunctionalTestCase();

  for (const testCase of cases) {
    it(`alter precision and scale: ${testCase.label}`, async () => {
      let table = Table.editor()
        .setUnquotedName("decimal_table")
        .setColumns(
          Column.editor()
            .setUnquotedName("val")
            .setTypeName(testCase.typeName)
            .setPrecision(16)
            .setScale(6)
            .create(),
        )
        .create();

      await functional.dropAndCreateTable(table);

      table = table
        .edit()
        .modifyColumnByUnquotedName("val", (editor) => {
          editor.setPrecision(testCase.precision).setScale(testCase.scale);
        })
        .create();

      const schemaManager = await functional.connection().createSchemaManager();
      const diff = schemaManager
        .createComparator()
        .compareTables(await schemaManager.introspectTableByUnquotedName("decimal_table"), table);
      expect(diff).not.toBeNull();
      if (diff === null) {
        return;
      }

      await schemaManager.alterTable(diff);

      const updated = await schemaManager.introspectTableByUnquotedName("decimal_table");
      const column = updated.getColumn("val");
      expect(column.getPrecision()).toBe(testCase.precision);
      expect(column.getScale()).toBe(testCase.scale);
    });
  }
});
