export class SchemaMetadataRow {
  constructor(private readonly schemaName: string) {}

  public getSchemaName(): string {
    return this.schemaName;
  }
}
