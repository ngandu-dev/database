import { Highlighter } from "./Highlighter";
import { TokenType } from "./TokenType";

export class CliHighlighter extends Highlighter {
  public static readonly HIGHLIGHT_FUNCTIONS = "functions";

  private readonly escapeSequences: Readonly<Record<string, string>>;

  public constructor(escapeSequences: Partial<Record<string, string>> = {}) {
    super();
    this.escapeSequences = {
      [Highlighter.HIGHLIGHT_QUOTE]: "\u001b[34;1m",
      [Highlighter.HIGHLIGHT_BACKTICK_QUOTE]: "\u001b[35;1m",
      [Highlighter.HIGHLIGHT_RESERVED]: "\u001b[37m",
      [Highlighter.HIGHLIGHT_BOUNDARY]: "",
      [Highlighter.HIGHLIGHT_NUMBER]: "\u001b[32;1m",
      [Highlighter.HIGHLIGHT_WORD]: "",
      [Highlighter.HIGHLIGHT_ERROR]: "\u001b[31;1;7m",
      [Highlighter.HIGHLIGHT_COMMENT]: "\u001b[30;1m",
      [Highlighter.HIGHLIGHT_VARIABLE]: "\u001b[36;1m",
      [CliHighlighter.HIGHLIGHT_FUNCTIONS]: "\u001b[37m",
      ...escapeSequences,
    };
  }

  public highlightToken(type: TokenType, value: string): string {
    if (type === TokenType.BOUNDARY && (value === "(" || value === ")")) {
      return value;
    }

    const prefix = this.prefix(type);
    if (prefix === null) {
      return value;
    }

    return `${prefix}${value}\u001b[0m`;
  }

  public highlightError(value: string): string {
    return `\n${this.escapeSequences[Highlighter.HIGHLIGHT_ERROR]}${value}\u001b[0m`;
  }

  public highlightErrorMessage(value: string): string {
    return this.highlightError(value);
  }

  public output(value: string): string {
    return `${value}\n`;
  }

  private prefix(type: TokenType): string | null {
    const highlightType = Highlighter.TOKEN_TYPE_TO_HIGHLIGHT[type];
    if (highlightType === undefined) {
      return null;
    }

    return this.escapeSequences[highlightType] ?? "";
  }
}
