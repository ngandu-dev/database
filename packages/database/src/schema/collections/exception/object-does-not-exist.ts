export class ObjectDoesNotExist extends Error {
  private readonly objectName: string;

  constructor(message: string, objectName: string) {
    super(message);
    this.name = "ObjectDoesNotExist";
    this.objectName = objectName;
  }

  public getObjectName(): { toString(): string } {
    return {
      toString: () => this.objectName,
    };
  }

  public static new(objectName: unknown): ObjectDoesNotExist {
    const normalized = typeof objectName === "string" ? objectName : String(objectName);
    return new ObjectDoesNotExist(`Object ${normalized} does not exist.`, normalized);
  }
}
