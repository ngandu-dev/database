import type { SchemaException } from "../schema-exception";
import { nameToString } from "./_internal";

export class InvalidViewDefinition extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidViewDefinition";
  }

  public static nameNotSet(): InvalidViewDefinition {
    return new InvalidViewDefinition("View name is not set.");
  }
  public static sqlNotSet(viewName: unknown): InvalidViewDefinition {
    return new InvalidViewDefinition(`SQL is not set for view ${nameToString(viewName)}.`);
  }
}
