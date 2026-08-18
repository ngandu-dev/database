import type { SchemaException } from "../schema-exception";

export class ColumnAlreadyExists extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "ColumnAlreadyExists";
  }

  public static new(tableName: string, columnName: string): ColumnAlreadyExists {
    return new ColumnAlreadyExists(
      `The column "${columnName}" on table "${tableName}" already exists.`,
    );
  }
}
