import { TokenType } from "./TokenType";

export class Token {
  public readonly type: TokenType;
  public readonly value: string;

  public constructor(type: TokenType, value: string) {
    if (value.length === 0) {
      throw new Error("Token value cannot be empty");
    }

    this.type = type;
    this.value = value;
  }

  public isOfType(...types: TokenType[]): boolean {
    return types.includes(this.type);
  }

  public hasExtraWhitespace(): boolean {
    return this.value.includes(" ") || this.value.includes("\n") || this.value.includes("\t");
  }

  public withValue(value: string): Token {
    return new Token(this.type, value);
  }
}
