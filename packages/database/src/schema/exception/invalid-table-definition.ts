import type { SchemaException } from "../schema-exception";
import { nameToString } from "./_internal";

export class InvalidTableDefinition extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTableDefinition";
  }
  public static nameNotSet(): InvalidTableDefinition {
    return new InvalidTableDefinition("Table name is not set.");
  }
  public static columnsNotSet(tableName: unknown): InvalidTableDefinition {
    return new InvalidTableDefinition(`Columns are not set for table ${nameToString(tableName)}.`);
  }
}
