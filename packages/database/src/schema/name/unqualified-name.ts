import type { AbstractPlatform } from "../../platforms/abstract-platform";
import type { Name } from "../name";
import { Identifier } from "./identifier";
import type { UnquotedIdentifierFolding } from "./unquoted-identifier-folding";

export class UnqualifiedName implements Name {
  constructor(private readonly identifier: Identifier) {}

  public getIdentifier(): Identifier {
    return this.identifier;
  }

  public toSQL(platform: AbstractPlatform): string {
    return this.identifier.toSQL(platform);
  }

  public toString(): string {
    return this.identifier.toString();
  }

  public equals(other: UnqualifiedName, folding: UnquotedIdentifierFolding): boolean {
    if (this === other) {
      return true;
    }

    return this.identifier.equals(other.getIdentifier(), folding);
  }

  public static quoted(value: string): UnqualifiedName {
    return new UnqualifiedName(Identifier.quoted(value));
  }

  public static unquoted(value: string): UnqualifiedName {
    return new UnqualifiedName(Identifier.unquoted(value));
  }
}
