import type { SchemaException } from "../schema-exception";

export class IndexNameInvalid extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "IndexNameInvalid";
  }

  public static new(indexName: string): IndexNameInvalid {
    return new IndexNameInvalid(`Invalid index name "${indexName}" given, has to be [a-zA-Z0-9_].`);
  }
}
