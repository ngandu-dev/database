import type { SchemaException } from "../schema-exception";

export class UnsupportedSchema extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedSchema";
  }

  public static sqliteMissingForeignKeyConstraintReferencedColumns(
    constraintName: string | null,
    referencingTableName: string,
    referencedTableName: string,
  ): UnsupportedSchema {
    const constraintReference = constraintName !== null ? `"${constraintName}"` : "<unnamed>";

    return new UnsupportedSchema(
      `Unable to introspect foreign key constraint ${constraintReference} on table "${referencingTableName}" because the referenced column names are omitted, and the referenced table "${referencedTableName}" does not exist or does not have a primary key.`,
    );
  }
}
