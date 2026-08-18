import { GenericNameParser } from "./parser/generic-name-parser";
import { OptionallyQualifiedNameParser } from "./parser/optionally-qualified-name-parser";
import { UnqualifiedNameParser } from "./parser/unqualified-name-parser";

export class Parsers {
  private static unqualifiedNameParser: UnqualifiedNameParser | null = null;
  private static optionallyQualifiedNameParser: OptionallyQualifiedNameParser | null = null;
  private static genericNameParser: GenericNameParser | null = null;

  private constructor() {}

  public static getUnqualifiedNameParser(): UnqualifiedNameParser {
    Parsers.unqualifiedNameParser ??= new UnqualifiedNameParser(Parsers.getGenericNameParser());
    return Parsers.unqualifiedNameParser;
  }

  public static getOptionallyQualifiedNameParser(): OptionallyQualifiedNameParser {
    Parsers.optionallyQualifiedNameParser ??= new OptionallyQualifiedNameParser(
      Parsers.getGenericNameParser(),
    );
    return Parsers.optionallyQualifiedNameParser;
  }

  public static getGenericNameParser(): GenericNameParser {
    Parsers.genericNameParser ??= new GenericNameParser();
    return Parsers.genericNameParser;
  }
}
