import type { SchemaException } from "../schema-exception";

export class NotImplemented extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "NotImplemented";
  }

  public static fromMethod(className: string, method: string): NotImplemented {
    return new NotImplemented(`Class ${className} does not implement method ${method}().`);
  }
}
