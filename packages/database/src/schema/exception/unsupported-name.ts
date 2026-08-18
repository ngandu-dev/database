import type { SchemaException } from "../schema-exception";

export class UnsupportedName extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedName";
  }

  public static fromNonNullSchemaName(schemaName: string, methodName: string): UnsupportedName {
    return new UnsupportedName(
      `${methodName}() does not accept schema names, "${schemaName}" given.`,
    );
  }

  public static fromNullSchemaName(methodName: string): UnsupportedName {
    return new UnsupportedName(`${methodName}() requires a schema name, null given.`);
  }
}
