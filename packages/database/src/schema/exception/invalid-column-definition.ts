import type { SchemaException } from "../schema-exception";
import { nameToString } from "./_internal";

export class InvalidColumnDefinition extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidColumnDefinition";
  }

  public static nameNotSpecified(): InvalidColumnDefinition {
    return new InvalidColumnDefinition("Column name is not specified.");
  }

  public static dataTypeNotSpecified(columnName: unknown): InvalidColumnDefinition {
    return new InvalidColumnDefinition(
      `Data type is not specified for column ${nameToString(columnName)}.`,
    );
  }
}
