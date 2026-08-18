import type { SchemaException } from "../schema-exception";

export class UniqueConstraintDoesNotExist extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "UniqueConstraintDoesNotExist";
  }

  public static new(constraintName: string, table: string): UniqueConstraintDoesNotExist {
    return new UniqueConstraintDoesNotExist(
      `There exists no unique constraint with the name "${constraintName}" on table "${table}".`,
    );
  }
}
