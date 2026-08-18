export class ExpectedNextIdentifier extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectedNextIdentifier";
  }

  public static new(): ExpectedNextIdentifier {
    return new ExpectedNextIdentifier("Unexpected end of input. Next identifier expected.");
  }
}
