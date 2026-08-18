export class InvalidName extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidName";
  }

  public static forUnqualifiedName(count: number): InvalidName {
    return new InvalidName(`An unqualified name must consist of one identifier, ${count} given.`);
  }

  public static forOptionallyQualifiedName(count: number): InvalidName {
    return new InvalidName(
      `An optionally qualified name must consist of one or two identifiers, ${count} given.`,
    );
  }
}
