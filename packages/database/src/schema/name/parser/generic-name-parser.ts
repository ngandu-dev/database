import { GenericName } from "../generic-name";
import { Identifier } from "../identifier";
import type { Parser } from "../parser";
import { ExpectedDot } from "./exception/expected-dot";
import { ExpectedNextIdentifier } from "./exception/expected-next-identifier";
import { UnableToParseIdentifier } from "./exception/unable-to-parse-identifier";

export class GenericNameParser implements Parser<GenericName> {
  public parse(input: string): GenericName {
    let offset = 0;
    const identifiers: Identifier[] = [];

    while (true) {
      if (offset >= input.length) {
        throw ExpectedNextIdentifier.new();
      }

      const parsed = this.parseIdentifier(input, offset);
      identifiers.push(parsed.identifier);
      offset = parsed.nextOffset;

      if (offset >= input.length) {
        break;
      }

      const character = input[offset];
      if (character === undefined) {
        throw ExpectedNextIdentifier.new();
      }

      if (character !== ".") {
        throw ExpectedDot.new(offset, character);
      }

      offset += 1;
    }

    const [first, ...rest] = identifiers;
    if (first === undefined) {
      throw ExpectedNextIdentifier.new();
    }

    return new GenericName(first, ...rest);
  }

  private parseIdentifier(
    input: string,
    offset: number,
  ): { identifier: Identifier; nextOffset: number } {
    const current = input[offset];
    if (current === undefined) {
      throw ExpectedNextIdentifier.new();
    }

    if (current === '"') {
      return this.parseQuoted(input, offset, '"');
    }

    if (current === "`") {
      return this.parseQuoted(input, offset, "`");
    }

    if (current === "[") {
      return this.parseQuoted(input, offset, "]");
    }

    if (this.isForbiddenUnquoted(current)) {
      throw UnableToParseIdentifier.new(offset);
    }

    let end = offset;
    while (end < input.length) {
      const char = input[end];
      if (char === undefined || this.isForbiddenUnquoted(char)) {
        break;
      }

      end += 1;
    }

    if (end === offset) {
      throw UnableToParseIdentifier.new(offset);
    }

    return {
      identifier: Identifier.unquoted(input.slice(offset, end)),
      nextOffset: end,
    };
  }

  private parseQuoted(
    input: string,
    offset: number,
    closer: string,
  ): { identifier: Identifier; nextOffset: number } {
    let cursor = offset + 1;
    let value = "";

    while (cursor < input.length) {
      const char = input[cursor];
      if (char === undefined) {
        break;
      }

      if (char === closer) {
        const next = input[cursor + 1];
        if (next === closer) {
          value += closer;
          cursor += 2;
          continue;
        }

        return {
          identifier: Identifier.quoted(value),
          nextOffset: cursor + 1,
        };
      }

      value += char;
      cursor += 1;
    }

    throw UnableToParseIdentifier.new(offset);
  }

  private isForbiddenUnquoted(char: string): boolean {
    return (
      /\s/.test(char) ||
      char === "." ||
      char === '"' ||
      char === "`" ||
      char === "[" ||
      char === "]"
    );
  }
}
