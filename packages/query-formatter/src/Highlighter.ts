import { TokenType } from "./TokenType";

export abstract class Highlighter {
  public static readonly HIGHLIGHT_BOUNDARY = "boundary";
  public static readonly HIGHLIGHT_WORD = "word";
  public static readonly HIGHLIGHT_BACKTICK_QUOTE = "backtickQuote";
  public static readonly HIGHLIGHT_QUOTE = "quote";
  public static readonly HIGHLIGHT_RESERVED = "reserved";
  public static readonly HIGHLIGHT_NUMBER = "number";
  public static readonly HIGHLIGHT_VARIABLE = "variable";
  public static readonly HIGHLIGHT_COMMENT = "comment";
  public static readonly HIGHLIGHT_ERROR = "error";

  public static readonly TOKEN_TYPE_TO_HIGHLIGHT: Readonly<Partial<Record<TokenType, string>>> = {
    [TokenType.BOUNDARY]: Highlighter.HIGHLIGHT_BOUNDARY,
    [TokenType.WORD]: Highlighter.HIGHLIGHT_WORD,
    [TokenType.BACKTICK_QUOTE]: Highlighter.HIGHLIGHT_BACKTICK_QUOTE,
    [TokenType.QUOTE]: Highlighter.HIGHLIGHT_QUOTE,
    [TokenType.RESERVED]: Highlighter.HIGHLIGHT_RESERVED,
    [TokenType.RESERVED_TOPLEVEL]: Highlighter.HIGHLIGHT_RESERVED,
    [TokenType.RESERVED_NEWLINE]: Highlighter.HIGHLIGHT_RESERVED,
    [TokenType.NUMBER]: Highlighter.HIGHLIGHT_NUMBER,
    [TokenType.VARIABLE]: Highlighter.HIGHLIGHT_VARIABLE,
    [TokenType.COMMENT]: Highlighter.HIGHLIGHT_COMMENT,
    [TokenType.BLOCK_COMMENT]: Highlighter.HIGHLIGHT_COMMENT,
  };

  public abstract highlightToken(type: TokenType, value: string): string;

  public abstract highlightError(value: string): string;

  public abstract highlightErrorMessage(value: string): string;

  public abstract output(value: string): string;
}
