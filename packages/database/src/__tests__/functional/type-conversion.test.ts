import { beforeEach, describe, expect, it } from "vitest";

import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Type } from "../../types/type";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

let typeCounter = 0;

describe("Functional/TypeConversionTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    registerBuiltInTypes();
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("type_conversion")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor()
            .setUnquotedName("test_string")
            .setTypeName(Types.STRING)
            .setLength(16)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_boolean")
            .setTypeName(Types.BOOLEAN)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_bigint")
            .setTypeName(Types.BIGINT)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_smallint")
            .setTypeName(Types.SMALLINT)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_datetime")
            .setTypeName(Types.DATETIME_MUTABLE)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_datetimetz")
            .setTypeName(Types.DATETIMETZ_MUTABLE)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_date")
            .setTypeName(Types.DATE_MUTABLE)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_time")
            .setTypeName(Types.TIME_MUTABLE)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_text")
            .setTypeName(Types.TEXT)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_json")
            .setTypeName(Types.JSON)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_float")
            .setTypeName(Types.FLOAT)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_smallfloat")
            .setTypeName(Types.SMALLFLOAT)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("test_decimal")
            .setTypeName(Types.DECIMAL)
            .setNotNull(false)
            .setPrecision(10)
            .setScale(2)
            .create(),
          Column.editor()
            .setUnquotedName("test_number")
            .setTypeName(Types.NUMBER)
            .setNotNull(false)
            .setPrecision(10)
            .setScale(2)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );
  });

  it.each([
    [Types.BOOLEAN, true],
    [Types.BOOLEAN, false],
  ] as const)("idempotent boolean conversion (%s, %s)", async (type, original) => {
    const value = await processValue(functional, type, original);
    expect(typeof value).toBe("boolean");
    expect(value).toBe(original);
  });

  it("idempotent smallint conversion", async () => {
    const value = await processValue(functional, Types.SMALLINT, 123);
    expect(typeof value).toBe("number");
    expect(value).toBe(123);
  });

  it.each([
    [Types.FLOAT, 1.5],
    [Types.SMALLFLOAT, 1.5],
  ] as const)("idempotent float conversion (%s)", async (type, original) => {
    const value = await processValue(functional, type, original);
    expect(typeof value).toBe("number");
    expect(value).toBe(original);
  });

  it.each([
    [Types.STRING, "ABCDEFGabcdefg"],
    [Types.TEXT, "foo ".repeat(1000)],
  ] as const)("idempotent string conversion (%s)", async (type, original) => {
    const value = await processValue(functional, type, original);
    expect(typeof value).toBe("string");
    expect(value).toBe(original);
  });

  it("idempotent json conversion", async () => {
    expect(await processValue(functional, Types.JSON, { foo: "bar" })).toEqual({ foo: "bar" });
  });

  it.each([
    [Types.DATETIME_MUTABLE, new Date("2010-04-05T10:10:10")],
    [Types.DATETIMETZ_MUTABLE, new Date("2010-04-05T10:10:10")],
    [Types.DATE_MUTABLE, new Date("2010-04-05T00:00:00")],
    [Types.TIME_MUTABLE, new Date("1970-01-01T10:10:10")],
  ] as const)("round-trips temporal values (%s)", async (type, original) => {
    const value = await processValue(functional, type, original);
    expect(value).toBeInstanceOf(Date);
  });

  it("round-trips decimal as string", async () => {
    expect(await processValue(functional, Types.DECIMAL, "13.37")).toBe("13.37");
  });

  it("round-trips number as string in Node (Doctrine bcmath intent adapted)", async () => {
    expect(await processValue(functional, Types.NUMBER, "13.37")).toBe("13.37");
  });
});

async function processValue(
  functional: ReturnType<typeof useFunctionalTestCase>,
  typeName: string,
  originalValue: unknown,
): Promise<unknown> {
  const connection = functional.connection();
  const columnName = `test_${typeName}`;
  const type = Type.getType(typeName);
  const platform = connection.getDatabasePlatform();
  const insertionValue = type.convertToDatabaseValue(originalValue, platform);

  typeCounter += 1;
  await connection.insert("type_conversion", { id: typeCounter, [columnName]: insertionValue });

  return connection.convertToNodeValue(
    await connection.fetchOne(
      `SELECT ${columnName} FROM type_conversion WHERE id = ${typeCounter}`,
    ),
    typeName,
  );
}
