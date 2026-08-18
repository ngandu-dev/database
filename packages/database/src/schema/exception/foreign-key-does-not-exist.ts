import type { SchemaException } from "../schema-exception";

export class ForeignKeyDoesNotExist extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "ForeignKeyDoesNotExist";
  }

  public static new(foreignKeyName: string, table: string): ForeignKeyDoesNotExist {
    return new ForeignKeyDoesNotExist(
      `There exists no foreign key with the name "${foreignKeyName}" on table "${table}".`,
    );
  }
}
