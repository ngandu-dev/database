import { describe, expect, it } from "vitest";

import { ColumnCase } from "../../column-case";
import { Converter } from "../../portability/converter";

describe("Portability Converter parity", () => {
  it("converts numeric, associative and scalar values with configured pipeline", () => {
    const converter = new Converter(true, true, ColumnCase.LOWER);

    expect(converter.convertNumeric(["A  ", "", 1])).toEqual(["A", null, 1]);
    expect(converter.convertAssociative({ NAME: "Ada  ", EMPTY: "", N: 1 })).toEqual({
      name: "Ada",
      empty: null,
      n: 1,
    });
    expect(converter.convertOne("x  ")).toBe("x");
    expect(converter.convertOne("")).toBeNull();
    expect(converter.convertOne(false)).toBe(false);
  });

  it("preserves undefined sentinel for single-row fetch conversions", () => {
    const converter = new Converter(true, true, ColumnCase.UPPER);

    expect(converter.convertNumeric(undefined)).toBeUndefined();
    expect(converter.convertAssociative(undefined)).toBeUndefined();
  });

  it("converts fetch-all style arrays and first-column values", () => {
    const converter = new Converter(true, true, ColumnCase.UPPER);

    expect(
      converter.convertAllNumeric([
        ["a  ", ""],
        ["b", "c  "],
      ]),
    ).toEqual([
      ["a", null],
      ["b", "c"],
    ]);

    expect(converter.convertAllAssociative([{ foo: "x  ", bar: "" }, { baz: "y" }])).toEqual([
      { FOO: "x", BAR: null },
      { BAZ: "y" },
    ]);

    expect(converter.convertFirstColumn(["x  ", "", 1])).toEqual(["x", null, 1]);
  });

  it("keeps existing compatibility helpers working", () => {
    const converter = new Converter(false, true, ColumnCase.UPPER);

    expect(converter.convertRow({ name: "Ada  " })).toEqual({ NAME: "Ada" });
    expect(converter.convertColumnName("user_id")).toBe("USER_ID");
    expect(converter.convertValue("abc  ")).toBe("abc");
  });

  it("acts as identity when no portability conversion is enabled", () => {
    const converter = new Converter(false, false, null);
    const row = { Name: "Ada", Empty: "" };
    const numeric = ["x", ""];

    expect(converter.convertAssociative(row)).toBe(row);
    expect(converter.convertNumeric(numeric)).toBe(numeric);
    expect(converter.convertAllAssociative([row])[0]).toBe(row);
    expect(converter.convertAllNumeric([numeric])[0]).toBe(numeric);
    expect(converter.convertFirstColumn(["x", ""])).toEqual(["x", ""]);
  });
});
