import type { SchemaException } from "../schema-exception";

export class IndexAlreadyExists extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "IndexAlreadyExists";
  }

  public static new(indexName: string, table: string): IndexAlreadyExists {
    return new IndexAlreadyExists(
      `An index with name "${indexName}" was already defined on table "${table}".`,
    );
  }
}
