import type { SchemaException } from "../schema-exception";
import { attachCause, nameToString, previousObjectNameToString } from "./_internal";

export class InvalidTableModification extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTableModification";
  }

  public static columnAlreadyExists(
    tableName: unknown,
    previous: unknown,
  ): InvalidTableModification {
    return attachCause(
      new InvalidTableModification(
        `Column ${previousObjectNameToString(previous)} already exists on table ${InvalidTableModification.formatTableName(tableName)}.`,
      ),
      previous,
    );
  }

  public static columnDoesNotExist(
    tableName: unknown,
    previous: unknown,
  ): InvalidTableModification {
    return attachCause(
      new InvalidTableModification(
        `Column ${previousObjectNameToString(previous)} does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
      ),
      previous,
    );
  }

  public static indexAlreadyExists(
    tableName: unknown,
    previous: unknown,
  ): InvalidTableModification {
    return attachCause(
      new InvalidTableModification(
        `Index ${previousObjectNameToString(previous)} already exists on table ${InvalidTableModification.formatTableName(tableName)}.`,
      ),
      previous,
    );
  }

  public static indexDoesNotExist(tableName: unknown, previous: unknown): InvalidTableModification {
    return attachCause(
      new InvalidTableModification(
        `Index ${previousObjectNameToString(previous)} does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
      ),
      previous,
    );
  }

  public static primaryKeyConstraintAlreadyExists(tableName: unknown): InvalidTableModification {
    return new InvalidTableModification(
      `Primary key constraint already exists on table ${InvalidTableModification.formatTableName(tableName)}.`,
    );
  }

  public static primaryKeyConstraintDoesNotExist(tableName: unknown): InvalidTableModification {
    return new InvalidTableModification(
      `Primary key constraint does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
    );
  }

  public static uniqueConstraintAlreadyExists(
    tableName: unknown,
    previous: unknown,
  ): InvalidTableModification {
    return attachCause(
      new InvalidTableModification(
        `Unique constraint ${previousObjectNameToString(previous)} already exists on table ${InvalidTableModification.formatTableName(tableName)}.`,
      ),
      previous,
    );
  }

  public static uniqueConstraintDoesNotExist(
    tableName: unknown,
    previous: unknown,
  ): InvalidTableModification {
    return attachCause(
      new InvalidTableModification(
        `Unique constraint ${previousObjectNameToString(previous)} does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
      ),
      previous,
    );
  }

  public static foreignKeyConstraintAlreadyExists(
    tableName: unknown,
    previous: unknown,
  ): InvalidTableModification {
    return attachCause(
      new InvalidTableModification(
        `Foreign key constraint ${previousObjectNameToString(previous)} already exists on table ${InvalidTableModification.formatTableName(tableName)}.`,
      ),
      previous,
    );
  }

  public static foreignKeyConstraintDoesNotExist(
    tableName: unknown,
    previous: unknown,
  ): InvalidTableModification {
    return attachCause(
      new InvalidTableModification(
        `Foreign key constraint ${previousObjectNameToString(previous)} does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
      ),
      previous,
    );
  }

  public static indexedColumnDoesNotExist(
    tableName: unknown,
    indexName: unknown,
    columnName: unknown,
  ): InvalidTableModification {
    return new InvalidTableModification(
      `Column ${nameToString(columnName)} referenced by index ${nameToString(indexName)} does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
    );
  }

  public static primaryKeyConstraintColumnDoesNotExist(
    tableName: unknown,
    constraintName: unknown,
    columnName: unknown,
  ): InvalidTableModification {
    return new InvalidTableModification(
      `Column ${nameToString(columnName)} referenced by primary key constraint ${InvalidTableModification.formatConstraintName(constraintName)} does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
    );
  }

  public static uniqueConstraintColumnDoesNotExist(
    tableName: unknown,
    constraintName: unknown,
    columnName: unknown,
  ): InvalidTableModification {
    return new InvalidTableModification(
      `Column ${nameToString(columnName)} referenced by unique constraint ${InvalidTableModification.formatConstraintName(constraintName)} does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
    );
  }

  public static foreignKeyConstraintReferencingColumnDoesNotExist(
    tableName: unknown,
    constraintName: unknown,
    columnName: unknown,
  ): InvalidTableModification {
    return new InvalidTableModification(
      `Referencing column ${nameToString(columnName)} of foreign key constraint ${InvalidTableModification.formatConstraintName(constraintName)} does not exist on table ${InvalidTableModification.formatTableName(tableName)}.`,
    );
  }

  private static formatTableName(tableName: unknown): string {
    return nameToString(tableName);
  }
  private static formatConstraintName(constraintName: unknown): string {
    return nameToString(constraintName);
  }
}
