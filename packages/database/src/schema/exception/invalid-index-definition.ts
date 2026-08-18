import type { SchemaException } from "../schema-exception";
import { nameToString } from "./_internal";

export class InvalidIndexDefinition extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIndexDefinition";
  }

  public static nameNotSet(): InvalidIndexDefinition {
    return new InvalidIndexDefinition("Index name is not set.");
  }

  public static columnsNotSet(indexName: unknown): InvalidIndexDefinition {
    return new InvalidIndexDefinition(`Columns are not set for index ${nameToString(indexName)}.`);
  }

  public static fromNonPositiveColumnLength(
    columnName: unknown,
    length: number,
  ): InvalidIndexDefinition {
    return new InvalidIndexDefinition(
      `Indexed column length must be a positive integer, ${length} given for column ${nameToString(columnName)}.`,
    );
  }
}
