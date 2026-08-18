import type { SchemaException } from "../schema-exception";

export class ColumnDoesNotExist extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "ColumnDoesNotExist";
  }

  public static new(columnName: string, table: string): ColumnDoesNotExist {
    return new ColumnDoesNotExist(
      `There is no column with name "${columnName}" on table "${table}".`,
    );
  }
}
