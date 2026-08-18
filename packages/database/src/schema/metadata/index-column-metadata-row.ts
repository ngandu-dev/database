import { IndexType } from "../index/index-type";

export class IndexColumnMetadataRow {
  constructor(
    private readonly schemaName: string | null,
    private readonly tableName: string,
    private readonly indexName: string,
    private readonly type: IndexType,
    private readonly clustered: boolean,
    private readonly predicate: string | null,
    private readonly columnName: string,
    private readonly columnLength: number | null,
  ) {}

  public getSchemaName(): string | null {
    return this.schemaName;
  }

  public getTableName(): string {
    return this.tableName;
  }

  public getIndexName(): string {
    return this.indexName;
  }

  public getType(): IndexType {
    return this.type;
  }

  public isClustered(): boolean {
    return this.clustered;
  }

  public getPredicate(): string | null {
    return this.predicate;
  }

  public getColumnName(): string {
    return this.columnName;
  }

  public getColumnLength(): number | null {
    return this.columnLength;
  }
}
