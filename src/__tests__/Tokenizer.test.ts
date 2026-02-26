import { describe, expect, test } from "vitest";

import { Token } from "../Token";
import { Tokenizer } from "../Tokenizer";
import { TokenType } from "../TokenType";

function collectTokens(sql: string): Token[] {
  const cursor = new Tokenizer().tokenize(sql);
  const tokens: Token[] = [];

  while (true) {
    const token = cursor.next();
    if (token === null) {
      break;
    }

    tokens.push(token);
  }

  return tokens;
}

describe("Tokenizer", () => {
  test("internal keyword lists are sorted", () => {
    const tokenizer = new Tokenizer();
    for (const list of [
      tokenizer.reserved,
      tokenizer.reservedToplevel,
      tokenizer.reservedNewline,
      tokenizer.functions,
    ]) {
      const sorted = [...list].sort();
      expect(list).toStrictEqual(sorted);
    }
  });

  test.each([
    {
      name: "empty",
      sql: "",
      expected: [] as Token[],
    },
    {
      name: "basic",
      sql: "select 1",
      expected: [
        new Token(TokenType.RESERVED_TOPLEVEL, "select"),
        new Token(TokenType.WHITESPACE, " "),
        new Token(TokenType.NUMBER, "1"),
      ],
    },
    {
      name: "no regressions for */",
      sql: "*/",
      expected: [new Token(TokenType.BOUNDARY, "*"), new Token(TokenType.BOUNDARY, "/")],
    },
    {
      name: "unclosed quoted string",
      sql: "'foo...",
      expected: [new Token(TokenType.QUOTE, "'foo...")],
    },
    {
      name: "unclosed block comment",
      sql: "/* foo...",
      expected: [new Token(TokenType.BLOCK_COMMENT, "/* foo...")],
    },
    {
      name: "PostgreSQL operator",
      sql: "select json #> null",
      expected: [
        new Token(TokenType.RESERVED_TOPLEVEL, "select"),
        new Token(TokenType.WHITESPACE, " "),
        new Token(TokenType.WORD, "json"),
        new Token(TokenType.WHITESPACE, " "),
        new Token(TokenType.BOUNDARY, "#"),
        new Token(TokenType.BOUNDARY, ">"),
        new Token(TokenType.WHITESPACE, " "),
        new Token(TokenType.RESERVED, "null"),
      ],
    },
  ])("$name", ({ sql, expected }: { sql: string; expected: Token[] }) => {
    expect(collectTokens(sql)).toStrictEqual(expected);
  });

  test("tokenize long concat without truncation", () => {
    const count = 2_000;
    const sqlParts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      sqlParts.push(`cast('foo${i}' as blob)`);
    }

    const concat = `concat(${sqlParts.join(", ")})`;
    const sql = `select iif(${concat} = ${concat}, 10, 20) x`;
    const tokens = collectTokens(sql);

    expect(tokens[0]).toStrictEqual(new Token(TokenType.RESERVED_TOPLEVEL, "select"));
    expect(tokens.at(-1)).toStrictEqual(new Token(TokenType.WORD, "x"));
    expect(
      tokens.some((token) => token.value === "concat" && token.type === TokenType.RESERVED),
    ).toBe(true);
    expect(
      tokens.some((token) => token.value === "blob" && token.type === TokenType.RESERVED),
    ).toBe(true);
  });
});
