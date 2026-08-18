export class PrimaryKeyConstraintColumnRow {
  constructor(
    private readonly schemaName: string | null,
    private readonly tableName: string,
    private readonly constraintName: string | null,
    private readonly clustered: boolean,
    private readonly columnName: string,
  ) {}

  public getSchemaName(): string | null {
    return this.schemaName;
  }

  public getTableName(): string {
    return this.tableName;
  }

  public getConstraintName(): string | null {
    return this.constraintName;
  }

  public isClustered(): boolean {
    return this.clustered;
  }

  public getColumnName(): string {
    return this.columnName;
  }
}
