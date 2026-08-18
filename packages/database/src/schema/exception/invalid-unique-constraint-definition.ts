import type { SchemaException } from "../schema-exception";
import { nameToString } from "./_internal";

export class InvalidUniqueConstraintDefinition extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUniqueConstraintDefinition";
  }

  public static columnNamesAreNotSet(constraintName: unknown): InvalidUniqueConstraintDefinition {
    return new InvalidUniqueConstraintDefinition(
      `Column names are not set for unique constraint ${nameToString(constraintName)}.`,
    );
  }
}
