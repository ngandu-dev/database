import type { Parser } from "../parser";
import { UnqualifiedName } from "../unqualified-name";
import { InvalidName } from "./exception/invalid-name";
import { GenericNameParser } from "./generic-name-parser";

export class UnqualifiedNameParser implements Parser<UnqualifiedName> {
  constructor(private readonly genericNameParser: GenericNameParser) {}

  public parse(input: string): UnqualifiedName {
    const identifiers = this.genericNameParser.parse(input).getIdentifiers();

    if (identifiers.length > 1) {
      throw InvalidName.forUnqualifiedName(identifiers.length);
    }

    const identifier = identifiers[0];
    if (identifier === undefined) {
      throw InvalidName.forUnqualifiedName(0);
    }

    return new UnqualifiedName(identifier);
  }
}
