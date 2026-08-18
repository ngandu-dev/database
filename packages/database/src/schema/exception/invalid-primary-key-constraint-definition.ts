import type { SchemaException } from "../schema-exception";

export class InvalidPrimaryKeyConstraintDefinition extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPrimaryKeyConstraintDefinition";
  }

  public static columnNamesNotSet(): InvalidPrimaryKeyConstraintDefinition {
    return new InvalidPrimaryKeyConstraintDefinition(
      "Primary key constraint column names are not set.",
    );
  }
}
