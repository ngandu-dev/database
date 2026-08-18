import type { AbstractPlatform } from "../../platforms/abstract-platform";
import { IncomparableNames } from "../exception/incomparable-names";
import type { Name } from "../name";
import { Identifier } from "./identifier";
import type { UnquotedIdentifierFolding } from "./unquoted-identifier-folding";

export class OptionallyQualifiedName implements Name {
  constructor(
    private readonly unqualifiedName: Identifier,
    private readonly qualifier: Identifier | null,
  ) {}

  public getUnqualifiedName(): Identifier {
    return this.unqualifiedName;
  }

  public getQualifier(): Identifier | null {
    return this.qualifier;
  }

  public toSQL(platform: AbstractPlatform): string {
    const unqualifiedName = this.unqualifiedName.toSQL(platform);

    if (this.qualifier === null) {
      return unqualifiedName;
    }

    return `${this.qualifier.toSQL(platform)}.${unqualifiedName}`;
  }

  public toString(): string {
    const unqualifiedName = this.unqualifiedName.toString();

    if (this.qualifier === null) {
      return unqualifiedName;
    }

    return `${this.qualifier.toString()}.${unqualifiedName}`;
  }

  public equals(other: OptionallyQualifiedName, folding: UnquotedIdentifierFolding): boolean {
    if (this === other) {
      return true;
    }

    if ((this.qualifier === null) !== (other.qualifier === null)) {
      throw IncomparableNames.fromOptionallyQualifiedNames(this, other);
    }

    if (!this.unqualifiedName.equals(other.getUnqualifiedName(), folding)) {
      return false;
    }

    return (
      this.qualifier === null ||
      other.qualifier === null ||
      this.qualifier.equals(other.qualifier, folding)
    );
  }

  public static quoted(
    unqualifiedName: string,
    qualifier: string | null = null,
  ): OptionallyQualifiedName {
    return new OptionallyQualifiedName(
      Identifier.quoted(unqualifiedName),
      qualifier !== null ? Identifier.quoted(qualifier) : null,
    );
  }

  public static unquoted(
    unqualifiedName: string,
    qualifier: string | null = null,
  ): OptionallyQualifiedName {
    return new OptionallyQualifiedName(
      Identifier.unquoted(unqualifiedName),
      qualifier !== null ? Identifier.unquoted(qualifier) : null,
    );
  }
}
