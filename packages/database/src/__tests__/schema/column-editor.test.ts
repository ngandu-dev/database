import { beforeAll, describe, expect, it } from "vitest";

import { Column } from "../../schema/column";
import { InvalidColumnDefinition } from "../../schema/exception/invalid-column-definition";
import { UnqualifiedName } from "../../schema/name/unqualified-name";
import { IntegerType } from "../../types/integer-type";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Type } from "../../types/type";
import { Types } from "../../types/types";

describe("Schema/ColumnEditor (Doctrine parity)", () => {
  beforeAll(() => {
    registerBuiltInTypes();
  });

  it("sets an unquoted name", () => {
    const column = Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create();

    expect(column.getObjectName()).toEqual(UnqualifiedName.unquoted("id"));
  });

  it("sets a quoted name", () => {
    const column = Column.editor().setQuotedName("id").setTypeName(Types.INTEGER).create();

    expect(column.getObjectName()).toEqual(UnqualifiedName.quoted("id"));
  });

  it("sets a type instance", () => {
    const type = new IntegerType();

    const column = Column.editor().setUnquotedName("id").setType(type).create();

    expect(column.getType()).toBe(type);
  });

  it("sets a type by name", () => {
    const column = Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create();

    expect(column.getType()).toEqual(Type.getType(Types.INTEGER));
  });

  it("throws when name is not set", () => {
    expect(() => Column.editor().create()).toThrow(InvalidColumnDefinition);
  });

  it("throws when type is not set", () => {
    const editor = Column.editor().setUnquotedName("id");

    expect(() => editor.create()).toThrow(InvalidColumnDefinition);
  });
});
