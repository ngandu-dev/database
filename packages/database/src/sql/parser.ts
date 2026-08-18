import { RegularExpressionException } from "./parser/exception/regular-expression-exception";
import type { SQLParser } from "./parser/sql-parser";
import type { Visitor } from "./parser/visitor";

const SPECIAL_CHARS = String.raw`:\?'"\[\-\/\``;

const BACKTICK_IDENTIFIER = String.raw`\`[^\`]*\``;
const BRACKET_IDENTIFIER = String.raw`(?<!\b[Aa][Rr][Rr][Aa][Yy])\[(?:[^\]])*\]`;
const MULTICHAR = ":{2,}";
const ESCAPED_QUESTION = String.raw`\?\?`;
const NAMED_PARAMETER = ":[a-zA-Z0-9_]+";
const POSITIONAL_PARAMETER = String.raw`(?<!\?)\?(?!\?)`;
const ONE_LINE_COMMENT = String.raw`--[^\r\n]*`;
const MULTI_LINE_COMMENT = String.raw`/\*([^*]+|\*+[^/*])*\**\*/`;
const SPECIAL = `[${SPECIAL_CHARS}]`;
const OTHER = `[^${SPECIAL_CHARS}]+`;

/**
 * SQL parser focused on identifying prepared statement parameters.
 * Ported for Datazen using the DBAL-style SQL parser approach.
 */
export class Parser implements SQLParser {
  private readonly tokenExpression: RegExp;

  constructor(mySQLStringEscaping = true) {
    const stringPatterns = mySQLStringEscaping
      ? [this.getMySQLStringLiteralPattern("'"), this.getMySQLStringLiteralPattern('"')]
      : [this.getAnsiSQLStringLiteralPattern("'"), this.getAnsiSQLStringLiteralPattern('"')];

    const sqlPattern = `(${[
      ...stringPatterns,
      BACKTICK_IDENTIFIER,
      BRACKET_IDENTIFIER,
      MULTICHAR,
      ESCAPED_QUESTION,
      ONE_LINE_COMMENT,
      MULTI_LINE_COMMENT,
      OTHER,
    ].join("|")})`;

    try {
      this.tokenExpression = new RegExp(
        `(?<named>${NAMED_PARAMETER})|(?<positional>${POSITIONAL_PARAMETER})|(?<other>${sqlPattern}|${SPECIAL})`,
        "sy",
      );
    } catch (error) {
      throw this.createRegexError(error);
    }
  }

  public parse(sql: string, visitor: Visitor): void {
    let offset = 0;

    while (offset < sql.length) {
      this.tokenExpression.lastIndex = offset;
      const match = this.tokenExpression.exec(sql);
      if (match === null) {
        throw new RegularExpressionException(
          `Unable to parse SQL around offset ${offset}.`,
          offset,
        );
      }

      const token = match[0] ?? "";
      const groups = match.groups ?? {};
      if ((groups.named ?? "") !== "") {
        visitor.acceptNamedParameter(token);
      } else if ((groups.positional ?? "") !== "") {
        visitor.acceptPositionalParameter(token);
      } else if (token === "??") {
        if (typeof visitor.acceptEscapedQuestionMark === "function") {
          visitor.acceptEscapedQuestionMark(token);
        } else {
          visitor.acceptOther("?");
        }
      } else {
        visitor.acceptOther(token);
      }

      offset += token.length;
    }
  }

  private getMySQLStringLiteralPattern(delimiter: string): string {
    const escapedDelimiter = delimiter === '"' ? '\\"' : delimiter;
    return `${delimiter}((\\\\.)|(?![${escapedDelimiter}\\\\]).)*${delimiter}`;
  }

  private getAnsiSQLStringLiteralPattern(delimiter: string): string {
    const escapedDelimiter = delimiter === '"' ? '\\"' : delimiter;
    return `${delimiter}[^${escapedDelimiter}]*${delimiter}`;
  }

  private createRegexError(error: unknown): RegularExpressionException {
    if (error instanceof Error) {
      return new RegularExpressionException(error.message, 0);
    }

    return new RegularExpressionException("Regular expression parser failure.", 0);
  }
}
