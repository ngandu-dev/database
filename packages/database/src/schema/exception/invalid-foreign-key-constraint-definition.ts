import type { SchemaException } from "../schema-exception";
import { nameToString } from "./_internal";

export class InvalidForeignKeyConstraintDefinition extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidForeignKeyConstraintDefinition";
  }

  public static referencedTableNameNotSet(
    constraintName: unknown,
  ): InvalidForeignKeyConstraintDefinition {
    return new InvalidForeignKeyConstraintDefinition(
      `Referenced table name is not set for foreign key constraint ${InvalidForeignKeyConstraintDefinition.formatName(constraintName)}.`,
    );
  }

  public static referencingColumnNamesNotSet(
    constraintName: unknown,
  ): InvalidForeignKeyConstraintDefinition {
    return new InvalidForeignKeyConstraintDefinition(
      `Referencing column names are not set for foreign key constraint ${InvalidForeignKeyConstraintDefinition.formatName(constraintName)}.`,
    );
  }

  public static referencedColumnNamesNotSet(
    constraintName: unknown,
  ): InvalidForeignKeyConstraintDefinition {
    return new InvalidForeignKeyConstraintDefinition(
      `Referenced column names are not set for foreign key constraint ${InvalidForeignKeyConstraintDefinition.formatName(constraintName)}.`,
    );
  }

  private static formatName(constraintName: unknown): string {
    return nameToString(constraintName);
  }
}
