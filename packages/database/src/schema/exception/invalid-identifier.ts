import type { SchemaException } from "../schema-exception";

export class InvalidIdentifier extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIdentifier";
  }

  public static fromEmpty(): InvalidIdentifier {
    return new InvalidIdentifier("Identifier cannot be empty.");
  }
}
