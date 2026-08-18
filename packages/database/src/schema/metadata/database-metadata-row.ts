export class DatabaseMetadataRow {
  constructor(private readonly databaseName: string) {}

  public getDatabaseName(): string {
    return this.databaseName;
  }
}
