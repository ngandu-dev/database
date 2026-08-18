import { Cursor } from "./Cursor";
import { Token } from "./Token";
import {
  TOKENIZER_BOUNDARIES,
  TOKENIZER_FUNCTIONS,
  TOKENIZER_RESERVED,
  TOKENIZER_RESERVED_NEWLINE,
  TOKENIZER_RESERVED_TOPLEVEL,
} from "./TokenizerKeywords";
import { TokenType } from "./TokenType";

type KeywordMatch = {
  length: number;
  phrase: string;
};

export class Tokenizer {
  public readonly reserved = [...TOKENIZER_RESERVED];
  public readonly reservedToplevel = [...TOKENIZER_RESERVED_TOPLEVEL];
  public readonly reservedNewline = [...TOKENIZER_RESERVED_NEWLINE];
  public readonly functions = [...TOKENIZER_FUNCTIONS];
  public readonly boundaries = [...TOKENIZER_BOUNDARIES];

  private readonly boundaryTokens: readonly string[];
  private readonly boundaryStartChars: ReadonlySet<string>;
  private readonly reservedByFirstChar: ReadonlyMap<string, readonly string[]>;
  private readonly reservedToplevelByFirstChar: ReadonlyMap<string, readonly string[]>;
  private readonly reservedNewlineByFirstChar: ReadonlyMap<string, readonly string[]>;
  private readonly functionsByFirstChar: ReadonlyMap<string, readonly string[]>;
  private readonly functionsSet: ReadonlySet<string>;

  public constructor() {
    this.boundaryTokens = [...this.boundaries].sort(
      (a, b) => b.length - a.length || a.localeCompare(b),
    );
    this.boundaryStartChars = new Set(
      this.boundaryTokens.map((token) => token[0]).filter((c): c is string => c !== undefined),
    );
    this.reservedByFirstChar = this.groupByFirstChar(this.reserved);
    this.reservedToplevelByFirstChar = this.groupByFirstChar(this.reservedToplevel);
    this.reservedNewlineByFirstChar = this.groupByFirstChar(this.reservedNewline);
    this.functionsByFirstChar = this.groupByFirstChar(this.functions);
    this.functionsSet = new Set(this.functions);
  }

  public tokenize(input: string): Cursor {
    const tokens: Token[] = [];
    const upper = input.toUpperCase();
    let offset = 0;

    while (offset < input.length) {
      const token =
        this.matchWhitespace(input, offset) ??
        this.matchLineComment(input, offset) ??
        this.matchBlockComment(input, offset) ??
        this.matchBacktickOrBracketQuote(input, offset) ??
        this.matchQuote(input, offset) ??
        this.matchVariable(input, offset) ??
        this.matchNumber(input, offset) ??
        this.matchBoundary(input, offset) ??
        this.matchReservedToplevel(input, upper, offset) ??
        this.matchReservedNewline(input, upper, offset) ??
        this.matchReserved(input, upper, offset) ??
        this.matchWord(input, offset);

      if (token === null) {
        throw new Error(`Tokenizer failed at offset ${offset}`);
      }

      tokens.push(token);
      offset += token.value.length;
    }

    return new Cursor(tokens);
  }

  private groupByFirstChar(values: readonly string[]): ReadonlyMap<string, readonly string[]> {
    const grouped = new Map<string, string[]>();

    for (const value of values) {
      const first = value[0];
      if (first === undefined) {
        continue;
      }

      const group = grouped.get(first);
      if (group === undefined) {
        grouped.set(first, [value]);
        continue;
      }

      group.push(value);
    }

    for (const [, group] of grouped) {
      group.sort((a, b) => b.length - a.length || a.localeCompare(b));
    }

    return grouped;
  }

  private matchWhitespace(input: string, offset: number): Token | null {
    if (!this.isWhitespace(input[offset])) {
      return null;
    }

    let end = offset + 1;
    while (end < input.length && this.isWhitespace(input[end])) {
      end += 1;
    }

    return new Token(TokenType.WHITESPACE, input.slice(offset, end));
  }

  private matchLineComment(input: string, offset: number): Token | null {
    const char = input[offset];
    const next = input[offset + 1];

    if (!(char === "-" && next === "-") && !(char === "#" && next !== ">")) {
      return null;
    }

    let end = offset;
    while (end < input.length && input[end] !== "\n") {
      end += 1;
    }

    return new Token(TokenType.COMMENT, input.slice(offset, end));
  }

  private matchBlockComment(input: string, offset: number): Token | null {
    if (!(input[offset] === "/" && input[offset + 1] === "*")) {
      return null;
    }

    let end = offset + 2;
    while (end < input.length) {
      if (input[end] === "*" && input[end + 1] === "/") {
        end += 2;
        return new Token(TokenType.BLOCK_COMMENT, input.slice(offset, end));
      }

      end += 1;
    }

    return new Token(TokenType.BLOCK_COMMENT, input.slice(offset));
  }

  private matchBacktickOrBracketQuote(input: string, offset: number): Token | null {
    const char = input[offset];
    if (char !== "`" && char !== "[") {
      return null;
    }

    const closing = char === "[" ? "]" : "`";
    let end = offset + 1;

    while (end < input.length) {
      if (input[end] !== closing) {
        end += 1;
        continue;
      }

      if (input[end + 1] === closing) {
        end += 2;
        continue;
      }

      end += 1;
      return new Token(TokenType.BACKTICK_QUOTE, input.slice(offset, end));
    }

    return new Token(TokenType.BACKTICK_QUOTE, input.slice(offset));
  }

  private matchQuote(input: string, offset: number): Token | null {
    const quote = input[offset];
    if (quote !== "'" && quote !== '"') {
      return null;
    }

    let end = offset + 1;
    while (end < input.length) {
      const char = input[end];

      if (char === "\\") {
        end += 1;
        if (end < input.length) {
          end += 1;
        }
        continue;
      }

      if (char === quote) {
        if (input[end + 1] === quote) {
          end += 2;
          continue;
        }

        end += 1;
        return new Token(TokenType.QUOTE, input.slice(offset, end));
      }

      end += 1;
    }

    return new Token(TokenType.QUOTE, input.slice(offset));
  }

  private matchVariable(input: string, offset: number): Token | null {
    const prefix = input[offset];
    if (prefix !== "@" && prefix !== ":") {
      return null;
    }

    const next = input[offset + 1];
    if (next === undefined) {
      return null;
    }

    if (this.isVariableNameChar(next)) {
      let end = offset + 2;
      while (end < input.length && this.isVariableNameChar(input[end])) {
        end += 1;
      }

      return new Token(TokenType.VARIABLE, input.slice(offset, end));
    }

    if (next === "`" || next === "[") {
      const quoted = this.matchBacktickOrBracketQuote(input, offset + 1);
      if (quoted === null) {
        return null;
      }

      return new Token(TokenType.VARIABLE, input.slice(offset, offset + 1 + quoted.value.length));
    }

    if (next === "'" || next === '"') {
      const quoted = this.matchQuote(input, offset + 1);
      if (quoted === null) {
        return null;
      }

      return new Token(TokenType.VARIABLE, input.slice(offset, offset + 1 + quoted.value.length));
    }

    return null;
  }

  private matchNumber(input: string, offset: number): Token | null {
    const first = input[offset];
    if (first === undefined || !this.isDigit(first)) {
      return null;
    }

    let end = offset;

    if (input[offset] === "0" && (input[offset + 1] === "x" || input[offset + 1] === "X")) {
      end = offset + 2;
      while (end < input.length && this.isHexDigit(input[end])) {
        end += 1;
      }

      if (end === offset + 2 || !this.isNumberBoundary(input, end)) {
        return null;
      }

      return new Token(TokenType.NUMBER, input.slice(offset, end));
    }

    if (input[offset] === "0" && (input[offset + 1] === "b" || input[offset + 1] === "B")) {
      end = offset + 2;
      while (end < input.length && (input[end] === "0" || input[end] === "1")) {
        end += 1;
      }

      if (end === offset + 2 || !this.isNumberBoundary(input, end)) {
        return null;
      }

      return new Token(TokenType.NUMBER, input.slice(offset, end));
    }

    end = offset + 1;
    while (end < input.length && this.isDigit(input[end])) {
      end += 1;
    }

    if (input[end] === "." && this.isDigit(input[end + 1])) {
      end += 2;
      while (end < input.length && this.isDigit(input[end])) {
        end += 1;
      }
    }

    if (!this.isNumberBoundary(input, end)) {
      return null;
    }

    return new Token(TokenType.NUMBER, input.slice(offset, end));
  }

  private matchBoundary(input: string, offset: number): Token | null {
    for (const boundary of this.boundaryTokens) {
      if (input.startsWith(boundary, offset)) {
        return new Token(TokenType.BOUNDARY, input.slice(offset, offset + boundary.length));
      }
    }

    return null;
  }

  private matchReservedToplevel(input: string, upper: string, offset: number): Token | null {
    const match = this.matchKeywordList(upper, offset, this.reservedToplevelByFirstChar);
    if (match === null) {
      return null;
    }

    if (this.isReservedBlockedByContext(upper, offset, match)) {
      return null;
    }

    return new Token(TokenType.RESERVED_TOPLEVEL, input.slice(offset, offset + match.length));
  }

  private matchReservedNewline(input: string, upper: string, offset: number): Token | null {
    const match = this.matchKeywordList(upper, offset, this.reservedNewlineByFirstChar);
    if (match === null || this.isPrecededByDot(upper, offset)) {
      return null;
    }

    return new Token(TokenType.RESERVED_NEWLINE, input.slice(offset, offset + match.length));
  }

  private matchReserved(input: string, upper: string, offset: number): Token | null {
    if (this.isPrecededByDot(upper, offset)) {
      return null;
    }

    const reservedMatch = this.matchKeywordList(upper, offset, this.reservedByFirstChar);
    if (reservedMatch !== null) {
      return new Token(TokenType.RESERVED, input.slice(offset, offset + reservedMatch.length));
    }

    const wordLength = this.matchSingleWordLength(upper, offset);
    if (wordLength === null) {
      return null;
    }

    const keyword = upper.slice(offset, offset + wordLength);
    if (!this.functionsSet.has(keyword)) {
      return null;
    }

    let next = offset + wordLength;
    while (this.isWhitespace(input[next])) {
      next += 1;
    }

    if (input[next] !== "(") {
      return null;
    }

    return new Token(TokenType.RESERVED, input.slice(offset, offset + wordLength));
  }

  private matchWord(input: string, offset: number): Token | null {
    let end = offset;

    while (end < input.length) {
      const char = input[end];
      if (char === undefined) {
        break;
      }

      if (this.isWhitespace(char) || char === '"' || char === "'" || char === "`") {
        break;
      }

      if (this.boundaryStartChars.has(char)) {
        break;
      }

      end += 1;
    }

    if (end === offset) {
      return null;
    }

    return new Token(TokenType.WORD, input.slice(offset, end));
  }

  private matchKeywordList(
    upper: string,
    offset: number,
    groups: ReadonlyMap<string, readonly string[]>,
  ): KeywordMatch | null {
    const first = upper[offset];
    if (first === undefined) {
      return null;
    }

    const candidates = groups.get(first);
    if (candidates === undefined) {
      return null;
    }

    for (const phrase of candidates) {
      const length = this.matchPhraseLength(upper, offset, phrase);
      if (length === null) {
        continue;
      }

      if (!this.isKeywordBoundary(upper, offset + length)) {
        continue;
      }

      return { length, phrase };
    }

    return null;
  }

  private matchPhraseLength(upper: string, offset: number, phrase: string): number | null {
    let pos = offset;

    for (let i = 0; i < phrase.length; i += 1) {
      const phraseChar = phrase[i];
      if (phraseChar === " ") {
        if (!this.isWhitespace(upper[pos])) {
          return null;
        }

        while (this.isWhitespace(upper[pos])) {
          pos += 1;
        }

        continue;
      }

      if (upper[pos] !== phraseChar) {
        return null;
      }

      pos += 1;
    }

    return pos - offset;
  }

  private isKeywordBoundary(upper: string, offset: number): boolean {
    const char = upper[offset];
    if (char === undefined) {
      return true;
    }

    if (this.isWhitespace(char) || char === '"' || char === "'" || char === "`") {
      return true;
    }

    return this.matchBoundary(upper, offset) !== null;
  }

  private isReservedBlockedByContext(upper: string, offset: number, match: KeywordMatch): boolean {
    if (this.isPrecededByDot(upper, offset)) {
      return true;
    }

    if (match.phrase !== "SET") {
      return false;
    }

    const nextChar = upper[offset + match.length];
    if (nextChar === undefined || !this.isWhitespace(nextChar)) {
      return false;
    }

    const prefix = upper.slice(0, offset);
    return /\sCHARACTER\s$/u.test(prefix);
  }

  private isPrecededByDot(upper: string, offset: number): boolean {
    return offset > 0 && upper[offset - 1] === ".";
  }

  private matchSingleWordLength(upper: string, offset: number): number | null {
    const first = upper[offset];
    if (first === undefined) {
      return null;
    }

    const candidates = this.functionsByFirstChar.get(first);
    if (candidates === undefined) {
      return null;
    }

    for (const candidate of candidates) {
      if (candidate.includes(" ")) {
        continue;
      }

      if (!upper.startsWith(candidate, offset)) {
        continue;
      }

      const end = offset + candidate.length;
      if (!this.isKeywordBoundary(upper, end)) {
        continue;
      }

      return candidate.length;
    }

    return null;
  }

  private isNumberBoundary(input: string, offset: number): boolean {
    const char = input[offset];
    if (char === undefined) {
      return true;
    }

    if (this.isWhitespace(char) || char === '"' || char === "'" || char === "`") {
      return true;
    }

    return this.matchBoundary(input, offset) !== null;
  }

  private isWhitespace(char: string | undefined): boolean {
    return char !== undefined && /\s/u.test(char);
  }

  private isDigit(char: string | undefined): boolean {
    return char !== undefined && char >= "0" && char <= "9";
  }

  private isHexDigit(char: string | undefined): boolean {
    return char !== undefined && /[0-9a-fA-F]/u.test(char);
  }

  private isVariableNameChar(char: string | undefined): boolean {
    return char !== undefined && /[\w.$]/u.test(char);
  }
}
