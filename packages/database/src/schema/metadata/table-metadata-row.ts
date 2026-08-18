export class TableMetadataRow {
  constructor(
    private readonly schemaName: string | null,
    private readonly tableName: string,
    private readonly options: Record<string, unknown>,
  ) {}

  public getSchemaName(): string | null {
    return this.schemaName;
  }

  public getTableName(): string {
    return this.tableName;
  }

  public getOptions(): Record<string, unknown> {
    return { ...this.options };
  }
}
