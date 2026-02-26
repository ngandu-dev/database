import { Token } from "./Token";
import { TokenType } from "./TokenType";

export class Cursor {
  private position = -1;

  public constructor(private readonly tokens: readonly Token[]) {}

  public next(exceptTokenType?: TokenType): Token | null {
    while (true) {
      this.position += 1;
      const token = this.tokens[this.position];
      if (token === undefined) {
        return null;
      }

      if (exceptTokenType !== undefined && token.isOfType(exceptTokenType)) {
        continue;
      }

      return token;
    }
  }

  public previous(exceptTokenType?: TokenType): Token | null {
    while (true) {
      this.position -= 1;
      const token = this.tokens[this.position];
      if (token === undefined) {
        return null;
      }

      if (exceptTokenType !== undefined && token.isOfType(exceptTokenType)) {
        continue;
      }

      return token;
    }
  }

  public subCursor(): Cursor {
    const cursor = new Cursor(this.tokens);
    cursor.position = this.position;
    return cursor;
  }
}
