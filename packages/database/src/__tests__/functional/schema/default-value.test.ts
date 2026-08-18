import { beforeEach, describe, expect, it } from "vitest";

import { Column } from "../../../schema/column";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

const columns = [
  ["single_quote", "foo'bar"],
  ["single_quote_doubled", "foo''bar"],
  ["double_quote", 'foo"bar'],
  ["double_quote_doubled", 'foo""bar'],
  ["backspace", "foo\x08bar"],
  ["new_line", "foo\nbar"],
  ["carriage_return", "foo\rbar"],
  ["tab", "foo\tbar"],
  ["substitute", "foo\x1abar"],
  ["backslash", "foo\\bar"],
  ["backslash_doubled", "foo\\\\bar"],
  ["percent_sign", "foo%bar"],
  ["underscore", "foo_bar"],
  ["null_string", "NULL"],
  ["null_value", null],
  ["sql_expression", "'; DROP DATABASE doctrine --"],
  ["no_double_conversion", "\\'"],
] as const satisfies readonly (readonly [string, string | null])[];

describe("Functional/Schema/DefaultValueTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    const tableEditor = Table.editor()
      .setUnquotedName("default_value")
      .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create());

    for (const [name, defaultValue] of columns) {
      tableEditor.addColumn(
        Column.editor()
          .setUnquotedName(name)
          .setTypeName(Types.STRING)
          .setLength(32)
          .setDefaultValue(defaultValue)
          .setNotNull(false)
          .create(),
      );
    }

    await functional.dropAndCreateTable(tableEditor.create());
    await functional.connection().insert("default_value", { id: 1 });
  });

  it.each(columns)("introspects escaped default value for %s", async (name, expectedDefault) => {
    const table = await (
      await functional.connection().createSchemaManager()
    ).introspectTableByUnquotedName("default_value");

    expect(table.getColumn(name).getDefault()).toBe(expectedDefault);
  });

  it.each(columns)("inserts escaped default value for %s", async (name, expectedDefault) => {
    const value = await functional.connection().fetchOne(`SELECT ${name} FROM default_value`);
    expect(value).toBe(expectedDefault);
  });
});
