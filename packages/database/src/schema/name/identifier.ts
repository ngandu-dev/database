import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { InvalidIdentifier } from "../exception/invalid-identifier";
import { UnquotedIdentifierFolding, foldUnquotedIdentifier } from "./unquoted-identifier-folding";

export class Identifier {
  private constructor(
    private readonly value: string,
    private readonly quoted: boolean,
  ) {
    if (this.value.length === 0) {
      throw InvalidIdentifier.fromEmpty();
    }
  }

  public getValue(): string {
    return this.value;
  }

  public isQuoted(): boolean {
    return this.quoted;
  }

  public equals(other: Identifier, folding: UnquotedIdentifierFolding): boolean {
    if (this === other) {
      return true;
    }

    return this.toNormalizedValue(folding) === other.toNormalizedValue(folding);
  }

  public toSQL(platform: AbstractPlatform): string {
    const folding =
      typeof platform.getUnquotedIdentifierFolding === "function"
        ? platform.getUnquotedIdentifierFolding()
        : UnquotedIdentifierFolding.NONE;

    return platform.quoteSingleIdentifier(this.toNormalizedValue(folding));
  }

  public toNormalizedValue(folding: UnquotedIdentifierFolding): string {
    if (!this.quoted) {
      return foldUnquotedIdentifier(folding, this.value);
    }

    return this.value;
  }

  public toString(): string {
    if (!this.quoted) {
      return this.value;
    }

    return `"${this.value.replace(/"/g, `""`)}"`;
  }

  public static quoted(value: string): Identifier {
    return new Identifier(value, true);
  }

  public static unquoted(value: string): Identifier {
    return new Identifier(value, false);
  }
}
