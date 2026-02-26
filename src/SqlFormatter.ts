import { CliHighlighter } from "./CliHighlighter";
import { Highlighter } from "./Highlighter";
import { HtmlHighlighter } from "./HtmlHighlighter";
import { Tokenizer } from "./Tokenizer";
import { TokenType } from "./TokenType";

const INDENT_TYPE_BLOCK = "block";
const INDENT_TYPE_SPECIAL = "special";

function rtrimChars(value: string, charsPattern = " "): string {
  return value.replace(new RegExp(`[${charsPattern}]+$`, "u"), "");
}

function repeatIndent(level: number, tab: string): string {
  return tab.repeat(Math.max(level, 0));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ");
}

function isCliRuntime(): boolean {
  return (
    typeof process !== "undefined" && process?.stdout !== undefined && process?.stdin !== undefined
  );
}

export class SqlFormatter {
  private readonly highlighter: Highlighter;
  private readonly tokenizer: Tokenizer;

  public constructor(highlighter?: Highlighter | null) {
    this.tokenizer = new Tokenizer();
    this.highlighter =
      highlighter ?? (isCliRuntime() ? new CliHighlighter() : new HtmlHighlighter());
  }

  public format(input: string, indentString = "  "): string {
    let result = "";
    const tab = "\t";

    let indentLevel = 0;
    let newline = false;
    let inlineParentheses = false;
    let increaseSpecialIndent = false;
    let increaseBlockIndent = false;
    const indentTypes: string[] = [];
    let addedNewline = false;
    let inlineCount = 0;
    let inlineIndented = false;
    let clauseLimit = false;

    const appendNewLineIfNotAdded = (): void => {
      if (addedNewline) {
        return;
      }

      result = rtrimChars(result, " \\t");
      result += `\n${repeatIndent(indentLevel, tab)}`;
    };

    const decreaseIndentationLevel = (): void => {
      indentTypes.pop();
      indentLevel -= 1;

      const safeIndentLevel = Math.max(indentLevel, 0);
      const lastPossiblyIndentLine = result.slice(-(safeIndentLevel + 2));
      if (rtrimChars(lastPossiblyIndentLine, "\\t") !== "\n") {
        return;
      }

      let rtrimLength = safeIndentLevel + 1;
      while (result.slice(-(rtrimLength + 2), -(rtrimLength + 1)) === "\n") {
        rtrimLength += 1;
      }

      result = `${result.slice(0, -rtrimLength)}${repeatIndent(indentLevel, tab)}`;
    };

    const cursor = this.tokenizer.tokenize(input);

    while (true) {
      const token = cursor.next(TokenType.WHITESPACE);
      if (token === null) {
        break;
      }

      const prevNotWhitespaceToken = cursor.subCursor().previous(TokenType.WHITESPACE);
      let tokenValueUpper: string | false = token.value.toUpperCase();
      if (prevNotWhitespaceToken !== null && prevNotWhitespaceToken.value === ".") {
        tokenValueUpper = false;
      }

      let highlighted = this.highlighter.highlightToken(token.type, token.value);

      if (increaseSpecialIndent) {
        indentLevel += 1;
        increaseSpecialIndent = false;
        indentTypes.push(INDENT_TYPE_SPECIAL);
      }

      if (increaseBlockIndent) {
        indentLevel += 1;
        increaseBlockIndent = false;
        indentTypes.push(INDENT_TYPE_BLOCK);
      }

      if (newline) {
        result = rtrimChars(result, " ");

        if (prevNotWhitespaceToken !== null && prevNotWhitespaceToken.value === ";") {
          result += "\n";
        }

        result += `\n${repeatIndent(indentLevel, tab)}`;
        newline = false;
        addedNewline = true;
      } else {
        addedNewline = false;
      }

      if (token.isOfType(TokenType.COMMENT, TokenType.BLOCK_COMMENT)) {
        if (token.isOfType(TokenType.BLOCK_COMMENT)) {
          const indent = repeatIndent(indentLevel, tab);
          result = rtrimChars(result, " \\t");
          result += `\n${indent}`;
          highlighted = highlighted.replaceAll("\n", `\n${indent}`);
        }

        result += highlighted;
        newline = true;
        continue;
      }

      if (inlineParentheses) {
        if (token.value === ")") {
          result = rtrimChars(result, " ");

          if (inlineIndented) {
            decreaseIndentationLevel();
            result = rtrimChars(result, " ");
            result += `\n${repeatIndent(indentLevel, tab)}`;
          }

          inlineParentheses = false;
          result += `${highlighted} `;
          continue;
        }

        if (token.value === "," && inlineCount >= 30) {
          inlineCount = 0;
          newline = true;
        }

        inlineCount += token.value.length;
      }

      if (token.value === "(") {
        let length = 0;
        const subCursor = cursor.subCursor();

        for (let j = 1; j <= 250; j += 1) {
          const next = subCursor.next(TokenType.WHITESPACE);
          if (next === null) {
            break;
          }

          if (next.value === ")") {
            inlineParentheses = true;
            inlineCount = 0;
            inlineIndented = false;
            break;
          }

          if (next.value === ";" || next.value === "(") {
            break;
          }

          if (
            next.isOfType(
              TokenType.RESERVED_TOPLEVEL,
              TokenType.RESERVED_NEWLINE,
              TokenType.COMMENT,
              TokenType.BLOCK_COMMENT,
            )
          ) {
            break;
          }

          length += next.value.length;
        }

        if (inlineParentheses && length > 30) {
          increaseBlockIndent = true;
          inlineIndented = true;
          newline = true;
        }

        const prevToken = cursor.subCursor().previous();
        if (prevToken !== null && !prevToken.isOfType(TokenType.WHITESPACE)) {
          result = rtrimChars(result, " ");
        }

        if (!inlineParentheses) {
          increaseBlockIndent = true;
          newline = true;
        }
      } else if (token.value === ")") {
        result = rtrimChars(result, " ");

        while (indentTypes.at(-1) === INDENT_TYPE_SPECIAL) {
          decreaseIndentationLevel();
        }

        decreaseIndentationLevel();

        if (indentLevel < 0) {
          indentLevel = 0;
          result += this.highlighter.highlightError(token.value);
          continue;
        }

        appendNewLineIfNotAdded();
      } else if (token.isOfType(TokenType.RESERVED_TOPLEVEL)) {
        increaseSpecialIndent = true;

        if (indentTypes.at(-1) === INDENT_TYPE_SPECIAL) {
          decreaseIndentationLevel();
        }

        newline = true;
        appendNewLineIfNotAdded();

        if (token.hasExtraWhitespace()) {
          highlighted = collapseWhitespace(highlighted);
        }

        if (tokenValueUpper === "LIMIT" && !inlineParentheses) {
          clauseLimit = true;
        }
      } else if (token.value === ";") {
        if (indentTypes.at(-1) === INDENT_TYPE_SPECIAL) {
          decreaseIndentationLevel();
        }

        newline = true;
      } else if (tokenValueUpper === "CASE") {
        increaseBlockIndent = true;
      } else if (tokenValueUpper === "BEGIN") {
        newline = true;
        increaseBlockIndent = true;
      } else if (tokenValueUpper === "LOOP") {
        if (
          prevNotWhitespaceToken !== null &&
          prevNotWhitespaceToken.value.toUpperCase() !== "END"
        ) {
          newline = true;
          increaseBlockIndent = true;
        }
      } else if (
        tokenValueUpper !== false &&
        ["WHEN", "THEN", "ELSE", "END"].includes(tokenValueUpper)
      ) {
        if (tokenValueUpper !== "THEN") {
          decreaseIndentationLevel();

          if (
            prevNotWhitespaceToken !== null &&
            prevNotWhitespaceToken.value.toUpperCase() !== "CASE"
          ) {
            appendNewLineIfNotAdded();
          }
        }

        if (tokenValueUpper === "THEN" || tokenValueUpper === "ELSE") {
          newline = true;
          increaseBlockIndent = true;
        }
      } else if (
        clauseLimit &&
        token.value !== "," &&
        !token.isOfType(TokenType.NUMBER, TokenType.WHITESPACE)
      ) {
        clauseLimit = false;
      } else if (token.value === "," && !inlineParentheses) {
        if (clauseLimit) {
          newline = false;
          clauseLimit = false;
        } else {
          newline = true;
        }
      } else if (token.isOfType(TokenType.RESERVED_NEWLINE)) {
        appendNewLineIfNotAdded();

        if (token.hasExtraWhitespace()) {
          highlighted = collapseWhitespace(highlighted);
        }
      } else if (token.isOfType(TokenType.BOUNDARY)) {
        if (prevNotWhitespaceToken?.isOfType(TokenType.BOUNDARY)) {
          const prevToken = cursor.subCursor().previous();
          if (prevToken !== null && !prevToken.isOfType(TokenType.WHITESPACE)) {
            result = rtrimChars(result, " ");
          }
        }
      }

      if (token.value === "." || token.value === "," || token.value === ";") {
        result = rtrimChars(result, " ");
      }

      result += `${highlighted} `;

      if (token.value === "(" || token.value === ".") {
        result = rtrimChars(result, " ");
      }

      if (token.value !== "-") {
        continue;
      }

      const nextNotWhitespace = cursor.subCursor().next(TokenType.WHITESPACE);
      if (nextNotWhitespace === null || !nextNotWhitespace.isOfType(TokenType.NUMBER)) {
        continue;
      }

      const prev = cursor.subCursor().previous(TokenType.WHITESPACE);
      if (prev === null) {
        continue;
      }

      if (
        prev.isOfType(TokenType.QUOTE, TokenType.BACKTICK_QUOTE, TokenType.WORD, TokenType.NUMBER)
      ) {
        continue;
      }

      result = rtrimChars(result, " ");
    }

    if (indentTypes.includes(INDENT_TYPE_BLOCK)) {
      result = rtrimChars(result, " ");
      result += this.highlighter.highlightErrorMessage("WARNING: unclosed parentheses or section");
    }

    result = result.replaceAll(tab, indentString).trim();
    return this.highlighter.output(result);
  }

  public highlight(input: string): string {
    const cursor = this.tokenizer.tokenize(input);
    let result = "";

    while (true) {
      const token = cursor.next();
      if (token === null) {
        break;
      }

      result += this.highlighter.highlightToken(token.type, token.value);
    }

    return this.highlighter.output(result);
  }

  public compress(input: string): string {
    let result = "";
    const cursor = this.tokenizer.tokenize(input);
    let whitespace = true;

    while (true) {
      let token = cursor.next();
      if (token === null) {
        break;
      }

      if (token.isOfType(TokenType.COMMENT, TokenType.BLOCK_COMMENT)) {
        continue;
      }

      if (
        token.isOfType(TokenType.RESERVED, TokenType.RESERVED_NEWLINE, TokenType.RESERVED_TOPLEVEL)
      ) {
        token = token.withValue(collapseWhitespace(token.value));
      }

      if (token.isOfType(TokenType.WHITESPACE)) {
        if (whitespace) {
          continue;
        }

        whitespace = true;
        token = token.withValue(" ");
      } else {
        whitespace = false;
      }

      result += token.value;
    }

    return result.replace(/\s+$/u, "");
  }

  public getTokenizer(): Tokenizer {
    return this.tokenizer;
  }

  public getHighlighter(): Highlighter {
    return this.highlighter;
  }
}
