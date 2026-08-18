import type { SchemaException } from "../schema-exception";

export class IndexDoesNotExist extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "IndexDoesNotExist";
  }

  public static new(indexName: string, table: string): IndexDoesNotExist {
    return new IndexDoesNotExist(`Index "${indexName}" does not exist on table "${table}".`);
  }
}
