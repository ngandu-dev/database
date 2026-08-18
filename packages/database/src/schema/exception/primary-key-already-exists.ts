import type { SchemaException } from "../schema-exception";

export class PrimaryKeyAlreadyExists extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "PrimaryKeyAlreadyExists";
  }

  public static new(tableName: string): PrimaryKeyAlreadyExists {
    return new PrimaryKeyAlreadyExists(`Primary key was already defined on table "${tableName}".`);
  }
}
