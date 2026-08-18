import { describe, expect, it } from "vitest";

import { ExpectedDot } from "../../../../schema/name/parser/exception/expected-dot";
import { ExpectedNextIdentifier } from "../../../../schema/name/parser/exception/expected-next-identifier";
import { UnableToParseIdentifier } from "../../../../schema/name/parser/exception/unable-to-parse-identifier";
import { GenericNameParser } from "../../../../schema/name/parser/generic-name-parser";

function shapeIdentifiers(input: string): Array<{ quoted: boolean; value: string }> {
  const parser = new GenericNameParser();
  return parser
    .parse(input)
    .getIdentifiers()
    .map((identifier) => ({
      quoted: identifier.isQuoted(),
      value: identifier.getValue(),
    }));
}

describe("Schema/Name/Parser/GenericNameParser (Doctrine parity)", () => {
  it.each([
    ["table", [{ quoted: false, value: "table" }]],
    [
      "schema.table",
      [
        { quoted: false, value: "schema" },
        { quoted: false, value: "table" },
      ],
    ],
    ['"example.com"', [{ quoted: true, value: "example.com" }]],
    ["`example.com`", [{ quoted: true, value: "example.com" }]],
    ["[example.com]", [{ quoted: true, value: "example.com" }]],
    [
      'a."b".c.`d`.e.[f].g',
      [
        { quoted: false, value: "a" },
        { quoted: true, value: "b" },
        { quoted: false, value: "c" },
        { quoted: true, value: "d" },
        { quoted: false, value: "e" },
        { quoted: true, value: "f" },
        { quoted: false, value: "g" },
      ],
    ],
    [
      '"schema"."table"',
      [
        { quoted: true, value: "schema" },
        { quoted: true, value: "table" },
      ],
    ],
    [
      "`schema`.`table`",
      [
        { quoted: true, value: "schema" },
        { quoted: true, value: "table" },
      ],
    ],
    [
      "[schema].[table]",
      [
        { quoted: true, value: "schema" },
        { quoted: true, value: "table" },
      ],
    ],
    [
      'schema."example.com"',
      [
        { quoted: false, value: "schema" },
        { quoted: true, value: "example.com" },
      ],
    ],
    [
      '"a""b".`c``d`.[e]]f]',
      [
        { quoted: true, value: 'a"b' },
        { quoted: true, value: "c`d" },
        { quoted: true, value: "e]f" },
      ],
    ],
    [
      'sch\u00e9ma."\u00fcberm\u00e4\u00dfigkeit".`\u00e0\u00e7c\u00eant`.[\u00e9xtr\u00eame].\u00e7h\u00e2r\u00e0ct\u00e9r',
      [
        { quoted: false, value: "sch\u00e9ma" },
        { quoted: true, value: "\u00fcberm\u00e4\u00dfigkeit" },
        { quoted: true, value: "\u00e0\u00e7c\u00eant" },
        { quoted: true, value: "\u00e9xtr\u00eame" },
        { quoted: false, value: "\u00e7h\u00e2r\u00e0ct\u00e9r" },
      ],
    ],
    [
      '" spaced identifier ".more',
      [
        { quoted: true, value: " spaced identifier " },
        { quoted: false, value: "more" },
      ],
    ],
    [
      '0."0".`0`.[0]',
      [
        { quoted: false, value: "0" },
        { quoted: true, value: "0" },
        { quoted: true, value: "0" },
        { quoted: true, value: "0" },
      ],
    ],
  ])("parses valid input %s", (input, expected) => {
    expect(shapeIdentifiers(input)).toEqual(expected);
  });

  it.each([
    ["", ExpectedNextIdentifier],
    ['"example.com', UnableToParseIdentifier],
    ["`example.com", UnableToParseIdentifier],
    ["[example.com", UnableToParseIdentifier],
    ['schema."example.com', UnableToParseIdentifier],
    ["schema.[example.com", UnableToParseIdentifier],
    ["schema.`example.com", UnableToParseIdentifier],
    ["schema.", ExpectedNextIdentifier],
    ["schema..", UnableToParseIdentifier],
    [".table", UnableToParseIdentifier],
    ["schema.table name", ExpectedDot],
    ['"schema.[example.com]', UnableToParseIdentifier],
  ])("rejects invalid input %s", (input, errorClass) => {
    const parser = new GenericNameParser();
    expect(() => parser.parse(input)).toThrow(errorClass);
  });
});
