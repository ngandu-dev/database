import { Highlighter } from "./Highlighter";
import { TokenType } from "./TokenType";

export class NullHighlighter extends Highlighter {
  public highlightToken(_type: TokenType, value: string): string {
    return value;
  }

  public highlightError(value: string): string {
    return value;
  }

  public highlightErrorMessage(value: string): string {
    return ` ${value}`;
  }

  public output(value: string): string {
    return value;
  }
}
