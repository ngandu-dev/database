export class ExpectedDot extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectedDot";
  }

  public static new(position: number, got: string): ExpectedDot {
    return new ExpectedDot(`Expected dot at position ${position}, got "${got}".`);
  }
}
