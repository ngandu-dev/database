import type { SchemaException } from "../schema-exception";

export class TableDoesNotExist extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "TableDoesNotExist";
  }

  public static new(tableName: string): TableDoesNotExist {
    return new TableDoesNotExist(`There is no table with name "${tableName}" in the schema.`);
  }
}
