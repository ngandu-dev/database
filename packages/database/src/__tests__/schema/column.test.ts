import { beforeAll, describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { SQLitePlatform } from "../../platforms/sqlite-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { Column } from "../../schema/column";
import { UnknownColumnOption } from "../../schema/exception/unknown-column-option";
import { Identifier as NameIdentifier } from "../../schema/name/identifier";
import { UnqualifiedName } from "../../schema/name/unqualified-name";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Type } from "../../types/type";
import { Types } from "../../types/types";

function createColumn(): Column {
  return Column.editor()
    .setUnquotedName("foo")
    .setTypeName(Types.STRING)
    .setLength(200)
    .setPrecision(5)
    .setScale(2)
    .setUnsigned(true)
    .setNotNull(false)
    .setFixed(true)
    .setDefaultValue("baz")
    .setCharset("utf8")
    .setEnumType("ColumnTest")
    .create();
}

describe("Schema/Column (Doctrine parity)", () => {
  beforeAll(() => {
    registerBuiltInTypes();
  });

  it("exposes configured column metadata", () => {
    const column = createColumn();

    expect(column.getObjectName()).toEqual(UnqualifiedName.unquoted("foo"));
    expect(column.getType()).toEqual(Type.getType(Types.STRING));
    expect(column.getLength()).toBe(200);
    expect(column.getPrecision()).toBe(5);
    expect(column.getScale()).toBe(2);
    expect(column.getUnsigned()).toBe(true);
    expect(column.getNotnull()).toBe(false);
    expect(column.getFixed()).toBe(true);
    expect(column.getDefault()).toBe("baz");
    expect(column.getPlatformOptions()).toEqual({
      charset: "utf8",
      enumType: "ColumnTest",
    });
    expect(column.hasPlatformOption("charset")).toBe(true);
    expect(column.getPlatformOption("charset")).toBe("utf8");
    expect(column.hasPlatformOption("collation")).toBe(false);
    expect(column.hasPlatformOption("enumType")).toBe(true);
    expect(column.getPlatformOption("enumType")).toBe("ColumnTest");
  });

  it("serializes to an option array", () => {
    expect(createColumn().toArray()).toEqual({
      autoincrement: false,
      charset: "utf8",
      columnDefinition: null,
      comment: "",
      default: "baz",
      enumType: "ColumnTest",
      fixed: true,
      length: 200,
      name: "foo",
      notnull: false,
      precision: 5,
      scale: 2,
      type: Type.getType(Types.STRING),
      unsigned: true,
      values: [],
    });
  });

  it("throws on unknown options", () => {
    expect(() => new Column("foo", Type.getType(Types.STRING), { unknown_option: "bar" })).toThrow(
      UnknownColumnOption,
    );
    expect(() => new Column("foo", Type.getType(Types.STRING), { unknown_option: "bar" })).toThrow(
      'The "unknown_option" column option is not supported.',
    );
  });

  it("supports quoted column names across platforms", () => {
    const column = Column.editor().setQuotedName("bar").setTypeName(Types.STRING).create();

    expect(column.getObjectName().toString()).toBe('"bar"');
    expect(column.getQuotedName(new MySQLPlatform())).toBe("`bar`");
    expect(column.getQuotedName(new SQLitePlatform())).toBe('"bar"');
    expect(column.getQuotedName(new SQLServerPlatform())).toBe("[bar]");
  });

  it.each([
    ["bar", false],
    ["`bar`", true],
    ['"bar"', true],
    ["[bar]", true],
  ])("detects quoted column names", (columnName, isQuoted) => {
    const column = new Column(columnName, Type.getType(Types.STRING));
    expect(column.isQuoted()).toBe(isQuoted);
  });

  it("supports mutable comments and includes them in toArray()", () => {
    const column = Column.editor()
      .setUnquotedName("bar")
      .setType(Type.getType(Types.STRING))
      .create();

    expect(column.getComment()).toBe("");
    column.setComment("foo");
    expect(column.getComment()).toBe("foo");
    expect(column.toArray().comment).toBe("foo");
  });

  it("returns a parsed object name", () => {
    const column = Column.editor()
      .setUnquotedName("id")
      .setType(Type.getType(Types.INTEGER))
      .create();
    expect(column.getObjectName().getIdentifier()).toEqual(NameIdentifier.unquoted("id"));
  });

  it.skip(
    "Doctrine deprecation-only cases (empty name/jsonb option deprecations) are not modeled in Node",
  );
  it.skip(
    "Doctrine constructor deprecation flow for unknown options before assertion side-effects is not modeled",
  );
});
