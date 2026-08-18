import { describe, expect, it } from "vitest";

import type { Visitor } from "../../sql/parser";
import { Parser } from "../../sql/parser";

interface Token {
  kind: "named" | "other" | "positional";
  value: string;
}

class CollectingVisitor implements Visitor {
  public readonly tokens: Token[] = [];

  public acceptNamedParameter(sql: string): void {
    this.tokens.push({ kind: "named", value: sql });
  }

  public acceptOther(sql: string): void {
    this.tokens.push({ kind: "other", value: sql });
  }

  public acceptPositionalParameter(sql: string): void {
    this.tokens.push({ kind: "positional", value: sql });
  }
}

describe("SQL Parser", () => {
  it("detects named and positional parameters", () => {
    const parser = new Parser();
    const visitor = new CollectingVisitor();

    parser.parse("SELECT * FROM users WHERE id = :id AND status = ?", visitor);

    expect(
      visitor.tokens.filter((token) => token.kind === "named").map((token) => token.value),
    ).toEqual([":id"]);
    expect(
      visitor.tokens.filter((token) => token.kind === "positional").map((token) => token.value),
    ).toEqual(["?"]);
  });

  it("ignores placeholders inside quoted strings and comments", () => {
    const parser = new Parser();
    const visitor = new CollectingVisitor();

    parser.parse(
      "SELECT ':a', \"?\", `:x`, -- :c ?\n/* :d ? */ ? AS real_positional, :real_named",
      visitor,
    );

    expect(
      visitor.tokens.filter((token) => token.kind === "named").map((token) => token.value),
    ).toEqual([":real_named"]);
    expect(
      visitor.tokens.filter((token) => token.kind === "positional").map((token) => token.value),
    ).toEqual(["?"]);
  });

  it("keeps SQL Server bracket identifiers but parses placeholders inside ARRAY[]", () => {
    const parser = new Parser();
    const visitor = new CollectingVisitor();

    parser.parse("SELECT [col:name], ARRAY[:id], :status", visitor);

    expect(
      visitor.tokens.filter((token) => token.kind === "named").map((token) => token.value),
    ).toEqual([":id", ":status"]);
    expect(visitor.tokens.some((token) => token.value === "[col:name]")).toBe(true);
  });

  it("does not parse double question marks as positional parameters", () => {
    const parser = new Parser();
    const visitor = new CollectingVisitor();

    parser.parse("SELECT ?? AS op, ? AS id, :name", visitor);

    expect(
      visitor.tokens.filter((token) => token.kind === "positional").map((token) => token.value),
    ).toEqual(["?"]);
    expect(
      visitor.tokens.filter((token) => token.kind === "named").map((token) => token.value),
    ).toEqual([":name"]);
  });

  it("supports MySQL-style escaped quotes when enabled", () => {
    const parser = new Parser(true);
    const visitor = new CollectingVisitor();

    parser.parse("SELECT 'it\\'s :ignored' AS txt, :id", visitor);

    expect(
      visitor.tokens.filter((token) => token.kind === "named").map((token) => token.value),
    ).toEqual([":id"]);
  });

  it("supports ANSI quoted strings when MySQL escaping is disabled", () => {
    const parser = new Parser(false);
    const visitor = new CollectingVisitor();

    parser.parse("SELECT 'it''s :ignored' AS txt, :id", visitor);

    expect(
      visitor.tokens.filter((token) => token.kind === "named").map((token) => token.value),
    ).toEqual([":id"]);
  });
});
