import { Column } from "../column";

export class TableColumnMetadataRow {
  constructor(
    private readonly schemaName: string | null,
    private readonly tableName: string,
    private readonly column: Column,
  ) {}

  public getSchemaName(): string | null {
    return this.schemaName;
  }

  public getTableName(): string {
    return this.tableName;
  }

  public getColumn(): Column {
    return this.column;
  }
}
