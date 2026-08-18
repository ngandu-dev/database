export class ObjectAlreadyExists extends Error {
  private readonly objectName: string;

  constructor(message: string, objectName: string) {
    super(message);
    this.name = "ObjectAlreadyExists";
    this.objectName = objectName;
  }

  public getObjectName(): { toString(): string } {
    return {
      toString: () => this.objectName,
    };
  }

  public static new(objectName: unknown): ObjectAlreadyExists {
    const normalized = typeof objectName === "string" ? objectName : String(objectName);
    return new ObjectAlreadyExists(`Object ${normalized} already exists.`, normalized);
  }
}
