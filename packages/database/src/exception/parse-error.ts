import type { Exception as ParserException } from "../sql/parser/exception";
import { initializeException } from "./_internal";

export class ParseError extends Error {
  public static fromParserException(exception: ParserException): ParseError {
    return new ParseError("Unable to parse query.", exception);
  }

  constructor(message: string, cause?: unknown) {
    super(message);
    initializeException(this, new.target);

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
