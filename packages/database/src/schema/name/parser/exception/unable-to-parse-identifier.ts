export class UnableToParseIdentifier extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnableToParseIdentifier";
  }

  public static new(offset: number): UnableToParseIdentifier {
    return new UnableToParseIdentifier(`Unable to parse identifier at offset ${offset}.`);
  }
}
