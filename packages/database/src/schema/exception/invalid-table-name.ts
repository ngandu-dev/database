import type { SchemaException } from "../schema-exception";

export class InvalidTableName extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTableName";
  }

  public static new(tableName: string): InvalidTableName {
    return new InvalidTableName(`Invalid table name specified "${tableName}".`);
  }
}
