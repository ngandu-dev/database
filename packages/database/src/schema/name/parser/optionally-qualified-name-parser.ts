import { OptionallyQualifiedName } from "../optionally-qualified-name";
import type { Parser } from "../parser";
import { InvalidName } from "./exception/invalid-name";
import { GenericNameParser } from "./generic-name-parser";

export class OptionallyQualifiedNameParser implements Parser<OptionallyQualifiedName> {
  constructor(private readonly genericNameParser: GenericNameParser) {}

  public parse(input: string): OptionallyQualifiedName {
    const identifiers = this.genericNameParser.parse(input).getIdentifiers();
    const first = identifiers[0];
    const second = identifiers[1];

    switch (identifiers.length) {
      case 1:
        if (first === undefined) {
          throw InvalidName.forOptionallyQualifiedName(0);
        }

        return new OptionallyQualifiedName(first, null);
      case 2:
        if (first === undefined || second === undefined) {
          throw InvalidName.forOptionallyQualifiedName(identifiers.length);
        }

        return new OptionallyQualifiedName(second, first);
      default:
        throw InvalidName.forOptionallyQualifiedName(identifiers.length);
    }
  }
}
