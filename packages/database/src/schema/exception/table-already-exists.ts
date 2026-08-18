import type { SchemaException } from "../schema-exception";

export class TableAlreadyExists extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "TableAlreadyExists";
  }

  public static new(tableName: string): TableAlreadyExists {
    return new TableAlreadyExists(`The table with name "${tableName}" already exists.`);
  }
}
