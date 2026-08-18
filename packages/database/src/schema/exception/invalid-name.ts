import type { SchemaException } from "../schema-exception";

export class InvalidName extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidName";
  }

  public static fromEmpty(): InvalidName {
    return new InvalidName("Name cannot be empty.");
  }
}
