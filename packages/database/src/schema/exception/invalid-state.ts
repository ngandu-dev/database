import type { SchemaException } from "../schema-exception";

export class InvalidState extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidState";
  }

  public static objectNameNotInitialized(): InvalidState {
    return new InvalidState("Object name has not been initialized.");
  }
  public static indexHasInvalidType(indexName: string): InvalidState {
    return new InvalidState(`Index "${indexName}" has invalid type.`);
  }
  public static indexHasInvalidPredicate(indexName: string): InvalidState {
    return new InvalidState(`Index "${indexName}" has invalid predicate.`);
  }
  public static indexHasInvalidColumns(indexName: string): InvalidState {
    return new InvalidState(`Index "${indexName}" has invalid columns.`);
  }
  public static foreignKeyConstraintHasInvalidReferencedTableName(
    constraintName: string,
  ): InvalidState {
    return new InvalidState(
      `Foreign key constraint "${constraintName}" has invalid referenced table name.`,
    );
  }
  public static foreignKeyConstraintHasInvalidReferencingColumnNames(
    constraintName: string,
  ): InvalidState {
    return new InvalidState(
      `Foreign key constraint "${constraintName}" has one or more invalid referencing column names.`,
    );
  }
  public static foreignKeyConstraintHasInvalidReferencedColumnNames(
    constraintName: string,
  ): InvalidState {
    return new InvalidState(
      `Foreign key constraint "${constraintName}" has one or more invalid referenced column name.`,
    );
  }
  public static foreignKeyConstraintHasInvalidMatchType(constraintName: string): InvalidState {
    return new InvalidState(`Foreign key constraint "${constraintName}" has invalid match type.`);
  }
  public static foreignKeyConstraintHasInvalidOnUpdateAction(constraintName: string): InvalidState {
    return new InvalidState(
      `Foreign key constraint "${constraintName}" has invalid ON UPDATE action.`,
    );
  }
  public static foreignKeyConstraintHasInvalidOnDeleteAction(constraintName: string): InvalidState {
    return new InvalidState(
      `Foreign key constraint "${constraintName}" has invalid ON DELETE action.`,
    );
  }
  public static foreignKeyConstraintHasInvalidDeferrability(constraintName: string): InvalidState {
    return new InvalidState(
      `Foreign key constraint "${constraintName}" has invalid deferrability.`,
    );
  }
  public static uniqueConstraintHasInvalidColumnNames(constraintName: string): InvalidState {
    return new InvalidState(
      `Unique constraint "${constraintName}" has one or more invalid column names.`,
    );
  }
  public static uniqueConstraintHasEmptyColumnNames(constraintName: string): InvalidState {
    return new InvalidState(`Unique constraint "${constraintName}" has no column names.`);
  }
  public static tableHasInvalidPrimaryKeyConstraint(tableName: string): InvalidState {
    return new InvalidState(`Table "${tableName}" has invalid primary key constraint.`);
  }
  public static tableDiffContainsUnnamedDroppedForeignKeyConstraints(): InvalidState {
    return new InvalidState("Table diff contains unnamed dropped foreign key constraints");
  }
}
