import type { AbstractPlatform } from "../../platforms/abstract-platform";
import type { Name } from "../name";
import { Identifier } from "./identifier";

export class GenericName implements Name {
  private readonly identifiers: [Identifier, ...Identifier[]];

  constructor(firstIdentifier: Identifier, ...otherIdentifiers: Identifier[]) {
    this.identifiers = [firstIdentifier, ...otherIdentifiers];
  }

  public getIdentifiers(): [Identifier, ...Identifier[]] {
    return [...this.identifiers] as [Identifier, ...Identifier[]];
  }

  public toSQL(platform: AbstractPlatform): string {
    return this.joinIdentifiers((identifier) => identifier.toSQL(platform));
  }

  public toString(): string {
    return this.joinIdentifiers((identifier) => identifier.toString());
  }

  private joinIdentifiers(mapper: (identifier: Identifier) => string): string {
    return this.identifiers.map(mapper).join(".");
  }
}
